import { renderSurface } from '../../packages/ui/src/index.mjs';

const element=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const messages={
  'model-not-configured':'A local model has not been connected yet.',
  'request-budget-exhausted':'The local model request allowance has been used. The original view is still available.',
  'timeout':'The local model took too long. Your original view is still available.',
  'grounding-changed':'The evidence changed while this view was being prepared. Refresh and try with current evidence.',
  'proposal-not-found':'This preview is no longer available. Request a fresh view.',
  'proposal-expired':'This preview has expired. Request a fresh view.',
};

/** A temporary presentation preview. The host owns current-context checks and acceptance. */
export function createRequestPanel({surface,workspace,status,request,isCurrent,onAccept,onSettings}) {
  const root=element('details',undefined,'request-panel');
  root.append(element('summary','Ask for a different view'));
  let disposed=false,pending=false,previewRevision=0;
  const validContext=()=>!disposed&&isCurrent();
  const feedback=element('p','', 'request-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  if(!status?.configured){
    root.append(element('p','Connect a local model to request clearer wording or a different layout. Proactive suggestions work without one.'));
    const settings=element('button','Local model settings','text-button');settings.type='button';settings.addEventListener('click',()=>{if(validContext())onSettings();});root.append(settings);
    return {element:root,dispose(){disposed=true;},get pending(){return false;}};
  }
  const form=element('form',undefined,'request-form'),label=element('label',undefined,'field');
  label.append(element('span','What would make this easier to use?'));
  const input=element('textarea');input.rows=2;input.maxLength=2000;input.required=true;input.placeholder='For example: put the scenario first and shorten the explanation.';label.append(input);
  const submit=element('button','Create another view','button secondary');submit.type='submit';submit.disabled=status.remainingRequests===0;
  form.append(label,submit,feedback);root.append(element('p','Your request, this goal and its suggestion go to the model service configured on this device. Raw source records stay out. Measurements and available actions stay fixed.','fineprint'),form);
  const preview=element('section',undefined,'model-preview');preview.setAttribute('aria-label','Requested view preview');preview.hidden=true;root.append(preview);
  if(status.remainingRequests===0)feedback.textContent=messages['request-budget-exhausted'];
  const report=error=>{feedback.textContent=messages[error?.code]||'The requested view could not be verified. Your original view is still available.';};
  function display(result){
    if(!result||result.workspace!==workspace||result.requiresReview!==true||result.surface?.id!==surface.id||result.surface?.goalId!==surface.goalId||typeof result.proposalId!=='string')throw new Error('invalid-proposal');
    // Preview controls are inspectable, but action execution remains with the original host canvas.
    const frame=structuredClone(result.surface);frame.actions=[];
    const rendered=renderSurface(frame);
    const revision=++previewRevision;
    preview.replaceChildren(element('p','Requested view · review the wording','eyebrow'),rendered,element('p','The local model can still phrase something poorly. Review it before using this view.','fineprint'));
    const actions=element('div',undefined,'form-actions'),accept=element('button','Use this view','button'),discard=element('button','Keep the original','text-button');accept.type=discard.type='button';
    accept.addEventListener('click',async()=>{
      if(pending||!validContext())return;pending=true;accept.disabled=true;submit.disabled=true;
      try{
        const checked=await request('/api/model-proposals/review',{proposalId:result.proposalId});
        if(!validContext()||revision!==previewRevision)return;
        if(checked?.workspace!==workspace||checked?.proposalId!==result.proposalId||checked?.requiresReview!==true||checked?.surface?.id!==surface.id||checked?.surface?.goalId!==surface.goalId||JSON.stringify(checked.surface)!==JSON.stringify(result.surface))throw new Error('invalid-proposal');
        // Validate again locally before letting a fresh, host-checked frame reach the canvas.
        renderSurface(checked.surface);
        onAccept(checked);
      }catch(error){if(validContext()&&revision===previewRevision){preview.replaceChildren();preview.hidden=true;report(error);}}
      finally{pending=false;accept.disabled=false;submit.disabled=false;}
    });
    discard.addEventListener('click',()=>{previewRevision++;preview.replaceChildren();preview.hidden=true;feedback.textContent='Original view kept.';});actions.append(accept,discard);preview.append(actions);preview.hidden=false;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending||!validContext())return;
    if(!input.value.trim()||input.value.length>2000){feedback.textContent='Write a brief request for this suggestion.';return;}
    pending=true;submit.disabled=true;input.disabled=true;preview.hidden=true;feedback.textContent='Preparing a view with your local model…';
    try{
      const result=await request('/api/model-proposals',{surfaceId:surface.id,request:input.value.trim()});
      if(!validContext())return;
      display(result);feedback.textContent='A preview is ready. Your original view stays in place until you choose it.';
    }catch(error){if(validContext())report(error);}
    finally{pending=false;submit.disabled=false;input.disabled=false;}
  });
  return {element:root,dispose(){disposed=true;previewRevision++;preview.replaceChildren();preview.hidden=true;},get pending(){return pending;}};
}
