import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RunPhase } from "../hooks/useWorkflowStream";

interface Props {
  report: string;
  phase: RunPhase;
  streaming: boolean; // finalizer is actively writing
}

export default function FinalReport({ report, phase, streaming }: Props) {
  const hasContent = report.trim().length > 0;

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="eyebrow">Final report</span>
        {streaming && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-working">
            <span className="h-1.5 w-1.5 rounded-full bg-working animate-pulse-ring" />
            streaming
          </span>
        )}
        {!streaming && phase === "done" && hasContent && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-approve">
            complete
          </span>
        )}
      </div>

      {hasContent ? (
        <article className="report-paper prose px-6 py-6 sm:px-8 sm:py-7">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          {streaming && (
            <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-paper-ink/70 animate-blink align-baseline" />
          )}
        </article>
      ) : (
        <ReportPlaceholder phase={phase} />
      )}
    </div>
  );
}

function ReportPlaceholder({ phase }: { phase: RunPhase }) {
  const message =
    phase === "running"
      ? "The report appears here, written live once the critic approves a draft."
      : "Run a topic to generate a researched, reviewed report.";
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex flex-col items-center gap-1.5 opacity-70">
        <PaperGlyph />
      </div>
      <p className="max-w-xs font-mono text-[12px] leading-relaxed text-muted">
        {message}
      </p>
    </div>
  );
}

function PaperGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="7" y="4" width="20" height="26" rx="2" stroke="#25324D" strokeWidth="1.5" />
      <path
        d="M11 11h12M11 16h12M11 21h8"
        stroke="#25324D"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
