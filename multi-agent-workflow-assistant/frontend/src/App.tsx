import { useEffect, useState } from "react";
import TopicInput from "./components/TopicInput";
import AgentTimeline from "./components/AgentTimeline";
import FinalReport from "./components/FinalReport";
import SourceList from "./components/SourceList";
import { useWorkflowStream } from "./hooks/useWorkflowStream";
import { fetchConfig } from "./api/workflow";
import type { RuntimeConfig } from "./types";

export default function App() {
  const wf = useWorkflowStream();
  const [config, setConfig] = useState<RuntimeConfig | null>(null);

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig(null)); // backend not up yet — header still renders
  }, []);

  const finalizerStreaming = wf.agents.finalizer.status === "working";

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-9">
      <Header config={config} />

      <main className="mt-7 grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Left column: input + pipeline */}
        <section className="flex flex-col gap-5">
          <TopicInput phase={wf.phase} onRun={wf.run} onReset={wf.reset} />

          {wf.error && (
            <div className="panel border-revise/40 bg-revise/[0.07] px-4 py-3">
              <p className="font-mono text-[12px] leading-relaxed text-revise">
                {wf.error}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                Check that the backend is running and GROQ_API_KEY is set.
              </p>
            </div>
          )}

          {wf.phase !== "idle" && (
            <AgentTimeline
              agents={wf.agents}
              activeNode={wf.activeNode}
              iterations={wf.iterations}
            />
          )}
        </section>

        {/* Right column: report + sources */}
        <section className="flex flex-col gap-5">
          <FinalReport
            report={wf.report}
            phase={wf.phase}
            streaming={finalizerStreaming}
          />
          <SourceList sources={wf.sources} />
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Header({ config }: { config: RuntimeConfig | null }) {
  return (
    <header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2.5">
            <PipelineMark />
            <span className="eyebrow">LangGraph reflection loop</span>
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight text-soft sm:text-[32px]">
            Multi-Agent Workflow Assistant
          </h1>
          <p className="mt-1.5 max-w-xl font-sans text-[14px] leading-relaxed text-muted">
            Four agents collaborate to research a topic, draft a report, critique
            it, and revise until it passes review — every step streamed live.
          </p>
        </div>

        {config && (
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <ModelChip label="research" value={config.researcher_model} />
            <ModelChip label="write" value={config.summarizer_model} />
            <ModelChip label="review" value={config.critic_model} />
            <span className="mt-0.5 font-mono text-[10px] text-muted/70">
              {config.search_enabled ? "web search enabled" : "LLM knowledge only"}
              {" · "}max {config.max_revisions} revisions
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

function ModelChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-hairline bg-panel/60 px-2 py-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="font-mono text-[11px] text-soft">{value}</span>
    </div>
  );
}

function PipelineMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="3" r="2" fill="#4C8DFF" />
      <circle cx="9" cy="9" r="2" fill="#F4B740" />
      <circle cx="9" cy="15" r="2" fill="#3DD68C" />
      <path d="M9 5v2M9 11v2" stroke="#25324D" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="mt-9 flex flex-col items-center justify-between gap-2 border-t border-hairline pt-4 sm:flex-row">
      <p className="font-mono text-[11px] text-muted">
        Researcher → Summarizer → Critic → Finalizer
      </p>
      <p className="font-mono text-[11px] text-muted">
        FastAPI · LangGraph · React
      </p>
    </footer>
  );
}
