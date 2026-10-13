import type {SurfaceFrame,SurfaceBlock,SurfaceAction} from '@lifeweave/core';
export type RendererRegistry = Record<string,(block: SurfaceBlock,options?:{onScenarioChange?:(id:string,variables:Record<string,number>)=>void})=>Element>;
export const defaultRegistry: RendererRegistry;
export function renderSurface(surface:SurfaceFrame,options?:{registry?:RendererRegistry;onAction?:(action:SurfaceAction,surface:SurfaceFrame)=>void;onScenarioChange?:(id:string,variables:Record<string,number>)=>void}):HTMLElement;
export function defineLifeweaveElement(name?:string):void;
export function parseSurfaceFrame(serialized:string):SurfaceFrame;
