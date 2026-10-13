import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createDemoState, DEMO_CLOCK, evaluate, compileIntent, composeDailyBoard, compileAssistantResponse, validateAssistantResponse, buildSharedContext, detectContextGaps,
  buildOutcomeLedger, capturePlanBaseline, recordPlanOutcome, recordContextCorrection, pruneContextData } from '../packages/core/src/index.mjs';

const clone=value=>structuredClone(value),settle=()=>new Promise(resolve=>setImmediate(resolve));
let sequence=0;
async function fixture({state=createDemoState(),workspace='demo',hidden=false}={}) {
  const keys=['Date','document','Element','HTMLElement','Event','window','localStorage','navigator','fetch','setInterval','setTimeout','matchMedia'];
  const saved=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const RealDate=Date,dom=new JSDOM('<!doctype html><div id="app"></div><div id="announcement"></div>',{url:'http://localhost/',pretendToBeVisual:true});
  let current=clone(state),clock=DEMO_CLOCK,poll,stateHandler,preview,responseEnvelope,responseInput,responseHandler;
  const calls=[];const business=createDemoState();business.tenantId='business-local';for(const o of business.observations)o.tenantId='business-local';
  const cleanup=()=>{dom.window.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
  const snapshot=(mode=workspace)=>{const active=mode==='business'?business:current;return {workspace:mode,state:clone(active),queue:evaluate(active,{now:clock,mode:mode==='demo'?'replay':'live'}),board:composeDailyBoard(active,{now:clock,mode:mode==='demo'?'replay':'live'}),sharedContext:buildSharedContext(active,{now:clock}),gaps:detectContextGaps(active,{},{now:clock}),ledger:buildOutcomeLedger(active,{now:clock}),status:{intervalMs:60000,lastTick:clock,ticks:1,evaluations:1}};};
  const replace=(key,value)=>Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  replace('Date',class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return RealDate.parse(clock);}});
  for(const key of ['document','Element','HTMLElement','Event','window','localStorage','navigator'])replace(key,dom.window[key]);
  Object.defineProperty(document,'hidden',{configurable:true,value:hidden});localStorage.setItem('lifeweave-workspace',workspace);
  replace('setInterval',callback=>{poll=callback;return 1;});replace('setTimeout',()=>1);replace('matchMedia',()=>({matches:true}));
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  replace('fetch',async(url,init={})=>{
    const parsed=new URL(url,'http://localhost/'),route=parsed.pathname,mode=parsed.searchParams.get('workspace')||workspace,active=mode==='business'?business:current,body=init.body?JSON.parse(init.body):undefined;
    calls.push({route,body,mode});let value;
    if(route==='/api/state'){if(stateHandler)return stateHandler();value=snapshot(mode);}
    else if(route==='/api/bootstrap')value={csrfToken:'synthetic-csrf'};
    else if(route==='/api/catalog')value={integrations:[]};
    else if(route==='/api/research')value={repositories:[]};
    else if(route==='/api/activity')value={activity:[]};
    else if(route==='/api/candidates')value={candidates:[]};
    else if(route==='/api/model')value={configured:false};
    else if(route==='/api/plans'){
      const frame=evaluate(current,{now:clock,mode:'replay'}).surfaces.find(item=>item.id===body.surfaceId);
      const action=frame?.actions.find(item=>item.id===body.actionId&&item.kind==='local');assert(action);
      current.plans||=[];current.plans.push({id:'synthetic-saved-plan',tenantId:current.tenantId,surfaceId:frame.id,goalId:frame.goalId,actionId:action.id,intent:action.payload.intent,text:body.text,status:'draft',createdAt:clock,evidenceRefs:[...frame.evidenceRefs],...(body.focusMinutes!==undefined?{focusMinutes:body.focusMinutes}:{})});
      value={ok:true,...snapshot(mode)};
    }
    else if(route==='/api/responses'){responseInput=body;value=responseEnvelope={workspace:mode,responseId:'synthetic-response',previewId:'synthetic-preview',response:compileAssistantResponse(active,body,{now:clock})};}
    else if(route==='/api/responses/review'){
      if(!validateAssistantResponse(responseEnvelope.response,active,{now:clock}).valid)return {ok:false,json:async()=>({error:'Current response unavailable'})};
      value=responseEnvelope;
    }
    else if(route==='/api/intent')value=preview={workspace,previewId:'synthetic-preview',...compileIntent(current,body,{now:clock}),input:body};
    else if(route==='/api/intent/review'){
      // Independent oracle: if core no longer finds a confirmed window, host review fails.
      const fresh=compileIntent(current,responseInput||preview.input,{now:clock});
      if(fresh.status!=='ready')return {ok:false,json:async()=>({error:'Current window unavailable'})};
      const {input,...result}=preview||{workspace,previewId:'synthetic-preview',...fresh};value=result;
    }else throw new Error(`Unexpected fixture route ${route}`);
    if(responseHandler){const overridden=responseHandler(route,body,clone(value),mode);if(overridden!==undefined)return overridden;}return {ok:true,json:async()=>clone(value)};
  });
  let source=await readFile(new URL('../apps/web/app.mjs',import.meta.url),'utf8');
  for(const [specifier,relative]of [["'/packages/ui/src/index.mjs'",'../packages/ui/src/index.mjs'],["'./request-panel.mjs'",'../apps/web/request-panel.mjs'],["'./workspace-tools.mjs'",'../apps/web/workspace-tools.mjs']]){
    assert(source.includes(specifier));source=source.replace(specifier,JSON.stringify(new URL(relative,import.meta.url).href));
  }
  try{await import(`data:text/javascript;base64,${Buffer.from(`${source}\n// isolated-fixture-${++sequence}`).toString('base64')}`);}catch(error){cleanup();throw error;}
  return {dom,calls,poll:()=>poll(),snapshot,setState:value=>{current=clone(value);},setClock:value=>{clock=value;},setStateHandler:value=>{stateHandler=value;},
    setResponseHandler:value=>{responseHandler=value;},cleanup};
}
function clickText(text){const target=[...document.querySelectorAll('button')].find(button=>button.textContent===text);assert(target,`Missing button: ${text}`);target.click();}
function navigate(text){document.querySelector('.workspace-menu').open=true;const target=[...document.querySelectorAll('.nav-button')].find(button=>button.textContent.includes(text));assert(target);target.click();}
function revoked(state,connectorId){const next=clone(state);next.connections.find(connection=>connection.id===connectorId).status='disconnected';return pruneContextData(next,{now:DEMO_CLOCK});}


const mounted=()=>[...document.querySelectorAll('.daily-board .board-move')].map(node=>node.dataset.surfaceId);
const submitRequest=async(f,text)=>{const form=document.querySelector('.assistant-composer form');form.querySelector('input').value=text;form.dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle();};

test('Today has at most three mounted moves, closed tools and one request box; only those moves are acknowledged',async()=>{
 const f=await fixture({workspace:'personal'});try{await settle();const shown=mounted();assert.equal(shown.length,3);assert.equal(document.querySelector('.canvas'),null);assert.equal(document.querySelector('.workspace-menu').open,false);assert.equal(document.querySelector('.sidebar'),null);assert.equal(document.querySelectorAll('.assistant-composer form').length,1);assert.equal(document.querySelectorAll('.assistant-composer input').length,1);for(const nav of document.querySelectorAll('.nav-button'))assert(nav.closest('.workspace-menu'));
 const receipts=f.calls.filter(c=>c.route==='/api/deliveries');assert.equal(receipts.length,1);assert.deepEqual(receipts[0].body.surfaceIds,shown);const omitted=f.snapshot().queue.surfaces.filter(s=>!shown.includes(s.id));assert.equal(omitted.length,1);assert(!receipts[0].body.surfaceIds.includes(omitted[0].id));
 }finally{f.cleanup();}
});

test('hidden tabs never acknowledge moves and explicit progress leaves unknown measurements unknown',async()=>{
 const f=await fixture({workspace:'personal',hidden:true});try{assert.equal(f.calls.filter(c=>c.route==='/api/deliveries').length,0);await submitRequest(f,'How am I doing?');await settle();assert(document.querySelector('.assistant-response .response-table'));assert(document.querySelector('.assistant-response').textContent.includes('Unknown'));assert.equal(document.querySelector('.daily-board'),null);assert.equal(f.calls.filter(c=>c.route==='/api/deliveries').length,0);assert.equal(f.calls.filter(c=>c.route==='/api/model-proposals').length,0);
 }finally{f.cleanup();}
});

test('unrelated source updates preserve a focused working draft, while its own source revocation clears private text',async()=>{
 const state=createDemoState(),f=await fixture({state});try{clickText('Take a look');clickText('Prepare a reply');const draft=document.querySelector('.action-review textarea');draft.value='SYNTHETIC_PRIVATE_UNSAVED_DRAFT';draft.focus();const next=clone(state);next.observations.push({id:'unrelated-new-note',tenantId:'local',connectorId:'demo-manual',kind:'manual.note',occurredAt:DEMO_CLOCK,goalIds:['goal-finances'],summary:'Invented unrelated update',data:{}});f.setState(next);await f.poll();assert.equal(document.querySelector('.action-review textarea'),draft);assert.equal(draft.value,'SYNTHETIC_PRIVATE_UNSAVED_DRAFT');assert.equal(document.activeElement,draft);f.setState(revoked(next,'demo-mail'));await f.poll();assert.equal(document.querySelector('.action-review'),null);assert(!document.body.textContent.includes('SYNTHETIC_PRIVATE_UNSAVED_DRAFT'));
 }finally{f.cleanup();}
});

test('a delayed progress response cannot enter another workspace after an A-to-B-to-A switch',async()=>{
 const f=await fixture({workspace:'personal'});let release;try{f.setResponseHandler((route,body,value)=>route==='/api/responses'?new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>value});}):undefined);await submitRequest(f,'How am I doing?');assert(release);let chooser=document.querySelector('#workspace-choice');chooser.value='business';chooser.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await settle();assert.equal(document.querySelector('#workspace-choice').value,'business');chooser=document.querySelector('#workspace-choice');chooser.value='personal';chooser.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));await settle();release();await settle();assert.equal(document.querySelector('#workspace-choice').value,'personal');assert.equal(document.querySelector('.assistant-response'),null);assert.equal(mounted().length,3);
 }finally{release?.();f.cleanup();}
});

test('a delayed pre-revocation progress response is fresh-reviewed before it can mount',async()=>{
 const state=createDemoState();state.observations.push({id:'private-metric-source',tenantId:'local',connectorId:'demo-manual',kind:'metric.update',occurredAt:DEMO_CLOCK,goalIds:['goal-finances'],summary:'Invented metric record',metrics:{monthlySavings:12345},data:{}});const f=await fixture({state,workspace:'personal'});let release;
 try{f.setResponseHandler((route,body,value)=>route==='/api/responses'?new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>value});}):undefined);await submitRequest(f,'Show my finances goal progress');assert(release);f.setState(revoked(state,'demo-manual'));await f.poll();release();await settle();await settle();assert.equal(document.querySelector('.assistant-response'),null);assert(!document.body.textContent.includes('12345'));assert(f.calls.some(c=>c.route==='/api/responses/review'));
 }finally{release?.();f.cleanup();}
});

test('successful local draft save returns to the compact board without minting progress',async()=>{
 const f=await fixture();try{const before=clone(f.snapshot().state);clickText('Take a look');clickText('Prepare a reply');const form=document.querySelector('.action-review');assert(form);form.querySelector('textarea').value='Invented user-authored next step';form.dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle();await settle();assert.equal(document.querySelector('.canvas'),null);assert.equal(mounted().length,3);assert.equal(document.querySelectorAll('.assistant-composer form').length,1);assert.equal(document.querySelector('.workspace-menu').open,false);const after=f.snapshot().state;assert.equal(after.plans.length,1);assert.equal(after.plans[0].status,'draft');assert.equal(after.plans[0].text,'Invented user-authored next step');assert.deepEqual(after.goals,before.goals);assert.deepEqual(after.observations,before.observations);assert.equal(after.outcomes,undefined);
 }finally{f.cleanup();}
});
