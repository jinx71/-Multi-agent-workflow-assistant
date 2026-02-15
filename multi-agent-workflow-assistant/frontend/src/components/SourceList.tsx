import type { Source } from "../types";

export default function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="panel px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="eyebrow">Sources</span>
        <span className="font-mono text-[11px] text-muted">{sources.length}</span>
      </div>
      <ol className="space-y-2">
        {sources.map((s, i) => (
          <li key={`${s.url}-${i}`} className="flex gap-2.5">
            <span className="mt-0.5 font-mono text-[11px] text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-[13px] text-soft hover:text-azure"
                title={s.title}
              >
                {s.title}
              </a>
              <span className="block truncate font-mono text-[10px] text-muted">
                {hostOf(s.url)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
