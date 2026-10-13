import { validateSurface, evaluateExpression } from '@lifeweave/core';

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
const display = (value, unit = '') => value === null || value === undefined ? 'Unknown' : `${Number(value).toLocaleString(undefined,{maximumFractionDigits:2})}${unit ? ` ${unit}` : ''}`;

export const defaultRegistry = Object.freeze({
  calculator(block,{onScenarioChange=()=>{}}={}) {
    const section=node('section',undefined,'lw-calculator');section.append(node('h3',block.label));
    const variables=Object.fromEntries(block.inputs.map(input=>[input.id,input.value]));
    const fields=node('div',undefined,'lw-calculator-inputs'),outputList=node('div',undefined,'lw-calculator-outputs');
    const outputs=block.outputs.map(output=>{const row=node('div');row.append(node('span',output.label));const value=node('output');row.append(value);outputList.append(row);return {output,value};});
    const update=()=>{for(const {output,value} of outputs){try{value.textContent=display(evaluateExpression(output.expression,variables),output.unit);}catch{value.textContent='Choose valid values';}}onScenarioChange(block.id||block.label,{...variables});};
    for(const definition of block.inputs){const label=node('label');label.append(node('span',`${definition.label} (${definition.unit})`));const input=node('input');input.type='number';input.min=String(definition.min);input.max=String(definition.max);input.step=String(definition.step||1);input.value=String(definition.value);input.addEventListener('input',()=>{const value=input.value===''?NaN:Number(input.value);const valid=Number.isFinite(value)&&value>=definition.min&&value<=definition.max;input.setAttribute('aria-invalid',String(!valid));variables[definition.id]=valid?value:NaN;update();});label.append(input);fields.append(label);}
    section.append(fields,outputList,node('p','Explore a plan. These values do not change your measured progress.','lw-muted'));update();return section;
  },
  text(block) { return node('p', block.text, 'lw-text'); },
  metric(block) {
    const el = node('div', undefined, 'lw-metric');
    el.append(node('span', block.label, 'lw-label'), node('strong', display(block.value,block.unit)));
    if (block.target !== undefined) el.append(node('span', `Chosen target: ${display(block.target,block.unit)}`, 'lw-muted'));
    return el;
  },
  checklist(block) {
    const el = node('ul', undefined, 'lw-checklist');
    for (const item of block.items) {
      const li = node('li');
      li.append(node('span', item.done ? '✓' : '○','lw-check'),node('span',item.text));
      el.append(li);
    }
    return el;
  },
  timeline(block) {
    const el = node('ol', undefined, 'lw-timeline');
    for (const item of block.items) {
      const li = node('li');
      const time = node('time',new Date(item.at).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}));
      time.dateTime = item.at;
      li.append(time,node('span',item.label));el.append(li);
    }
    return el;
  },
  trend(block) {
    const el = node('figure',undefined,'lw-trend');
    el.append(node('figcaption',block.label));
    const points=block.points;
    if (!points.length) { el.append(node('p','No observations yet.'));return el; }
    const values=points.map(point=>point.value),low=Math.min(...values),high=Math.max(...values);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 520 125');svg.setAttribute('role','img');
    svg.setAttribute('aria-label', `${block.label}: ${points.map(p=>display(p.value,block.unit)).join(', ')}`);
    const line=document.createElementNS(svg.namespaceURI,'polyline');
    line.setAttribute('points',points.map((p,i)=>`${20+i*480/Math.max(1,points.length-1)},${high===low?62:105-(p.value-low)/(high-low)*85}`).join(' '));
    line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','3');svg.append(line);
    el.append(svg);
    const labels=node('div',undefined,'lw-trend-labels');
    for (const p of points) labels.append(node('span',`${new Date(p.at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}: ${display(p.value,block.unit)}`));
    el.append(labels);return el;
  }
});

/** The trusted host may override renderers for known schema types. Data never registers executable code. */
export function renderSurface(surface, { registry = defaultRegistry, onAction = () => {}, onScenarioChange=()=>{} } = {}) {
  const result=validateSurface(surface);
  if (!result.valid) throw new Error(`Invalid SurfaceFrame: ${result.issues.join('; ')}`);
  const el=node('article',undefined,'lw-surface');
  el.dataset.surfaceId=surface.id;
  el.append(node('p',surface.dimension,'lw-eyebrow'),node('h2',surface.title),node('p',surface.reason,'lw-reason'));
  const blocks=node('div',undefined,'lw-blocks');
  for (const block of surface.blocks) {
    if (typeof registry[block.type] !== 'function') throw new Error(`No renderer for ${block.type}`);
    const rendered=registry[block.type](block,{onScenarioChange});
    if (!(rendered instanceof Element)) throw new Error('Renderer must return an Element');
    blocks.append(rendered);
  }
  el.append(blocks);
  const actions=node('div',undefined,'lw-actions');
  for (const action of surface.actions) {
    const button=node('button',action.label,action.kind==='external'?'lw-button secondary':'lw-button');
    button.type='button';
    if(action.kind==='external') {button.disabled=true;button.title='External executor is not configured. Review through your host.';}
    button.addEventListener('click',()=>onAction(structuredClone(action),structuredClone(surface)));
    actions.append(button);
  }
  el.append(actions);
  return el;
}

export function defineLifeweaveElement(name = 'lifeweave-surface') {
  if (typeof customElements === 'undefined' || customElements.get(name)) return;
  class LifeweaveSurface extends HTMLElement {
    #frame;
    set frame(value) { this.#frame=value;this.render(); }
    get frame() { return this.#frame; }
    connectedCallback() {this.render();}
    render() {
      if(!this.#frame)return;
      this.replaceChildren(renderSurface(this.#frame,{onAction:(action,surface)=>this.dispatchEvent(new CustomEvent('lifeweave-action',{detail:{action,surface},bubbles:true})),onScenarioChange:(id,variables)=>this.dispatchEvent(new CustomEvent('lifeweave-scenario',{detail:{id,variables},bubbles:true}))}));
    }
  }
  customElements.define(name,LifeweaveSurface);
}

/** JSON input only. No generated HTML, JSX, scripts, network URLs or eval are accepted. */
export function parseSurfaceFrame(serialized) {
  if(typeof serialized!=='string'||serialized.length>100000)throw new Error('SurfaceFrame payload must be bounded JSON');
  const value=JSON.parse(serialized);
  const result=validateSurface(value);
  if(!result.valid)throw new Error(result.issues.join('; '));
  return value;
}
