/** Inert JSON data. Evidence text never grants capability, consent, or goal authority. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type GoalStatus = 'active' | 'candidate' | 'paused';
export type GoalDimension = 'career' | 'wellbeing' | 'relationships' | 'learning' | 'finances' | 'personal' | 'community' | (string & {});
export type ReadScope = 'mail.read' | 'calendar.read' | 'health.sleep.read' | 'contacts.read' | 'manual.read';
export type ActionCapability = 'mail.send' | 'calendar.write' | 'contacts.write' | 'computer.use';
export type CapabilityScope = ReadScope | ActionCapability | (string & {});
export type ObservationKind = 'mail.message' | 'mail.commitment' | 'calendar.event' | 'calendar.availability' | 'health.sleep' | 'relationship.contact' | 'metric.update' | 'manual.note';
export type RuleId = 'overdue-commitment' | 'focus-opportunity' | 'sleep-reflection' | 'relationship-catchup' | 'metric-checkin';
export type FeedbackKind = 'done' | 'dismiss' | 'snooze';
export type EvaluationMode = 'live' | 'replay';
export type Clock = string | Date;

export interface GoalMetric { key: string; target: number; unit: string; direction: 'increase' | 'decrease' }
export interface GoalSource { kind: string; date: string; ref: string; [key: string]: JsonValue }
export interface Goal {
  id: string;
  title: string;
  dimension: GoalDimension;
  /** Only active goals can produce surfaces. Historical imports should start as candidate. */
  status: GoalStatus;
  /** User-defined relative priority, 0 to 100. */
  priority: number;
  metric?: GoalMetric;
  source?: GoalSource;
}

export interface Observation {
  id: string;
  tenantId: string;
  connectorId: string;
  kind: ObservationKind;
  occurredAt: string;
  /** Explicit links; never inferred from narrative text. */
  goalIds: string[];
  summary: string;
  /** Values must be finite, supplied measurements; missing values are unknown. */
  metrics?: Record<string, number>;
  data?: Record<string, JsonValue>;
}
export interface CommitmentObservation extends Observation {
  kind: 'mail.commitment';
  data: { dueAt: string; completed: boolean; [key: string]: JsonValue };
}
export interface AvailabilityObservation extends Observation {
  kind: 'calendar.availability';
  data: { startsAt: string; endsAt: string; available: boolean; [key: string]: JsonValue };
}
export interface SleepObservation extends Observation {
  kind: 'health.sleep';
  metrics: { sleepHours: number; [key: string]: number };
}
export interface ContactObservation extends Observation {
  kind: 'relationship.contact';
  data: { lastContactAt: string; personLabel?: string } & Record<string, JsonValue>;
}

export interface Connection {
  id: string;
  provider: string;
  status: 'connected' | 'disconnected';
  scopes: CapabilityScope[];
  /** Required when connected. Consent is checked again on every evaluation. */
  consentAt?: string;
  expiresAt?: string;
  tenantId?: string;
  synthetic?: boolean;
}
export interface Preferences {
  timezone: string;
  /** Local hours using IANA timezone/DST rules. Equal start/end disables quiet hours. */
  quietHours: { start: number; end: number };
  /** Integer 0 to 20. Durability requires recordSurfaceDelivery after actual rendering. */
  dailySurfaceBudget: number;
}
export interface FeedbackReceipt {
  surfaceId: string;
  kind: FeedbackKind;
  at: string;
  until?: string;
  tenantId?: string;
  goalId?: string;
  ruleId?: RuleId;
  evidenceRefs?: string[];
}
export interface DeliveryReceipt { surfaceId: string; at: string; tenantId: string }
export interface ContextEntity { id: string; tenantId: string; kind: 'person' | 'project'; label: string; goalIds: string[] }
/** Numeric value comes from the exact source. Units/target are a captured user goal declaration. */
export interface Measurement { observationId: string; key: string; value: number; unit: string; direction: 'increase' | 'decrease'; target: number; observedAt: string; unitSource: 'goal-declared' }
export interface LocalDraft {
  id: string; tenantId: string; surfaceId: string; goalId: string; actionId: string;
  intent: 'open-evidence' | 'draft-reply' | 'plan-focus' | 'reflect-sleep' | 'draft-catchup' | 'plan-step';
  text: string; focusMinutes?: number; requestedMinutes?: number; status: 'draft'; createdAt: string; evidenceRefs: string[];
  baseline?: Measurement; contextSnapshot?: { entityIds: string[] };
}
export interface OutcomeReceipt { id: string; tenantId: string; planId: string; at: string; kind: 'user-report'; note?: string; effortMinutes?: number; usefulness: 'useful' | 'not-useful' | 'unknown'; measurementObservationId?: string; attribution: 'not-established' }
export interface GapFeedback { gapId: string; kind: 'pause' | 'snooze'; at: string; until?: string; tenantId: string; goalId: string }
export interface ContextCorrection { id: string; tenantId: string; goalId: string; observationId: string; fields: { dueAt?: string; completed?: boolean }; at: string; sourceFingerprint: string }
export interface State {
  version: 1;
  tenantId: string;
  goals: Goal[];
  observations: Observation[];
  connections: Connection[];
  preferences: Preferences;
  feedback: FeedbackReceipt[];
  deliveries?: DeliveryReceipt[];
  contextEntities?: ContextEntity[];
  plans?: LocalDraft[];
  outcomes?: OutcomeReceipt[];
  gapFeedback?: GapFeedback[];
  contextCorrections?: ContextCorrection[];
  fixture?: { synthetic: boolean; clock: string; description: string };
}

export interface TextBlock { type: 'text'; id?: string; text: string }
export interface MetricBlock { type: 'metric'; id?: string; label: string; value: number | null; target?: number; unit: string }
export interface ChecklistBlock { type: 'checklist'; id?: string; items: { id: string; text: string; done: boolean }[] }
export interface TimelineBlock { type: 'timeline'; id?: string; items: { at: string; label: string }[] }
export interface TrendBlock { type: 'trend'; id?: string; label: string; unit: string; points: { at: string; value: number }[] }
/** Bounded arithmetic DSL: depth at most 6; finite values; no code or host globals. */
export type Expr = number | { var: string } | { op: 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max'; args: Expr[] };
export interface CalculatorInput { id: string; label: string; value: number; min: number; max: number; step?: number; unit: string }
export interface CalculatorOutput { id: string; label: string; unit: string; expression: Expr }
/** Scenario only: local input perturbations do not update goals or measured evidence. */
export interface CalculatorBlock { type: 'calculator'; id?: string; label: string; inputs: CalculatorInput[]; outputs: CalculatorOutput[] }
export type SurfaceBlock = TextBlock | MetricBlock | ChecklistBlock | TimelineBlock | TrendBlock | CalculatorBlock;
export interface LocalAction { id: string; label: string; kind: 'local'; payload?: Record<string, JsonValue>; capability?: never; requiresApproval?: never }
/** Declaration only. Core never executes an external action. The host must recheck authority and approve. */
export interface ExternalAction { id: string; label: string; kind: 'external'; capability: ActionCapability; payload?: Record<string, JsonValue>; requiresApproval: true }
export type SurfaceAction = LocalAction | ExternalAction;
export interface SurfaceFrame {
  version: 1;
  id: string;
  goalId: string;
  dimension: GoalDimension;
  title: string;
  reason: string;
  priority: number;
  /** Fixed rule evidence-sufficiency heuristic; not a calibrated probability or outcome prediction. */
  confidence: number;
  evidenceRefs: string[];
  createdAt: string;
  expiresAt: string;
  status: 'active';
  blocks: SurfaceBlock[];
  actions: SurfaceAction[];
  ruleId?: RuleId;
  sourceKind?: ObservationKind;
}
export interface ValidationResult { valid: boolean; issues: string[] }
export class ValidationError extends Error { constructor(issues: string[]); readonly issues: string[] }
export interface Suppression { id: string; goalId?: string; ruleId?: RuleId; reason: string; evidenceRefs: string[] }
export interface EvaluationStats {
  mode: EvaluationMode;
  evaluatedAt: string;
  tenantId: string;
  goals: number;
  activeGoals: number;
  observations: number;
  eligibleObservations: number;
  candidates: number;
  published: number;
  suppressed: number;
  quietHours: boolean;
  dailySurfaceBudget: number;
  deliveredToday: number;
  dailyBudgetRemaining: number;
  costUsd: null;
  planner: 'deterministic-rules-v1';
}
export interface Evaluation { surfaces: SurfaceFrame[]; suppressed: Suppression[]; stats: EvaluationStats }
export interface ClockOptions { now?: Clock }
export interface EvaluationOptions extends ClockOptions { mode?: EvaluationMode }
export interface FeedbackInput { surfaceId: string; kind: FeedbackKind; until?: string }
export interface CapabilityDecision { allowed: boolean; reason: string }
export interface ConnectorCatalogEntry {
  id: string;
  provider: string;
  availability: 'implemented' | 'configuration-required';
  mode: 'local-json' | 'oauth' | 'host-mediated';
  status: 'disconnected';
  readScopes: readonly ReadScope[];
  writeScopes: readonly ActionCapability[];
  description: string;
}

/** Shape check only; does not assert current consent, freshness, or delivered outcome. */
export function validateState(state: unknown): ValidationResult;
/** Rejects arbitrary blocks, executable fields, unknown render fields, and unsafe JSON. */
export function validateSurface(surface: unknown): ValidationResult;
/** Throws ValidationError on unsafe AST, unknown variable, zero divisor, or nonfinite result. */
export function evaluateExpression(expression: Expr, variables: Record<string, number>): number;
/** Pure evaluation. replay bypasses only quiet hours, budget, and prior delivery gates. */
export function evaluate(state: State, options?: EvaluationOptions): Evaluation;
/** Immutable, atomic, scope-checked ingestion. Throws ValidationError on any invalid input. */
export function ingestObservations(state: State, observations: Observation[], options?: ClockOptions): State;
/** Immutable local feedback; done does not claim to send or fulfill external commitments. */
export function applyFeedback(state: State, feedback: FeedbackInput, options?: ClockOptions): State;
/** Persist after actual rendering; only currently live-eligible surfaces can be acknowledged. */
export function recordSurfaceDelivery(state: State, surfaceIds: string[], options?: ClockOptions): State;
export function createDemoState(nowISO?: Clock): State;
/** Consent eligibility only. This never grants per-action approval or executes a capability. */
export function canUseCapability(state: State, connectorId: string, capability: ActionCapability, options?: ClockOptions): CapabilityDecision;
export const DEMO_CLOCK: string;
export const RULES: readonly { readonly id: RuleId; readonly kind: ObservationKind; readonly description: string }[];
export const OBSERVATION_POLICIES: Readonly<Record<ObservationKind, Readonly<{ scope: ReadScope; maxAgeMs: number }>>>;
export const ACTION_CAPABILITIES: readonly ActionCapability[];
export const CONNECTOR_CATALOG: readonly ConnectorCatalogEntry[];

export interface SharedGoalContext { goal: Pick<Goal,'id'|'title'|'dimension'|'metric'>; evidence: Observation[]; latestMeasurement: Measurement | null; people: ContextEntity[]; projects: ContextEntity[] }
export interface SharedContext { tenantId: string; at: string; goals: SharedGoalContext[]; withheld: { id: string; reason: string }[] }
export interface OutcomeInput { planId: string; note?: string; effortMinutes?: number; usefulness?: 'useful'|'not-useful'|'unknown'; measurementObservationId?: string }
export interface OutcomeEntry {
  planId: string; goalId: string; status: 'draft'|'reported'|'measured'; draft: LocalDraft; evidenceRefs: string[]; outcome?: OutcomeReceipt;
  baseline: Measurement|null; latest: Measurement|null; delta: number|null;
  comparison: 'matching-goal-declarations'|'incomparable'|'no-later-measurement'; attribution: 'not-established';
}
export interface OutcomeLedger { tenantId: string; at: string; entries: OutcomeEntry[]; withheld: { planId: string; reason: string }[]; stats: { drafts: number; reported: number; measured: number; comparable: number; attribution: 'not-established' } }
export function buildSharedContext(state: State, options?: ClockOptions): SharedContext;
export function upsertContextEntity(state: State, entity: ContextEntity, options?: ClockOptions): State;
export function capturePlanBaseline(state: State, selection: { goalId: string }, options?: ClockOptions): Measurement|null;
export function recordPlanOutcome(state: State, report: OutcomeInput, options?: ClockOptions): State;
export function buildOutcomeLedger(state: State, options?: ClockOptions): OutcomeLedger;
/** Purges private derived records after source/goal changes; returns a new JSON state. */
export function pruneContextData(state: State, options?: ClockOptions): State;
export function recordContextCorrection(state: State, input: {goalId:string;observationId:string;fields:{dueAt?:string;completed?:boolean}}, options?:ClockOptions):State;
/** Returns a corrected projection with exact raw source provenance; never mutates original evidence. */
export function effectiveObservation(state: State, observation: Observation, options?:ClockOptions):Observation;

export interface IntentBrief { goalId?: string; title: string; minutes?: number; constraints: string[]; evidenceRefs: string[] }
export interface IntentQuestion { id: string; kind:'goal'|'minutes'; text:string; choices:{id:string;label:string;value:string|number}[] }
export type IntentCompilation = {status:'ready';brief:IntentBrief;surface:SurfaceFrame}|{status:'needs-clarification';brief:IntentBrief;question:IntentQuestion;reason?:string}|{status:'unavailable';brief:IntentBrief;reason:string};
export interface ContextGap { id:string;goalId:string;kind:'consent'|'source'|'commitment-field'|'metric-record';type:ContextGap['kind'];field?:'dueAt'|'completed';observationId?:string;connectorId?:string;evidenceRefs:string[];reason:string;missingFacts:string[];resolution:'typed-observation'|'host-connection'|'import-observation';question:{id:string;kind:ContextGap['kind'];text:string;field?:'dueAt'|'completed';choices:{id:string;label:string;value:boolean}[]} }
export interface ContextGapResolution { status:'suggested'|'unavailable';gapId:string;requiresConfirmation:true;patch?:{kind:'observation-fields';observationId:string;fields:{dueAt?:string;completed?:boolean}};reason?:string }
export function compileIntent(state:State,input:{request:string;goalId?:string;minutes?:number;answer?:{questionId:string;value:string|number}},options?:ClockOptions):IntentCompilation;
export function detectContextGaps(state:State,input?:{goalId?:string},options?:ClockOptions):ContextGap[];
export function resolveContextGap(state:State,input:{gapId:string;value:string|boolean},options?:ClockOptions):ContextGapResolution;
