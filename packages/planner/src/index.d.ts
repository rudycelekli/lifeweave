import type { State, SurfaceFrame, Clock } from '@lifeweave/core';

export interface ModelPlannerConfig {
  endpoint: string;
  model: string;
  /** Host-owned credential, sent only as an authorization header to the approved endpoint. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** Remote HTTPS requires both explicit flags. Defaults keep all requests on loopback HTTP. */
  allowRemote?: boolean;
  allowDisclosure?: boolean;
  /** Lifetime attempt cap per adapter instance, integer 0..10, default 1; errors consume attempts. */
  maxRequests?: number;
  timeoutMs?: number;
  /** Host clock read both before and after transport; never derive from evidence/model output. */
  clock?: () => Clock;
}
export interface ModelProposalInput {
  state: State;
  goalId: string;
  surfaceId?: string;
  request: string;
  now?: Clock;
  /** Explicit host-owned user intent; bypasses display quiet/budget/delivery gates only. Default false. */
  interactive?: boolean;
  /** Per-call host clock overrides the configured clock. */
  clock?: () => Clock;
  /** Latest host state getter observes replacement-style writes during the model await. */
  getCurrentState?: () => State;
}
export interface ModelProposal {
  surface: SurfaceFrame;
  provenance: { kind: 'model-proposal'; model: string; requestCount: number; validatedAt?: string };
  requiresReview: true;
}
export interface ModelPlanner {
  propose(input: ModelProposalInput): Promise<ModelProposal>;
  readonly requestCount: number;
  readonly configuration: { readonly transport: 'loopback-http' | 'approved-remote-https'; readonly model: string; readonly maxRequests: number; readonly timeoutMs: number };
}
export class ModelPlannerError extends Error { constructor(code: string); readonly code: string }
export function createModelPlanner(config: ModelPlannerConfig): ModelPlanner;
export function revalidateModelProposal(proposal: ModelProposal, context: { state: State; baseSurface: SurfaceFrame; goalSnapshot?: State['goals'][number]; now?: Clock; interactive?: boolean }): ModelProposal;
