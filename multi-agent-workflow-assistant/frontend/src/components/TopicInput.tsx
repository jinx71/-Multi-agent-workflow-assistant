import { useState } from "react";
import type { RunPhase } from "../hooks/useWorkflowStream";

interface Props {
  phase: RunPhase;
  onRun: (topic: string) => void;
  onReset: () => void;
}

const EXAMPLES = [
  "The economics of small modular nuclear reactors",
  "How CRISPR base editing differs from classic CRISPR",
  "Trade-offs of vector databases for RAG systems",
];

export default function TopicInput({ phase, onRun, onReset }: Props) {
  const [topic, setTopic] = useState("");
  const running = phase === "running";
  const canRun = topic.trim().length >= 3 && !running;

  const submit = () => {
    if (canRun) onRun(topic.trim());
  };

  return (
    <div className="panel p-4 sm:p-5">
      <label htmlFor="topic" className="eyebrow mb-2 block">
        Research topic
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Ask the agents to research anything…"
          disabled={running}
          className="flex-1 rounded-lg border border-hairline bg-ink/60 px-3.5 py-2.5 font-sans text-[15px] text-soft placeholder:text-muted/70 outline-none transition focus:border-azure/60 focus:ring-1 focus:ring-azure/30 disabled:opacity-60"
        />
        {running ? (
          <button
            onClick={onReset}
            className="rounded-lg border border-revise/40 bg-revise/10 px-5 py-2.5 font-display text-[14px] font-medium text-revise transition hover:bg-revise/20"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canRun}
            className="rounded-lg bg-azure px-6 py-2.5 font-display text-[14px] font-medium text-ink transition hover:bg-azure/90 disabled:cursor-not-allowed disabled:bg-hairline disabled:text-muted"
          >
            Run agents
          </button>
        )}
      </div>

      {phase === "idle" && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setTopic(ex)}
              className="rounded-full border border-hairline bg-panel-2/60 px-2.5 py-1 font-mono text-[11px] text-muted transition hover:border-azure/40 hover:text-soft"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
