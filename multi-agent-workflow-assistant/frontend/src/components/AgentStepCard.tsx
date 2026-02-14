import type { AgentState, NodeName } from "../types";

interface AgentMeta {
  index: string;
  title: string;
  role: string;
  accent: string; // hex for the active dot / glow
}

const META: Record<NodeName, AgentMeta> = {
  researcher: {
    index: "01",
    title: "Researcher",
    role: "Gathers facts with a tool-calling loop",
    accent: "#4C8DFF",
  },
  summarizer: {
    index: "02",
    title: "Summarizer",
    role: "Drafts the report from research",
    accent: "#F4B740",
  },
  critic: {
    index: "03",
    title: "Critic",
    role: "Reviews and decides: approve or revise",
    accent: "#3DD68C",
  },
  finalizer: {
    index: "04",
    title: "Finalizer",
    role: "Polishes and streams the final report",
    accent: "#4C8DFF",
  },
};

function statusColor(state: AgentState): string {
  switch (state.status) {
    case "working":
      return "#F4B740";
    case "approve":
      return "#3DD68C";
    case "revise":
      return "#FF7597";
    case "done":
      return "#4C8DFF";
    default:
      return "#25324D";
  }
}

function StatusDot({ state }: { state: AgentState }) {
  const color = statusColor(state);
  const working = state.status === "working";
  return (
    <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
      {working && (
        <span
          className="absolute inline-flex h-full w-full rounded-full animate-pulse-ring"
          style={{ backgroundColor: color, opacity: 0.5 }}
        />
      )}
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

interface Props {
  node: NodeName;
  state: AgentState;
  active: boolean;
}

export default function AgentStepCard({ node, state, active }: Props) {
  const meta = META[node];
  const idle = state.status === "idle";

  return (
    <div
      className={[
        "panel relative px-4 py-3.5 transition-all duration-300",
        active ? "ring-1 ring-azure/40 shadow-[0_0_24px_-6px_rgba(76,141,255,0.45)]" : "",
        idle ? "opacity-55" : "opacity-100",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <StatusDot state={state} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-muted">{meta.index}</span>
              <h3 className="font-display text-[15px] font-medium text-soft">
                {meta.title}
              </h3>
            </div>
            <StatusLabel state={state} accent={meta.accent} />
          </div>

          <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-muted">
            {state.message || meta.role}
          </p>

          {/* Critic verdict detail */}
          {node === "critic" && state.issues && state.issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {state.issues.map((issue, i) => (
                <li
                  key={i}
                  className="flex gap-1.5 text-[12px] leading-snug text-soft/80"
                >
                  <span className="text-revise">›</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Summarizer iteration badge */}
          {node === "summarizer" && typeof state.iteration === "number" && (
            <span className="mt-2 inline-block rounded border border-hairline bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-working">
              draft v{state.iteration}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusLabel({ state, accent }: { state: AgentState; accent: string }) {
  if (state.status === "idle") {
    return <span className="font-mono text-[10px] uppercase tracking-wider text-muted/60">queued</span>;
  }
  const map: Record<string, { text: string; color: string }> = {
    working: { text: "running", color: "#F4B740" },
    done: { text: "done", color: accent },
    approve: { text: "approved", color: "#3DD68C" },
    revise: { text: "revise", color: "#FF7597" },
  };
  const v = map[state.status];
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-wider"
      style={{ color: v.color }}
    >
      {v.text}
    </span>
  );
}
