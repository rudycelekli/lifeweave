import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createElement,act} from 'react';
import {createRoot} from 'react-dom/client';
import {createDemoState,evaluate,DEMO_CLOCK} from '@lifeweave/core';
import {renderSurface,parseSurfaceFrame,defineLifeweaveElement} from '@lifeweave/ui';
import {LifeweaveSurface} from '@lifeweave/ui/react';

function setup(){const dom=new JSDOM('<!doctype html><html><body></body></html>');for(const key of ['document','Element','HTMLElement','customElements','CustomEvent','Event','window'])globalThis[key]=dom.window[key];globalThis.IS_REACT_ACT_ENVIRONMENT=true;return dom;}
const frames=()=>evaluate(createDemoState(),{now:DEMO_CLOCK,mode:'replay'}).surfaces;

test('untrusted surface text renders as text without active markup',()=>{
  const dom=setup(),frame=frames()[0];frame.title='<img src=x onerror=alert(1)>';frame.blocks.push({type:'text',text:'<script>steal()</script>'});
  const output=renderSurface(frame);assert.equal(output.querySelector('img'),null);assert.equal(output.querySelector('script'),null);assert.match(output.textContent,/<script>/);dom.window.close();
});
test('unknown executable blocks and excessive JSON cannot enter the renderer',()=>{
  const dom=setup(),frame=frames()[0];frame.blocks.push({type:'html',html:'<script>run()</script>'});assert.throws(()=>renderSurface(frame),/unsupported/);assert.throws(()=>parseSurfaceFrame('x'.repeat(100001)),/bounded/);dom.window.close();
});
test('scenario controls recompute bounded output and never mutate measured input frame',()=>{
  const dom=setup(),frame=frames().find(f=>f.ruleId==='focus-opportunity'),original=JSON.stringify(frame),calls=[];
  const output=renderSurface(frame,{onScenarioChange:(id,variables)=>calls.push({id,variables})});const input=output.querySelector('.lw-calculator input');
  assert.ok(input);assert.match(output.querySelector('output').textContent,/35 minutes/);
  input.value='40';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.match(output.querySelector('output').textContent,/20 minutes/);
  input.value='999';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(input.getAttribute('aria-invalid'),'true');assert.equal(output.querySelector('output').textContent,'Choose valid values');
  input.value='';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(output.querySelector('output').textContent,'Choose valid values');assert.equal(JSON.stringify(frame),original);assert.ok(calls.length>=3);dom.window.close();
});
test('external actions remain disabled while local callback receives data copies',()=>{
  const dom=setup(),frame=frames()[0],calls=[];frame.actions.push({id:'send',label:'Send mail',kind:'external',capability:'mail.send',requiresApproval:true,payload:{draftId:'d1'}});
  const output=renderSurface(frame,{onAction:(action,surface)=>{calls.push(action.id);surface.title='mutated';}});
  const buttons=[...output.querySelectorAll('button')];assert.equal(buttons.at(-1).disabled,true);buttons.at(-1).click();assert.equal(calls.length,0);buttons[0].click();assert.equal(calls.length,1);assert.notEqual(frame.title,'mutated');dom.window.close();
});
test('Web Component exposes action/scenario events and safely replaces old frames',()=>{
  const dom=setup();defineLifeweaveElement('lifeweave-test');const host=document.createElement('lifeweave-test'),actions=[];host.addEventListener('lifeweave-action',event=>actions.push(event.detail));document.body.append(host);host.frame=frames()[0];host.querySelector('button').click();assert.equal(actions.length,1);host.frame=frames()[1];assert.equal(host.querySelectorAll('article').length,1);assert.ok(host.querySelector('input'));dom.window.close();
});
test('React adapter renders, updates and unmounts the same trusted renderer',async()=>{
  const dom=setup(),container=document.createElement('div');document.body.append(container);const root=createRoot(container),frame=frames()[0];
  await act(async()=>root.render(createElement(LifeweaveSurface,{frame})));assert.equal(container.querySelector('h2').textContent,frame.title);
  const next={...frame,title:'Updated evidence-backed proposal'};await act(async()=>root.render(createElement(LifeweaveSurface,{frame:next})));assert.equal(container.querySelectorAll('article').length,1);assert.equal(container.querySelector('h2').textContent,next.title);
  await act(async()=>root.unmount());assert.equal(container.textContent,'');dom.window.close();
});
