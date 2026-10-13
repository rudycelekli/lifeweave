import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createDemoState,evaluate,DEMO_CLOCK} from '@lifeweave/core';
import {createRequestPanel} from '../apps/web/request-panel.mjs';

function fixture({configured=true,request,onAccept=()=>{},isCurrent=()=>true}={}){
  const dom=new JSDOM('<!doctype html><body></body>');for(const key of ['document','Element','HTMLElement','Event'])globalThis[key]=dom.window[key];
  const surface=evaluate(createDemoState(),{now:DEMO_CLOCK,mode:'replay'}).surfaces.find(s=>s.ruleId==='focus-opportunity');
  const proposed=structuredClone(surface);proposed.title='A shorter focus plan';
  const envelope={workspace:'demo',proposalId:'temporary-proposal',surface:proposed,requiresReview:true,provenance:{kind:'model-proposal',model:'example'}};
  const calls=[];const panel=createRequestPanel({surface,workspace:'demo',status:{configured,remainingRequests:1},isCurrent,onAccept,onSettings:()=>calls.push('settings'),request:async(route,body)=>{calls.push({route,body});return request?request(route,body,envelope):envelope;}});
  document.body.append(panel.element);
  const submit=()=>{panel.element.querySelector('textarea').value='Make the scenario easier to scan';panel.element.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));};
  return {dom,panel,calls,surface,envelope,submit,settle:()=>new Promise(resolve=>setImmediate(resolve)),cleanup(){panel.dispose();dom.window.close();}};
}

test('collapsed optional request control never invokes a model at mount or when unconfigured',()=>{
  const f=fixture({configured:false});try{assert.equal(f.calls.length,0);assert.equal(f.panel.element.open,false);assert.equal(f.panel.element.querySelector('textarea'),null);f.panel.element.querySelector('button').click();assert.deepEqual(f.calls,['settings']);}finally{f.cleanup();}
});
test('explicit request shows an inert preview and acceptance fresh-revalidates before applying',async()=>{
  const accepted=[],f=fixture({onAccept:x=>accepted.push(x)});try{
    assert.equal(f.calls.length,0);f.submit();await f.settle();assert.equal(f.calls.length,1);assert.equal(accepted.length,0);
    assert.equal(f.panel.element.querySelector('.model-preview').hidden,false);assert.equal(f.panel.element.querySelectorAll('.model-preview .lw-actions button').length,0);
    const use=[...f.panel.element.querySelectorAll('button')].find(x=>x.textContent==='Use this view');use.click();await f.settle();
    assert.equal(f.calls[1].route,'/api/model-proposals/review');assert.deepEqual(f.calls[1].body,{proposalId:'temporary-proposal'});assert.equal(accepted.length,1);assert.deepEqual(f.surface.actions,f.envelope.surface.actions);
  }finally{f.cleanup();}
});
test('late model response cannot enter a disposed or switched workspace',async()=>{
  let resolve,current=true;const accepted=[],f=fixture({isCurrent:()=>current,onAccept:x=>accepted.push(x),request:()=>new Promise(r=>resolve=r)});
  try{f.submit();assert.equal(f.panel.pending,true);current=false;f.panel.dispose();resolve(f.envelope);await f.settle();assert.equal(accepted.length,0);assert.equal(f.panel.element.querySelector('.model-preview').hidden,true);assert.equal(f.panel.pending,false);}finally{f.cleanup();}
});
test('a revoked or expired preview is removed and never applied after review rejects',async()=>{
  const accepted=[],f=fixture({onAccept:x=>accepted.push(x),request:(route,body,envelope)=>{if(route.endsWith('/review'))throw Object.assign(new Error('private transport details'),{code:'grounding-changed'});return envelope;}});
  try{f.submit();await f.settle();[...f.panel.element.querySelectorAll('button')].find(x=>x.textContent==='Use this view').click();await f.settle();assert.equal(accepted.length,0);assert.equal(f.panel.element.querySelector('.model-preview').hidden,true);assert.match(f.panel.element.querySelector('[role=status]').textContent,/evidence changed/);assert.doesNotMatch(f.panel.element.textContent,/private transport details/);}finally{f.cleanup();}
});
test('forged workspace and executable blocks never become a usable preview',async()=>{
  const f=fixture({request:(route,body,envelope)=>({...envelope,workspace:'business'})});try{f.submit();await f.settle();assert.equal(f.panel.element.querySelector('.model-preview').hidden,true);assert.match(f.panel.element.querySelector('[role=status]').textContent,/could not be verified/);}finally{f.cleanup();}
  const g=fixture({request:(route,body,envelope)=>({...envelope,surface:{...envelope.surface,blocks:[...envelope.surface.blocks,{type:'html',html:'<script>run()</script>'}]}})});try{g.submit();await g.settle();assert.equal(g.panel.element.querySelector('script'),null);assert.equal(g.panel.element.querySelector('.model-preview').hidden,true);}finally{g.cleanup();}
});
test('discarding while review is pending cancels late acceptance',async()=>{
  let release;const accepted=[],f=fixture({onAccept:x=>accepted.push(x),request:(route,body,envelope)=>route.endsWith('/review')?new Promise(resolve=>release=()=>resolve(envelope)):envelope});
  try{f.submit();await f.settle();[...f.panel.element.querySelectorAll('button')].find(x=>x.textContent==='Use this view').click();assert.equal(f.panel.pending,true);[...f.panel.element.querySelectorAll('button')].find(x=>x.textContent==='Keep the original').click();release();await f.settle();assert.equal(accepted.length,0);assert.equal(f.panel.element.querySelector('.model-preview').hidden,true);assert.match(f.panel.element.querySelector('[role=status]').textContent,/Original view kept/);}finally{f.cleanup();}
});
test('review cannot substitute wording that the user never saw',async()=>{
  const accepted=[],f=fixture({onAccept:x=>accepted.push(x),request:(route,body,envelope)=>route.endsWith('/review')?{...envelope,surface:{...envelope.surface,title:'Different unseen wording'}}:envelope});
  try{f.submit();await f.settle();[...f.panel.element.querySelectorAll('button')].find(x=>x.textContent==='Use this view').click();await f.settle();assert.equal(accepted.length,0);assert.equal(f.panel.element.querySelector('.model-preview').hidden,true);}finally{f.cleanup();}
});
