import { useCallback, useRef, useState } from "react";
import { streamWorkflow } from "../api/workflow";
import type {
  AgentMap,
  NodeName,
  Source,
  WorkflowEvent,
} from "../types";

const NODES: NodeName[] = ["researcher", "summarizer", "critic", "finalizer"];

function freshAgents(): AgentMap {
  return {
    researcher: { status: "idle", message: "" },
    summarizer: { status: "idle", message: "" },
    critic: { status: "idle", message: "" },
    finalizer: { status: "idle", message: "" },
  };
}

export type RunPhase = "idle" | "running" | "done" | "error";

export interface WorkflowController {
  phase: RunPhase;
  agents: AgentMap;
  activeNode: NodeName | null;
  report: string; // streamed token-by-token from the finalizer
  sources: Source[];
  iterations: number;
  error: string | null;
  run: (topic: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useWorkflowStream(): WorkflowController {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [agents, setAgents] = useState<AgentMap>(freshAgents);
  const [activeNode, setActiveNode] = useState<NodeName | null>(null);
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [iterations, setIterations] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((node: NodeName, next: Partial<AgentMap[NodeName]>) => {
    setAgents((prev) => ({ ...prev, [node]: { ...prev[node], ...next } }));
  }, []);

  const handleEvent = useCallback(
    (evt: WorkflowEvent) => {
      switch (evt.event) {
        case "start":
          break;

        case "progress": {
          // An agent is mid-flight: mark it active and surface its status line.
          setActiveNode(evt.node);
          patch(evt.node, { status: "working", message: evt.message });
          break;
        }

        case "node_complete": {
          if (evt.node === "researcher") {
            patch("researcher", {
              status: "done",
              sources: evt.sources,
              message: `${evt.sources.length} source${evt.sources.length === 1 ? "" : "s"} gathered`,
            });
            setSources(evt.sources);
          } else if (evt.node === "summarizer") {
            patch("summarizer", {
              status: "done",
              draft: evt.draft,
              iteration: evt.iteration,
              message: `Draft v${evt.iteration} ready`,
            });
            if (typeof evt.iteration === "number") setIterations(evt.iteration);
          } else if (evt.node === "critic") {
            // The critic's verdict is the routing decision — colour it.
            patch("critic", {
              status: evt.verdict === "approve" ? "approve" : "revise",
              verdict: evt.verdict,
              critique: evt.critique,
              issues: evt.issues,
              message:
                evt.verdict === "approve"
                  ? "Approved for finalizing"
                  : `Sent back · ${evt.issues.length} issue${evt.issues.length === 1 ? "" : "s"}`,
            });
            // If the critic approved, the loop is leaving the summarizer/critic
            // cycle; if it sent it back, reset the summarizer to re-run.
            if (evt.verdict === "revise") {
              patch("summarizer", { status: "idle" });
            }
          } else if (evt.node === "finalizer") {
            patch("finalizer", { status: "done", message: "Report delivered" });
            // The streamed tokens are authoritative, but fall back to the full
            // payload if token streaming produced nothing.
            setReport((cur) => (cur.trim() ? cur : evt.final_report));
          }
          break;
        }

        case "token": {
          setActiveNode("finalizer");
          patch("finalizer", { status: "working", message: "Writing the report" });
          setReport((cur) => cur + evt.text);
          break;
        }

        case "done":
          setPhase("done");
          setActiveNode(null);
          break;

        case "error":
          setError(evt.message);
          setPhase("error");
          setActiveNode(null);
          break;
      }
    },
    [patch],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setAgents(freshAgents());
    setActiveNode(null);
    setReport("");
    setSources([]);
    setIterations(0);
    setError(null);
  }, []);

  const run = useCallback(
    async (topic: string) => {
      reset();
      setPhase("running");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await streamWorkflow(topic, {
          onEvent: handleEvent,
          signal: controller.signal,
        });
        // If the stream closed without an explicit done/error, settle to done.
        setPhase((p) => (p === "running" ? "done" : p));
      } catch (err) {
        if (controller.signal.aborted) return; // user cancelled; stay reset
        setError(err instanceof Error ? err.message : "Unknown error");
        setPhase("error");
      } finally {
        setActiveNode((n) => (abortRef.current?.signal.aborted ? null : n));
      }
    },
    [handleEvent, reset],
  );

  const cancel = useCallback(() => reset(), [reset]);

  return {
    phase,
    agents,
    activeNode,
    report,
    sources,
    iterations,
    error,
    run,
    cancel,
    reset,
  };
}

export { NODES };
