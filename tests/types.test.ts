import {createDemoState,evaluate,evaluateExpression,type SurfaceFrame,type Expr} from '@lifeweave/core';
import {renderSurface,parseSurfaceFrame} from '@lifeweave/ui';
import {LifeweaveSurface} from '@lifeweave/ui/react';
import {normalizeHealthExport,createGraphReader,emitAgUiSurface} from '@lifeweave/connectors';
import {createModelPlanner,type ModelProposal} from '@lifeweave/planner';
const state=createDemoState();
const surface:SurfaceFrame=evaluate(state,{mode:'replay'}).surfaces[0];
renderSurface(surface,{onAction:(action,frame)=>{const id:string=action.id;const title:string=frame.title;void[id,title];}});
parseSurfaceFrame(JSON.stringify(surface));
LifeweaveSurface({frame:surface,onScenarioChange:(id,variables)=>{void[id,variables];}});
const expr:Expr={op:'subtract',args:[60,{var:'minutes'}]};
const result:number=evaluateExpression(expr,{minutes:25});void result;
normalizeHealthExport([],{tenantId:'local',connectorId:'health',goalIds:['wellbeing']});
createGraphReader({accessToken:'host-owned'});
emitAgUiSurface(surface,async event=>{const type:'CUSTOM'=event.type;void type;});
const planner=createModelPlanner({endpoint:'http://127.0.0.1:11434/v1/chat/completions',model:'host-owned-model',maxRequests:0});
const proposal:Promise<ModelProposal>=planner.propose({state,goalId:'goal-learning',request:'Create a clearer layout',interactive:true});void proposal;
// @ts-expect-error Arbitrary code is not a supported UI block.
const executable:SurfaceFrame['blocks'][number]={type:'html',html:'<script>alert(1)</script>'};
// @ts-expect-error Unknown expression operators do not compile.
const unsafe:Expr={op:'eval',args:['process.exit()']};
void[executable,unsafe];

import {composeDailyBoard,compileAssistantResponse,validateAssistantResponse,type DailyBoard,type AssistantResponse} from '@lifeweave/core';
const board:DailyBoard=composeDailyBoard(state,{mode:'replay',limit:3});
const response:AssistantResponse=compileAssistantResponse(state,{request:'How am I doing?'});
const grounded:boolean=validateAssistantResponse(response,state).valid;
void[board.surfaceIds,response.facts,grounded];
// @ts-expect-error Daily boards cannot expose an unbounded fourth proactive move.
composeDailyBoard(state,{limit:4});
// @ts-expect-error A request cannot grant external execution authority.
compileAssistantResponse(state,{request:'What is next?',execute:true});
