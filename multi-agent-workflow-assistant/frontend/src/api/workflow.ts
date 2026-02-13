import type { RuntimeConfig, WorkflowEvent } from "../types";

// The backend streams Server-Sent Events over a POST request, so the native
// EventSource API (GET-only) won't work. Instead we read the response body as a
// stream and parse the SSE frames by hand. This is the core "show the work"
// mechanism — every agent step arrives here as a typed event.

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function fetchConfig(): Promise<RuntimeConfig> {
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error(`Config request failed (${res.status})`);
  return (await res.json()) as RuntimeConfig;
}

interface StreamHandlers {
  onEvent: (event: WorkflowEvent) => void;
  signal?: AbortSignal;
}

/**
 * POST a topic to the streaming endpoint and invoke `onEvent` for every SSE
 * frame as it arrives. Resolves when the stream closes.
 */
export async function streamWorkflow(
  topic: string,
  { onEvent, signal }: StreamHandlers,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/workflow/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
    signal,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // non-JSON error body; keep the status-based message
    }
    throw new Error(detail);
  }

  if (!res.body) throw new Error("Streaming is not supported by this browser.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // SSE frames are separated by a blank line. Each frame here is a single
  // `data: {json}` line, so we split on the blank-line boundary and parse.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? ""; // keep the trailing partial frame

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const json = line.slice("data:".length).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json) as WorkflowEvent);
      } catch {
        // ignore malformed frame; the stream keeps going
      }
    }
  }
}
