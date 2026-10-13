import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createDemoState, DEMO_CLOCK, evaluate, compileIntent, buildSharedContext, detectContextGaps,
  buildOutcomeLedger, capturePlanBaseline, recordPlanOutcome, recordContextCorrection, pruneContextData } from '../packages/core/src/index.mjs';

const clone=value=>structuredClone(value),settle=()=>new Promise(resolve=>setImmediate(resolve));
let sequence=0;
async function fixture({state=createDemoState(),workspace='demo'}={}) {
  const keys=['Date','document','Element','HTMLElement','Event','window','localStorage','navigator','fetch','setInterval','setTimeout','matchMedia'];
  const saved=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const RealDate=Date,dom=new JSDOM('<!doctype html><div id="app"></div><div id="announcement"></div>',{url:'http://localhost/',pretendToBeVisual:true});
  let current=clone(state),clock=DEMO_CLOCK,poll,stateHandler,preview;
  const calls=[];
  const cleanup=()=>{dom.window.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
  const snapshot=()=>({workspace,state:clone(current),queue:evaluate(current,{now:clock,mode:workspace==='demo'?'replay':'live'}),
    sharedContext:buildSharedContext(current,{now:clock}),gaps:detectContextGaps(current,{},{now:clock}),ledger:buildOutcomeLedger(current,{now:clock}),
    status:{intervalMs:60000,lastTick:clock,ticks:1,evaluations:1}});
  const replace=(key,value)=>Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  replace('Date',class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return RealDate.parse(clock);}});
  for(const key of ['document','Element','HTMLElement','Event','window','localStorage','navigator'])replace(key,dom.window[key]);
  localStorage.setItem('lifeweave-workspace',workspace);
  replace('setInterval',callback=>{poll=callback;return 1;});replace('setTimeout',()=>1);replace('matchMedia',()=>({matches:true}));
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  replace('fetch',async(url,init={})=>{
    const route=new URL(url,'http://localhost/').pathname,body=init.body?JSON.parse(init.body):undefined;
    calls.push({route,body});let value;
    if(route==='/api/state'){if(stateHandler)return stateHandler();value=snapshot();}
    else if(route==='/api/bootstrap')value={csrfToken:'synthetic-csrf'};
    else if(route==='/api/catalog')value={integrations:[]};
    else if(route==='/api/research')value={repositories:[]};
    else if(route==='/api/activity')value={activity:[]};
    else if(route==='/api/candidates')value={candidates:[]};
    else if(route==='/api/model')value={configured:false};
    else if(route==='/api/intent')value=preview={workspace,previewId:'synthetic-preview',...compileIntent(current,body,{now:clock}),input:body};
    else if(route==='/api/intent/review'){
      // Independent oracle: if core no longer finds a confirmed window, host review fails.
      const fresh=compileIntent(current,preview.input,{now:clock});
      if(fresh.status!=='ready')return {ok:false,json:async()=>({error:'Current window unavailable'})};
      const {input,...result}=preview;value=result;
    }else throw new Error(`Unexpected fixture route ${route}`);
    return {ok:true,json:async()=>clone(value)};
  });
  let source=await readFile(new URL('../apps/web/app.mjs',import.meta.url),'utf8');
  for(const [specifier,relative]of [["'/packages/ui/src/index.mjs'",'../packages/ui/src/index.mjs'],["'./request-panel.mjs'",'../apps/web/request-panel.mjs'],["'./workspace-tools.mjs'",'../apps/web/workspace-tools.mjs']]){
    assert(source.includes(specifier));source=source.replace(specifier,JSON.stringify(new URL(relative,import.meta.url).href));
  }
  try{await import(`data:text/javascript;base64,${Buffer.from(`${source}\n// isolated-fixture-${++sequence}`).toString('base64')}`);}catch(error){cleanup();throw error;}
  return {dom,calls,poll:()=>poll(),snapshot,setState:value=>{current=clone(value);},setClock:value=>{clock=value;},setStateHandler:value=>{stateHandler=value;},
    cleanup};
}
function clickText(text){const target=[...document.querySelectorAll('button')].find(button=>button.textContent===text);assert(target,`Missing button: ${text}`);target.click();}
function navigate(text){const target=[...document.querySelectorAll('.nav-button')].find(button=>button.textContent.includes(text));assert(target);target.click();}
function revoked(state,connectorId){const next=clone(state);next.connections.find(connection=>connection.id===connectorId).status='disconnected';return pruneContextData(next,{now:DEMO_CLOCK});}

test('actual app polls are single flight; fresh revocation cannot be overwritten by an older poll',async()=>{
  const state=createDemoState();state.observations[0].summary='SYNTHETIC_REVOKED_EVIDENCE_MARKER';
  const f=await fixture({state});let release;
  try{
    assert(document.body.textContent.includes('SYNTHETIC_REVOKED_EVIDENCE_MARKER'));
    const old=f.snapshot();f.setStateHandler(()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>old});}));
    const first=f.poll();await settle();assert(release);const reads=f.calls.filter(call=>call.route==='/api/state').length;
    f.setState(revoked(state,'demo-mail'));await f.poll();
    assert.equal(f.calls.filter(call=>call.route==='/api/state').length,reads,'Concurrent poll must be skipped');
    release();await first;f.setStateHandler(undefined);await f.poll();
    assert(!document.body.textContent.includes('SYNTHETIC_REVOKED_EVIDENCE_MARKER'));
    assert.equal(f.calls.filter(call=>call.route==='/api/model-proposals').length,0);
  }finally{release?.();f.cleanup();}
});

test('accepted intent is rechecked after clock advance even when quiet hours exclude its live frame',async()=>{
  const state=createDemoState();state.preferences.dailySurfaceBudget=0;state.preferences.quietHours={start:0,end:23};
  const f=await fixture({state,workspace:'personal'});
  try{
    assert.equal(f.snapshot().queue.surfaces.length,0);
    const form=document.querySelector('.intent-panel form');form.querySelector('input').value='Help my learning goal for 30 minutes';
    form.dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle();clickText('Use this focus view');await settle();
    assert(document.querySelector('.canvas').textContent.includes('Your requested focus view'));
    assert(document.querySelector('.canvas .lw-metric').textContent.includes('60'));
    clickText('Plan this focus session');assert(document.activeElement.closest('form'));
    f.setClock('2026-10-13T18:45:00.000Z');assert.equal(f.snapshot().queue.surfaces.length,0);await f.poll();
    assert(!document.querySelector('.canvas').textContent.includes('Your requested focus view'));
    assert.equal(document.querySelector('.action-review'),null);
    assert.equal(f.calls.filter(call=>call.route==='/api/intent/review').length,2);
    assert.equal(f.calls.filter(call=>call.route==='/api/deliveries').length,0);
  }finally{f.cleanup();}
});

test('revocation removes source annotations while a Shared context form retains focus',async()=>{
  let state=createDemoState();state.observations[0].id='synthetic-context-source';delete state.observations[0].data.dueAt;
  state=recordContextCorrection(state,{goalId:'goal-career',observationId:'synthetic-context-source',fields:{dueAt:'2026-10-12T16:00:00Z'}},{now:DEMO_CLOCK});
  const f=await fixture({state});
  try{
    navigate('Shared context');assert(document.body.textContent.includes('synthetic-context-source'));
    const input=document.querySelector('.context-editor form input');input.focus();assert(document.activeElement.closest('form'));
    f.setState(revoked(state,'demo-mail'));await f.poll();
    assert(!document.body.textContent.includes('synthetic-context-source'));
    assert.equal(document.querySelector('.nav-button[aria-current="page"]').textContent.includes('Shared context'),true);
  }finally{f.cleanup();}
});

test('revocation removes derived outcome text despite a focused report form and never invents completion',async()=>{
  let state=createDemoState();state.observations.push({id:'synthetic-baseline',tenantId:'local',connectorId:'demo-manual',kind:'metric.update',occurredAt:'2026-10-13T15:00:00Z',goalIds:['goal-learning'],summary:'Invented source',metrics:{focusMinutes:20},data:{}});
  const frame=evaluate(state,{now:DEMO_CLOCK,mode:'replay'}).surfaces.find(surface=>surface.ruleId==='focus-opportunity');
  state.plans=[{id:'synthetic-plan',tenantId:'local',surfaceId:frame.id,goalId:frame.goalId,actionId:frame.actions[0].id,intent:'plan-focus',text:'SYNTHETIC_DERIVED_PRIVATE_MARKER',focusMinutes:25,status:'draft',createdAt:DEMO_CLOCK,evidenceRefs:frame.evidenceRefs,baseline:capturePlanBaseline(state,{goalId:frame.goalId},{now:DEMO_CLOCK})}];
  state=recordPlanOutcome(state,{planId:'synthetic-plan',usefulness:'not-useful',effortMinutes:0},{now:DEMO_CLOCK});
  const f=await fixture({state});
  try{
    navigate('Outcomes');assert(document.body.textContent.includes('SYNTHETIC_DERIVED_PRIVATE_MARKER'));
    assert(document.body.textContent.includes('Your reported experience'));assert(!document.body.textContent.includes('User-reported completion'));
    const input=document.querySelector('.outcome-row form input');input.focus();assert(document.activeElement.closest('form'));
    f.setState(revoked(state,'demo-manual'));await f.poll();
    assert(!document.body.textContent.includes('SYNTHETIC_DERIVED_PRIVATE_MARKER'));assert.equal(document.querySelector('.outcome-row'),null);
  }finally{f.cleanup();}
});
