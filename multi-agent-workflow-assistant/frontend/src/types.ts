// Types mirror the backend SSE protocol emitted by
// app/services/runner.py. Keeping them in one file makes the contract between
// the FastAPI stream and the React UI explicit and greppable.

export type NodeName = "researcher" | "summarizer" | "critic" | "finalizer";

export type Verdict = "approve" | "revise";

export interface Source {
  title: string;
  url: string;
}

// --- Server-Sent Events ----------------------------------------------------

export interface StartEvent {
  event: "start";
  topic: string;
}

export interface ProgressEvent {
  event: "progress";
  type: "progress";
  node: NodeName;
  message: string;
}

export interface ResearcherComplete {
  event: "node_complete";
  node: "researcher";
  sources: Source[];
  research: string;
}

export interface SummarizerComplete {
  event: "node_complete";
  node: "summarizer";
  draft: string;
  iteration: number;
}

export interface CriticComplete {
  event: "node_complete";
  node: "critic";
  verdict: Verdict;
  critique: string;
  issues: string[];
}

export interface FinalizerComplete {
  event: "node_complete";
  node: "finalizer";
  final_report: string;
}

export type NodeCompleteEvent =
  | ResearcherComplete
  | SummarizerComplete
  | CriticComplete
  | FinalizerComplete;

export interface TokenEvent {
  event: "token";
  text: string;
}

export interface DoneEvent {
  event: "done";
}

export interface ErrorEvent {
  event: "error";
  message: string;
}

export type WorkflowEvent =
  | StartEvent
  | ProgressEvent
  | NodeCompleteEvent
  | TokenEvent
  | DoneEvent
  | ErrorEvent;

// --- Config endpoint -------------------------------------------------------

export interface RuntimeConfig {
  researcher_model: string;
  summarizer_model: string;
  critic_model: string;
  max_revisions: number;
  search_enabled: boolean;
}

// --- UI-side derived state -------------------------------------------------

export type AgentStatus = "idle" | "working" | "done" | "approve" | "revise";

export interface AgentState {
  status: AgentStatus;
  message: string;
  // researcher
  sources?: Source[];
  // summarizer
  draft?: string;
  iteration?: number;
  // critic
  verdict?: Verdict;
  critique?: string;
  issues?: string[];
}

export type AgentMap = Record<NodeName, AgentState>;
