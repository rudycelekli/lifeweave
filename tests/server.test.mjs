import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createLocalServer} from '../apps/web/server.mjs';
const NOW='2026-10-13T16:00:00.000Z';

async function fixture() {
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'lifeweave-api-'));
  const local=await createLocalServer({port:0,dataDir,clock:()=>NOW,intervalMs:25});
  const bootstrap=await fetch(`${local.origin}/api/bootstrap`);
  const cookie=bootstrap.headers.get('set-cookie').split(';')[0],csrf=(await bootstrap.json()).csrfToken;
  const request=async(route,{mode='personal',body,headers={}}={})=>{
    const response=await fetch(`${local.origin}${route}${route.includes('?')?'&':'?'}workspace=${mode}`,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{Origin:local.origin,'Content-Type':'application/json','X-Lifeweave-Csrf':csrf}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const value=await response.json();return {status:response.status,value};
  };
  return {...local,dataDir,request,cleanup:async()=>{await local.close();await fs.rm(dataDir,{recursive:true,force:true});}};
}

test('local assets render with a matching import-map CSP and private/server files stay inaccessible',async()=>{
  const f=await fixture();try{
    const page=await fetch(f.origin);assert.equal(page.status,200);const html=await page.text();assert.match(html,/LifeWeave/);
    const importMap=html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
    const hash=crypto.createHash('sha256').update(importMap).digest('base64');assert.ok(page.headers.get('content-security-policy').includes(`sha256-${hash}`));
    for(const route of ['/apps/web/server.mjs','/.private/runtime/personal.json','/docs/research/personal-model.md','/apps/web/../../.private/inputs/candidate-goals.json'])assert.equal((await fetch(f.origin+route)).status,404,route);
    assert.equal((await fetch(f.origin+'/api/state')).status,401);
    assert.equal((await fetch(f.origin+'/api/state',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  }finally{await f.cleanup();}
});
test('mutations require exact local origin and CSRF token',async()=>{
  const f=await fixture();try{
    const body={title:'Private goal',dimension:'personal',priority:60};
    assert.equal((await f.request('/api/goals',{body,headers:{'X-Lifeweave-Csrf':'wrong'}})).status,403);
    assert.equal((await f.request('/api/goals',{body,headers:{Origin:'https://example.invalid'}})).status,403);
    assert.equal((await f.request('/api/state')).value.state.goals.length,0);
  }finally{await f.cleanup();}
});
test('concurrent loopback hosts keep independent cookies in one browser cookie jar',async()=>{
  const first=await fixture(),second=await fixture();try{
    const a=await fetch(first.origin+'/api/bootstrap'),b=await fetch(second.origin+'/api/bootstrap');
    const ac=a.headers.get('set-cookie').split(';')[0],bc=b.headers.get('set-cookie').split(';')[0];
    assert.notEqual(ac.split('=')[0],bc.split('=')[0]);
    const jar=`${ac}; ${bc}`;
    assert.equal((await fetch(first.origin+'/api/state?workspace=personal',{headers:{Cookie:jar}})).status,200);
    assert.equal((await fetch(second.origin+'/api/state?workspace=personal',{headers:{Cookie:jar}})).status,200);
    assert.equal((await fetch(first.origin+'/api/state?workspace=personal',{headers:{Cookie:bc}})).status,401);
  }finally{await first.cleanup();await second.cleanup();}
});
test('personal and business workspaces persist separately and reject cross-tenant observations',async()=>{
  const f=await fixture();try{
    await f.request('/api/goals',{body:{id:'g-personal',title:'Learn',dimension:'learning',priority:60,metric:{key:'minutes',target:60,unit:'minutes',direction:'increase'}}});
    await f.request('/api/local-consent',{body:{health:false}});
    assert.equal((await f.request('/api/observations',{body:{observations:[{id:'o1',tenantId:'business-local',connectorId:'local-import',kind:'metric.update',occurredAt:NOW,goalIds:['g-personal'],summary:'wrong tenant',metrics:{minutes:5},data:{}}]}})).status,400);
    const added=await f.request('/api/observations',{body:{observations:[{id:'o1',tenantId:'local',connectorId:'local-import',kind:'metric.update',occurredAt:NOW,goalIds:['g-personal'],summary:'Measured practice time',metrics:{minutes:5},data:{}}]}});
    assert.equal(added.status,200);assert.equal(added.value.queue.surfaces.length,1);
    const business=(await f.request('/api/state',{mode:'business'})).value.state;
    assert.equal(business.tenantId,'business-local');assert.equal(business.goals.length,0);assert.equal(business.observations.length,0);
    const stored=JSON.parse(await fs.readFile(path.join(f.dataDir,'personal.json'),'utf8'));assert.equal(stored.observations[0].metrics.minutes,5);
    assert.equal((await fs.stat(path.join(f.dataDir,'personal.json'))).mode&0o777,0o600);
  }finally{await f.cleanup();}
});
test('health scope downgrade purges raw measurements as well as suppressing suggestions',async()=>{
  const f=await fixture();try{
    await f.request('/api/goals',{body:{id:'g-health',title:'Routine',dimension:'wellbeing',priority:70,metric:{key:'sleepHours',target:7,unit:'hours',direction:'increase'}}});
    await f.request('/api/local-consent',{body:{health:true}});
    const result=await f.request('/api/observations',{body:{observations:[0,1,2].map(i=>({id:`h${i+1}`,tenantId:'local',connectorId:'local-import',kind:'health.sleep',occurredAt:new Date(Date.parse(NOW)-i*86400000).toISOString(),goalIds:['g-health'],summary:'Explicit record',metrics:{sleepHours:6},data:{}}))}});assert.equal(result.status,200);
    const sleep=result.value.queue.surfaces.find(s=>s.ruleId==='sleep-reflection');assert(sleep);
    const draft=await f.request('/api/plans',{body:{surfaceId:sleep.id,actionId:sleep.actions[0].id,text:'Private health-derived plan'}});assert.equal(draft.status,200);
    await f.request('/api/local-consent',{body:{health:false}});
    assert.equal((await f.request('/api/state')).value.state.observations.length,0);
    assert.equal(JSON.parse(await fs.readFile(path.join(f.dataDir,'personal.json'),'utf8')).observations.length,0);
    assert.equal((await f.request('/api/plans')).value.plans.length,0);
    assert(!JSON.stringify((await f.request('/api/state')).value.state).includes('Private health-derived plan'));
    assert(!(await fs.readFile(path.join(f.dataDir,'personal.json'),'utf8')).includes('Private health-derived plan'));
  }finally{await f.cleanup();}
});
test('concurrent goal writes serialize and invalid inputs cannot corrupt durable state',async()=>{
  const f=await fixture();try{
    const results=await Promise.all(Array.from({length:8},(_,i)=>f.request('/api/goals',{body:{id:`g-${i}`,title:`Goal ${i}`,dimension:'personal',priority:50}})));
    assert.ok(results.every(r=>r.status===200));assert.equal((await f.request('/api/state')).value.state.goals.length,8);
    assert.equal((await f.request('/api/goals',{body:{id:'bad',title:'Bad',dimension:'personal',priority:999}})).status,400);
    assert.equal((await f.request('/api/state')).value.state.goals.length,8);
    await new Promise(resolve=>setTimeout(resolve,40));assert.ok(f.status.ticks>=2);
  }finally{await f.cleanup();}
});
test('saved plans are bounded local drafts, fit calendar evidence and never execute external actions',async()=>{
  const f=await fixture();try{
    const {queue}= (await f.request('/api/state',{mode:'demo'})).value;
    const focus=queue.surfaces.find(s=>s.ruleId==='focus-opportunity'),action=focus.actions[0];
    const body={surfaceId:focus.id,actionId:action.id,text:'Work on the example outline',focusMinutes:25};
    assert.equal((await f.request('/api/plans',{mode:'demo',body:{...body,focusMinutes:1000}})).status,400);
    assert.equal((await f.request('/api/plans',{mode:'demo',body:{...body,execute:true}})).status,400);
    assert.equal((await f.request('/api/plans',{mode:'demo',body})).status,200);
    const plan=(await f.request('/api/plans',{mode:'demo'})).value.plans[0];assert.equal(plan.status,'draft');assert.equal(plan.focusMinutes,25);assert.equal(f.status.externalActions,0);
    await f.request('/api/revoke',{mode:'demo',body:{connectorId:'demo-calendar'}});
    assert.equal((await f.request('/api/plans',{mode:'demo'})).value.plans.length,0);
    assert.equal((await f.request('/api/plans',{mode:'demo',body})).status,400);
  }finally{await f.cleanup();}
});
test('feedback survives process restart without awarding goal measurements',async()=>{
  const f=await fixture();let restarted;try{
    const before=(await f.request('/api/state',{mode:'demo'})).value;
    const surface=before.queue.surfaces[0];await f.request('/api/feedback',{mode:'demo',body:{surfaceId:surface.id,kind:'done'}});
    await f.close();restarted=await createLocalServer({port:0,dataDir:f.dataDir,clock:()=>NOW});
    const raw=JSON.parse(await fs.readFile(path.join(f.dataDir,'demo.json'),'utf8'));
    assert.equal(raw.feedback.at(-1).surfaceId,surface.id);assert.deepEqual(raw.goals,before.state.goals);assert.deepEqual(raw.observations,before.state.observations);
  }finally{if(restarted)await restarted.close();await fs.rm(f.dataDir,{recursive:true,force:true});}
});
