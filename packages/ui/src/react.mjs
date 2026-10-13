import { createElement, useEffect, useRef } from 'react';
import { renderSurface } from './index.mjs';

/** Optional React adapter. Rendering stays within the trusted declarative registry. */
export function LifeweaveSurface({frame,onAction,onScenarioChange,className}) {
  const root=useRef(null);
  useEffect(()=>{
    if(root.current&&frame)root.current.replaceChildren(renderSurface(frame,{onAction,onScenarioChange}));
    return ()=>root.current?.replaceChildren();
  },[frame,onAction,onScenarioChange]);
  return createElement('div',{ref:root,className});
}
