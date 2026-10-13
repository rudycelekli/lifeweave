import type {ReactElement} from 'react';
import type {SurfaceFrame,SurfaceAction} from '@lifeweave/core';
export interface LifeweaveSurfaceProps {frame:SurfaceFrame;onAction?:(action:SurfaceAction,surface:SurfaceFrame)=>void;onScenarioChange?:(id:string,variables:Record<string,number>)=>void;className?:string}
export function LifeweaveSurface(props:LifeweaveSurfaceProps):ReactElement;
