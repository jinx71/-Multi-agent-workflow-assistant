import AgentStepCard from "./AgentStepCard";
import { NODES } from "../hooks/useWorkflowStream";
import type { AgentMap, NodeName } from "../types";

interface Props {
  agents: AgentMap;
  activeNode: NodeName | null;
  iterations: number;
}

// The pipeline rail is the heart of the UI: four agents stacked vertically with
// the data flowing downward, and — the signature element — a feedback arc that
// curves from the Critic back up to the Summarizer. When the critic returns
// "revise", that arc lights up, making the reflection loop visible.
export default function AgentTimeline({ agents, activeNode, iterations }: Props) {
  const revising = agents.critic.status === "revise";

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <span className="eyebrow">Agent pipeline</span>
        {iterations > 0 && (
          <span className="font-mono text-[11px] text-muted">
            revision pass <span className="text-soft">{iterations}</span>
          </span>
        )}
      </div>

      {/* Right gutter reserved for the feedback arc */}
      <div className="relative pr-10">
        <div className="flex flex-col gap-3">
          {NODES.map((node, i) => (
            <div key={node} className="relative">
              <AgentStepCard
                node={node}
                state={agents[node]}
                active={activeNode === node}
              />
              {i < NODES.length - 1 && (
                <Connector
                  active={isFlowing(node, agents, activeNode)}
                />
              )}
            </div>
          ))}
        </div>

        <FeedbackArc active={revising} />
      </div>
    </div>
  );
}

// A connector is "flowing" when its upstream node is done and the downstream is
// starting/working — used to animate the descending data flow.
function isFlowing(node: NodeName, agents: AgentMap, active: NodeName | null): boolean {
  const order: NodeName[] = ["researcher", "summarizer", "critic", "finalizer"];
  const idx = order.indexOf(node);
  const next = order[idx + 1];
  if (!next) return false;
  const upstreamDone = ["done", "approve", "revise"].includes(agents[node].status);
  return upstreamDone && (active === next || agents[next].status === "working");
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="relative mx-auto h-3 w-px overflow-hidden bg-hairline">
      {active && (
        <div
          className="absolute inset-x-[-1px] h-2 animate-flow-down bg-azure"
          style={{ boxShadow: "0 0 8px #4C8DFF" }}
        />
      )}
    </div>
  );
}

// The signature: an SVG feedback loop from Critic (node 03) up to Summarizer
// (node 02). It sits in the reserved right gutter and glows rose while the
// critic is sending the draft back for revision.
function FeedbackArc({ active }: { active: boolean }) {
  const color = active ? "#FF7597" : "#25324D";
  return (
    <svg
      className="pointer-events-none absolute right-0 top-0 h-full w-10"
      viewBox="0 0 40 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="arrow"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 Z" fill={color} />
        </marker>
      </defs>
      {/* From ~critic row (72%) curving out right and back up to ~summarizer row (38%) */}
      <path
        d="M 4 72 C 34 70, 34 40, 6 38"
        fill="none"
        stroke={color}
        strokeWidth={active ? 1.6 : 1.2}
        strokeDasharray="3 3"
        markerEnd="url(#arrow)"
        style={
          active
            ? { filter: "drop-shadow(0 0 3px rgba(255,117,151,0.8))" }
            : undefined
        }
        vectorEffect="non-scaling-stroke"
      />
      {active && (
        <circle r="1.8" fill="#FF7597">
          <animateMotion
            dur="1.4s"
            repeatCount="indefinite"
            path="M 4 72 C 34 70, 34 40, 6 38"
          />
        </circle>
      )}
    </svg>
  );
}
