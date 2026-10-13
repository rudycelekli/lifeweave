import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLocalServer} from '../apps/web/server.mjs';
import {createModelPlanner} from '../packages/planner/src/index.mjs';

const NOW='2026-10-13T16:00:00.000Z';
const endpoint='http://127.0.0.1:11434/v1/chat/completions';
const answer=frame=>new Response(JSON.stringify({choices:[{message:{role:'assistant',content:JSON.stringify(frame)}}]}));
const frameFrom=init=>JSON.parse(JSON.parse(init.body).messages[1].content).baseSurface;
async function fixture({transport,clock=()=>NOW,maxRequests=3,timeoutMs=1000,configured=true}={}) {
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'lifeweave-model-api-')),calls=[];
  const local=await createLocalServer({port:0,dataDir,clock,intervalMs:60000,...(configured?{modelConfig:{endpoint,model:'mock-local',maxRequests,timeoutMs,fetchImpl:async(url,init)=>{calls.push({url,init});return transport?transport(url,init):answer(frameFrom(init));}}}:{})});
  const bootstrap=await fetch(`${local.origin}/api/bootstrap`),cookie=bootstrap.headers.get('set-cookie').split(';')[0],csrf=(await bootstrap.json()).csrfToken;
  const request=async(route,{mode='demo',body,headers={}}={})=>{
    const response=await fetch(`${local.origin}${route}?workspace=${mode}`,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{Origin:local.origin,'Content-Type':'application/json','X-Lifeweave-Csrf':csrf}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,value:await response.json()};
  };
  const selected=async()=>{const value=(await request('/api/state')).value;return value.queue.surfaces.find(s=>s.ruleId==='focus-opportunity');};
  return {...local,dataDir,calls,request,selected,cleanup:async()=>{await local.close();await fs.rm(dataDir,{recursive:true,force:true});}};
}

test('console has no automatic model calls and only exposes safe loopback-transport capabilities',async()=>{
  const f=await fixture();try{
    const info=(await f.request('/api/model')).value;
    assert.equal(info.configured,true);assert.equal(info.transport,'loopback-http');assert.equal(info.executionLocation,'unverified');assert.equal(info.remainingRequests,3);
    assert(!JSON.stringify(info).includes(endpoint));assert(!JSON.stringify(info).includes('apiKey'));assert.equal(f.calls.length,0);
    await f.request('/api/state');assert.equal(f.calls.length,0);
    const s=await f.selected(),result=await f.request('/api/model-proposals',{body:{surfaceId:s.id,request:'Make the scenario clearer.'}});
    assert.equal(result.status,200);assert.equal(result.value.requiresReview,true);assert.equal(result.value.workspace,'demo');assert.equal(result.value.surface.id,s.id);assert.equal(f.calls.length,1);
    const review=await f.request('/api/model-proposals/review',{body:{proposalId:result.value.proposalId}});assert.equal(review.status,200);assert.equal(f.calls.length,1);
    const persisted=JSON.parse(await fs.readFile(path.join(f.dataDir,'demo.json'),'utf8'));assert.equal(persisted.modelProposals,undefined);assert.equal(persisted.plans,undefined);assert.equal(f.status.externalActions,0);
  }finally{await f.cleanup();}
});

test('unconfigured console, malformed fields and missing CSRF fail before any transport',async()=>{
  const f=await fixture({configured:false});try{
    assert.equal((await f.request('/api/model')).value.configured,false);
    const s=await f.selected();
    const missing=await f.request('/api/model-proposals',{body:{surfaceId:s.id,request:'Clearer'}});assert.equal(missing.status,503);assert.equal(missing.value.code,'model-not-configured');
    for(const body of [{surfaceId:s.id,request:''},{surfaceId:s.id,request:'x'.repeat(2001)},{surfaceId:s.id,request:'a',endpoint:'https://invalid.example'},{surfaceId:s.id,request:'a',apiKey:'secret'}])assert.equal((await f.request('/api/model-proposals',{body})).value.code,'invalid-model-request');
    assert.equal((await f.request('/api/model-proposals',{body:{surfaceId:s.id,request:'a'},headers:{'X-Lifeweave-Csrf':'wrong'}})).status,403);
    assert.equal(f.calls.length,0);
  }finally{await f.cleanup();}
});

test('surface requests and review IDs cannot cross isolated workspaces',async()=>{
  const f=await fixture();try{
    const s=await f.selected();
    const wrong=await f.request('/api/model-proposals',{mode:'business',body:{surfaceId:s.id,request:'Format'}});assert.equal(wrong.value.code,'no-current-grounded-surface');assert.equal(f.calls.length,0);
    const result=await f.request('/api/model-proposals',{body:{surfaceId:s.id,request:'Format'}});
    const review=await f.request('/api/model-proposals/review',{mode:'personal',body:{proposalId:result.value.proposalId}});assert.equal(review.status,404);assert.equal(review.value.code,'proposal-not-found');
  }finally{await f.cleanup();}
});

test('revocation write completes during pending model request and replacement state rejects response',async()=>{
  let release,entered;const started=new Promise(resolve=>{entered=resolve;});
  const f=await fixture({transport:async(_url,init)=>{entered();await new Promise(resolve=>{release=resolve;});return answer(frameFrom(init));}});
  try{
    const s=await f.selected();const pending=f.request('/api/model-proposals',{body:{surfaceId:s.id,request:'Format'}});await started;
    const revocation=await Promise.race([f.request('/api/revoke',{body:{connectorId:'demo-calendar'}}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Model await blocked write queue')),300))]);
    assert.equal(revocation.status,200);release();const result=await pending;assert.equal(result.value.code,'grounding-changed');
  }finally{release?.();await f.cleanup();}
});

test('fresh clock rejects model response and review at original expiry even when core could regenerate TTL',async()=>{
  let now=NOW;const f=await fixture({clock:()=>now,transport:async(_url,init)=>{now='2026-10-13T19:00:00Z';return answer(frameFrom(init));}});
  try{const s=await f.selected();const result=await f.request('/api/model-proposals',{body:{surfaceId:s.id,request:'Format'}});assert.equal(result.value.code,'proposal-expired');}
  finally{await f.cleanup();}
  now=NOW;const g=await fixture({clock:()=>now});try{
    const base=(await g.request('/api/state')).value.queue.surfaces.find(s=>s.ruleId==='overdue-commitment');
    const result=await g.request('/api/model-proposals',{body:{surfaceId:base.id,request:'Clear checklist'}});assert.equal(result.status,200);
    now='2026-10-14T16:00:00Z';const review=await g.request('/api/model-proposals/review',{body:{proposalId:result.value.proposalId}});
    assert.equal(review.value.code,'proposal-expired');assert.equal((await g.request('/api/model-proposals/review',{body:{proposalId:result.value.proposalId}})).value.code,'proposal-not-found');
  }finally{await g.cleanup();}
});

test('goal changes invalidate review and request caps/timeouts are sanitized',async()=>{
  const f=await fixture({maxRequests:1});try{
    const s=await f.selected(),proposal=await f.request('/api/model-proposals',{body:{surfaceId:s.id,request:'Format'}});
    const snapshot=(await f.request('/api/state')).value.state,goal=snapshot.goals.find(g=>g.id===s.goalId);
    await f.request('/api/goals',{body:{...goal,title:'A new current objective'}});
    assert.equal((await f.request('/api/model-proposals/review',{body:{proposalId:proposal.value.proposalId}})).value.code,'proposal-not-found'); // Invalidated immediately on the write.
    assert.equal((await f.request('/api/model-proposals',{body:{surfaceId:s.id,request:'Again'}})).status,429);assert.equal(f.calls.length,1);
  }finally{await f.cleanup();}
  const slow=await fixture({timeoutMs:10,transport:()=>new Promise(()=>{})});try{
    const s=await slow.selected(),result=await slow.request('/api/model-proposals',{body:{surfaceId:s.id,request:'Format'}});assert.equal(result.status,504);assert.equal(result.value.code,'timeout');assert.equal(slow.calls.length,1);
  }finally{await slow.cleanup();}
});

test('default console rejects explicitly remote configured adapters at construction',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lifeweave-model-config-'));
  try{
    const remote=createModelPlanner({endpoint:'https://example.invalid/v1/chat/completions',model:'m',allowRemote:true,allowDisclosure:true,fetchImpl:async()=>{throw new Error('No real call permitted');}});
    await assert.rejects(createLocalServer({port:0,dataDir:dir,modelPlanner:remote}),/invalid-console-model-config/);
    await assert.rejects(createLocalServer({port:0,dataDir:dir,modelConfig:{endpoint:'https://example.invalid/v1/chat/completions',model:'m',allowRemote:true}}),/remote-model-prohibited/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
