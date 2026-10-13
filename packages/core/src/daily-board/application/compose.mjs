import {evaluate} from '../../proactive-planning/application/evaluate.mjs';
import {isRecord,cloneJson,ValidationError} from '../../shared/validation.mjs';
import {nowDate,localParts} from '../../shared/time.mjs';
import {selectCurrentMoves} from '../domain/selection.mjs';

function optionsInput(options) {
  if(!isRecord(options))throw new ValidationError(['dailyBoard.options: object required']);
  const descriptors=Object.getOwnPropertyDescriptors(options);
  for(const key of Reflect.ownKeys(descriptors)) {
    if(typeof key!=='string'||!['now','mode','limit'].includes(key)||!('value'in descriptors[key])||!descriptors[key].enumerable)throw new ValidationError(['dailyBoard.options: only plain now, mode and limit fields are allowed']);
  }
  const {now,mode='live',limit=3}=options;
  if(!['live','replay'].includes(mode))throw new ValidationError(['dailyBoard.mode: live or replay required']);
  if(!Number.isInteger(limit)||limit<1||limit>3)throw new ValidationError(['dailyBoard.limit: integer 1 to 3 required']);
  return {now,mode,limit};
}

/** A transient board drawn ONLY from evaluated current policy surfaces.
 * No gap nagging, measurement generation, delivery receipts, or state writes. */
export function composeDailyBoard(state,options={}) {
  const {now,mode,limit}=optionsInput(options),at=nowDate(now);
  const evaluation=evaluate(state,{now:at,mode});
  const selected=selectCurrentMoves(evaluation.surfaces,limit);
  let status,reason,brief;
  if(!evaluation.stats.activeGoals) {
    status='onboarding';reason='no-active-goals';brief='Choose an active goal to begin.';
  }else if(selected.length) {
    status='ready';reason='current-moves';
    const title=selected[0].title.length>120?`${selected[0].title.slice(0,117)}…`:selected[0].title;
    brief=`Start with “${title}”.${selected.length>1?` ${selected.length-1} other current ${selected.length===2?'move is':'moves are'} available.`:''}`;
  }else {
    status='quiet';
    if(mode==='live'&&evaluation.stats.quietHours) {
      reason='quiet-hours';brief='Your quiet hours are active. No new moves are shown.';
    }else if(mode==='live'&&(state.preferences.dailySurfaceBudget===0||evaluation.suppressed.some(item=>item.reason==='attention-budget'))) {
      reason='attention-budget';brief='Your current attention budget leaves no new move to show.';
    }else {
      reason='no-current-moves';brief='No current move has passed your evidence and attention checks.';
    }
  }
  return {version:1,tenantId:state.tenantId,at:at.toISOString(),localDay:localParts(at,state.preferences.timezone).day,timezone:state.preferences.timezone,mode,
    status,reason,brief,primary:selected.length?cloneJson(selected[0]):null,supporting:cloneJson(selected.slice(1)),surfaceIds:selected.map(item=>item.id),
    hiddenCount:Math.max(0,evaluation.surfaces.length-selected.length),eligibleCount:evaluation.surfaces.length};
}
