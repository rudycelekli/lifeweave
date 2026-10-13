import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createDemoState,DEMO_CLOCK,compileIntent,detectContextGaps,resolveContextGap,recordContextCorrection,evaluate,capturePlanBaseline,buildSharedContext,buildOutcomeLedger} from '@lifeweave/core';
import {createIntentPanel,renderContext,renderOutcomes} from '../apps/web/workspace-tools.mjs';

const clone=value=>structuredClone(value),settle=()=>new Promise(resolve=>setImmediate(resolve));
function domFixture(){const dom=new JSDOM('<!doctype html><body></body>');for(const key of ['document','Element','HTMLElement','Event'])globalThis[key]=dom.window[key];return dom;}
const clickText=(root,text)=>{const target=[...root.querySelectorAll('button')].find(button=>button.textContent===text);assert(target,`button ${text} must exist`);target.click();};
const submit=(dom,form)=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
function ready(){const state=createDemoState(),result=compileIntent(state,{request:'Help me focus on my learning goal for 30 minutes'},{now:DEMO_CLOCK});return{workspace:'demo',previewId:'preview-test',...result};}

test('workspace tools make no startup requests or mutations; focus control starts collapsed',()=>{
  const dom=domFixture(),requests=[],mutations=[];try{
    const state=createDemoState(),snapshot={workspace:'demo',state,sharedContext:buildSharedContext(state,{now:DEMO_CLOCK}),ledger:buildOutcomeLedger(state,{now:DEMO_CLOCK}),gaps:[]};
    const panel=createIntentPanel({workspace:'demo',request:()=>requests.push('request'),isCurrent:()=>true,onAccept:()=>{throw new Error('No startup acceptance');}});
    document.body.append(panel.element,renderContext({snapshot,request:()=>requests.push('request'),mutate:()=>mutations.push('mutate'),isCurrent:()=>true,navigate:()=>{},announce:()=>{}}),renderOutcomes({snapshot,mutate:()=>mutations.push('mutate'),navigate:()=>{}}));
    assert.equal(panel.element.open,false);assert.equal(panel.pending,false);assert.deepEqual(requests,[]);assert.deepEqual(mutations,[]);panel.dispose();
  }finally{dom.window.close();}
});

test('sequential goal then time clarification sends exact question answers and fresh review before acceptance',async()=>{
  const dom=domFixture(),state=createDemoState(),calls=[],results=[],accepted=[];let latest;
  const request=async(route,body)=>{calls.push({route,body:clone(body)});if(route==='/api/intent/review'){assert.deepEqual(body,{previewId:'preview-live'});return clone(latest);}
    const result=compileIntent(state,body,{now:DEMO_CLOCK});results.push(clone(result));latest={workspace:'demo',...(result.status==='ready'?{previewId:'preview-live'}:{}),...result};return clone(latest);};
  const panel=createIntentPanel({workspace:'demo',request,isCurrent:()=>true,onAccept:value=>accepted.push(value)});document.body.append(panel.element);
  try{
    panel.element.querySelector('input').value='Help me focus for 1 hour';submit(dom,panel.element.querySelector('form'));await settle();
    assert.equal(results[0].question.kind,'goal');assert.equal(accepted.length,0);
    const goalChoice=results[0].question.choices.find(choice=>choice.value==='goal-learning');clickText(panel.element,goalChoice.label);await settle();
    assert.deepEqual(calls[1].body,{request:'Help me focus for 1 hour',answer:{questionId:results[0].question.id,value:'goal-learning'}});
    assert.equal(results[1].question.kind,'minutes');const minuteChoice=results[1].question.choices.find(choice=>choice.value===30);assert(minuteChoice);clickText(panel.element,minuteChoice.label);await settle();
    assert.deepEqual(calls[2].body,{request:'Help me focus for 1 hour',goalId:'goal-learning',answer:{questionId:results[1].question.id,value:30}});
    assert.equal(latest.status,'ready');assert.equal(latest.brief.minutes,30);assert.equal(accepted.length,0);
    clickText(panel.element,'Use this focus view');await settle();assert.equal(calls.at(-1).route,'/api/intent/review');assert.equal(accepted.length,1);assert.equal(accepted[0].previewId,'preview-live');
  }finally{panel.dispose();dom.window.close();}
});

test('disposed or changed workspace context refuses a late intent response',async()=>{
  for(const disposition of ['disposed','workspace-changed']){
    const dom=domFixture();let release,current=true;const accepted=[];
    const panel=createIntentPanel({workspace:'demo',request:()=>new Promise(resolve=>{release=resolve;}),isCurrent:()=>current,onAccept:value=>accepted.push(value)});document.body.append(panel.element);
    try{panel.element.querySelector('input').value='Help me focus on my learning goal';submit(dom,panel.element.querySelector('form'));assert.equal(panel.pending,true);
      if(disposition==='disposed')panel.dispose();else current=false;release(ready());await settle();
      assert.equal(accepted.length,0);assert.equal(panel.element.querySelector('.intent-preview').textContent,'');assert.equal(panel.pending,false);
    }finally{panel.dispose();dom.window.close();}
  }
});

test('wrong workspace, changed review content and revoked review never become accepted views',async()=>{
  for(const scenario of ['wrong-workspace','changed-review','rejected-review']){
    const dom=domFixture(),accepted=[],base=ready();const panel=createIntentPanel({workspace:'demo',isCurrent:()=>true,onAccept:value=>accepted.push(value),request:async route=>{
      if(scenario==='wrong-workspace')return{...clone(base),workspace:'business'};
      if(route.endsWith('/review')){if(scenario==='rejected-review')throw new Error('Private backend text must not be displayed');const changed=clone(base);changed.surface.title='A view the user never reviewed';return changed;}return clone(base);}});document.body.append(panel.element);
    try{panel.element.querySelector('input').value='Help me focus';submit(dom,panel.element.querySelector('form'));await settle();if(scenario!=='wrong-workspace'){clickText(panel.element,'Use this focus view');await settle();}
      assert.equal(accepted.length,0);assert.equal(panel.element.querySelector('.intent-preview').textContent,'');assert.doesNotMatch(panel.element.textContent,/Private backend text/);
    }finally{panel.dispose();dom.window.close();}
  }
});

test('stale context during an in-flight intent review refuses the late acceptance',async()=>{
  const dom=domFixture();let current=true,release;const accepted=[],base=ready();
  const panel=createIntentPanel({workspace:'demo',isCurrent:()=>current,onAccept:value=>accepted.push(value),request:route=>route.endsWith('/review')?new Promise(resolve=>{release=resolve;}):Promise.resolve(clone(base))});document.body.append(panel.element);
  try{panel.element.querySelector('input').value='Help me focus';submit(dom,panel.element.querySelector('form'));await settle();clickText(panel.element,'Use this focus view');assert.equal(panel.pending,true);current=false;release(clone(base));await settle();assert.equal(accepted.length,0);}
  finally{panel.dispose();dom.window.close();}
});

test('missing-fact preview requires explicit confirmation and records an overlay without rewriting raw evidence',async()=>{
  const dom=domFixture(),requests=[],mutations=[];let state=createDemoState();delete state.observations[0].data.completed;const raw=JSON.stringify(state.observations[0]);
  const gap=detectContextGaps(state,{goalId:'goal-career'},{now:DEMO_CLOCK}).find(item=>item.field==='completed');assert(gap);
  const snapshot={workspace:'demo',state,sharedContext:buildSharedContext(state,{now:DEMO_CLOCK}),gaps:[gap]};
  const section=renderContext({snapshot,isCurrent:()=>true,navigate:()=>{},announce:message=>{throw new Error(message);},request:async(route,body)=>{requests.push({route,body});return{workspace:'demo',...resolveContextGap(state,body,{now:DEMO_CLOCK})};},mutate:(route,body)=>{mutations.push({route,body});state=recordContextCorrection(state,{goalId:gap.goalId,observationId:gap.observationId,fields:{completed:body.value}},{now:DEMO_CLOCK});}});document.body.append(section);
  try{
    assert.equal(requests.length,0);assert.equal(mutations.length,0);const form=section.querySelector('.gap-form');form.querySelector('select').value='true';submit(dom,form);await settle();
    assert.equal(requests[0].route,'/api/context-gaps/resolve');assert.deepEqual(requests[0].body,{gapId:gap.id,value:true});assert.equal(mutations.length,0);assert.equal(JSON.stringify(state.observations[0]),raw);
    clickText(section,'Confirm and save my fact');assert.deepEqual(mutations[0],{route:'/api/context-gaps/confirm',body:{gapId:gap.id,value:true,confirmed:true}});
    assert.equal(JSON.stringify(state.observations[0]),raw);assert.equal(state.contextCorrections[0].fields.completed,true);
  }finally{dom.window.close();}
});

test('a disposed context confirmation cannot mutate a newly selected workspace',async()=>{
  const dom=domFixture();let current=true;const mutations=[],state=createDemoState();delete state.observations[0].data.completed;
  const gap=detectContextGaps(state,{goalId:'goal-career'},{now:DEMO_CLOCK}).find(item=>item.field==='completed');
  const section=renderContext({snapshot:{workspace:'demo',state,sharedContext:buildSharedContext(state,{now:DEMO_CLOCK}),gaps:[gap]},isCurrent:()=>current,navigate:()=>{},announce:()=>{},mutate:(...args)=>mutations.push(args),request:async()=>({workspace:'demo',status:'suggested'})});document.body.append(section);
  try{submit(dom,section.querySelector('.gap-form'));await settle();current=false;clickText(section,'Confirm and save my fact');assert.equal(mutations.length,0);}
  finally{dom.window.close();}
});

test('outcome form submits only explicit user report fields, no inferred or hidden measurement credit',()=>{
  const dom=domFixture(),state=createDemoState(),mutations=[];
  state.observations.push({id:'baseline-local',tenantId:'local',connectorId:'demo-manual',kind:'metric.update',occurredAt:'2026-10-13T15:00:00Z',goalIds:['goal-learning'],summary:'Measured learning time',metrics:{focusMinutes:10},data:{}});
  const frame=evaluate(state,{now:DEMO_CLOCK,mode:'replay'}).surfaces.find(item=>item.ruleId==='focus-opportunity');
  state.plans=[{id:'plan-workspace-test',tenantId:'local',surfaceId:frame.id,goalId:frame.goalId,actionId:'plan',intent:'plan-focus',text:'A local plan',focusMinutes:25,status:'draft',createdAt:DEMO_CLOCK,evidenceRefs:frame.evidenceRefs,baseline:capturePlanBaseline(state,{goalId:frame.goalId},{now:DEMO_CLOCK})}];
  state.observations.push({id:'later-local',tenantId:'local',connectorId:'demo-manual',kind:'metric.update',occurredAt:'2026-10-13T17:00:00Z',goalIds:['goal-learning'],summary:'A later supplied value',metrics:{focusMinutes:40},data:{}});
  const before=JSON.stringify(state),snapshot={workspace:'demo',state,sharedContext:buildSharedContext(state,{now:'2026-10-13T18:00:00Z'}),ledger:buildOutcomeLedger(state,{now:'2026-10-13T18:00:00Z'})};
  const section=renderOutcomes({snapshot,navigate:()=>{},mutate:(route,body)=>mutations.push({route,body})});document.body.append(section);
  try{assert.equal(mutations.length,0);const form=section.querySelector('form'),selects=form.querySelectorAll('select'),inputs=form.querySelectorAll('input');
    selects[0].value='useful';inputs[0].value='28';inputs[1].value='I made progress';submit(dom,form);
    assert.deepEqual(mutations[0],{route:'/api/outcomes',body:{planId:'plan-workspace-test',usefulness:'useful',effortMinutes:28,note:'I made progress'}});
    selects[1].value='later-local';submit(dom,form);assert.equal(mutations[1].body.measurementObservationId,'later-local');
    assert.deepEqual(Object.keys(mutations[1].body).sort(),['effortMinutes','measurementObservationId','note','planId','usefulness']);assert.equal(JSON.stringify(state),before);
    assert.match(section.textContent,/does not create a measurement/);assert.match(section.textContent,/No comparable later measurement/);
  }finally{dom.window.close();}
});

test('later-measurement choices omit raw future and expired-consent evidence that current shared context withholds',()=>{
  const dom=domFixture(),state=createDemoState(),at='2026-10-13T18:00:00Z';
  const frame=evaluate(state,{now:DEMO_CLOCK,mode:'replay'}).surfaces.find(item=>item.ruleId==='focus-opportunity');
  state.plans=[{id:'plan-choice-test',tenantId:'local',surfaceId:frame.id,goalId:frame.goalId,actionId:'plan',intent:'plan-focus',text:'A local draft',focusMinutes:25,status:'draft',createdAt:DEMO_CLOCK,evidenceRefs:frame.evidenceRefs}];
  state.connections.find(connection=>connection.id==='demo-health').expiresAt='2026-10-13T17:30:00Z';
  state.observations.push(
    {id:'expired-health',tenantId:'local',connectorId:'demo-health',kind:'health.sleep',occurredAt:'2026-10-13T17:00:00Z',goalIds:['goal-learning'],summary:'Private expired-consent health detail',metrics:{sleepHours:6},data:{}},
    {id:'future-measurement',tenantId:'local',connectorId:'demo-manual',kind:'metric.update',occurredAt:'2026-10-13T19:00:00Z',goalIds:['goal-learning'],summary:'This future value is unavailable',metrics:{focusMinutes:100},data:{}},
    {id:'eligible-later',tenantId:'local',connectorId:'demo-manual',kind:'metric.update',occurredAt:'2026-10-13T17:00:00Z',goalIds:['goal-learning'],summary:'Current later measurement',metrics:{focusMinutes:40},data:{}}
  );
  const snapshot={workspace:'demo',state,sharedContext:buildSharedContext(state,{now:at}),ledger:buildOutcomeLedger(state,{now:at})};
  const section=renderOutcomes({snapshot,navigate:()=>{},mutate:()=>{}});document.body.append(section);
  try{const selector=section.querySelector('form').querySelectorAll('select')[1],values=[...selector.options].map(option=>option.value);
    assert(values.includes('eligible-later'));assert(!values.includes('expired-health'));assert(!values.includes('future-measurement'));assert.doesNotMatch(section.textContent,/Private expired-consent health detail/);
  }finally{dom.window.close();}
});
