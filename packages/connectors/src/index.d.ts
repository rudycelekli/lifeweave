export interface AdapterOptions { tenantId: string; connectorId: string; goalIds: string[]; observedAt?: string }
export function normalizeGraphMail(response: unknown, options: AdapterOptions): Observation[];
export function normalizeGraphCalendar(response: unknown, options: AdapterOptions & {observedAt:string}): Observation[];
export function normalizeGmail(response: unknown, options: AdapterOptions): Observation[];
export function normalizeHealthExport(response: unknown, options: AdapterOptions): Observation[];
export function createGraphReader(options: {accessToken:string;fetchImpl?:typeof fetch}): {readMail():Promise<unknown>;readCalendar(window:{start:string;end:string}):Promise<unknown>};
export function emitAgUiSurface(surface: unknown, emit: (event: {type:'CUSTOM';name:'lifeweave.surface';value:unknown})=>void|Promise<void>): Promise<void>;
export const integrationCatalog: ReadonlyArray<{id:string;name:string;category:string;status:string;scope:string;mode:string;note:string}>;
import type {Observation} from '@lifeweave/core';
export type {Observation} from '@lifeweave/core';
