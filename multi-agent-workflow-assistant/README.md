# Multi-Agent Workflow Assistant

A **LangGraph-orchestrated reflection loop** where four agents collaborate to
produce a researched, reviewed report — and a React UI that streams every step
of their work live.

> **Researcher → Summarizer → Critic → Finalizer**, with the Critic able to send
> a draft *back* to the Summarizer until it passes review.

The interesting part isn't that an LLM can write a report — it's the
**orchestration**: bounded reflection, deterministic routing from a structured
critique, a hand-rolled tool-calling loop, per-role model selection, and a
three-mode stream that lets the browser watch the graph execute.

---

## What it does

1. You give it a topic.
2. The **Researcher** gathers facts using a tool-calling loop (web search via
   Tavily, with graceful fallback to the model's own knowledge if no search key
   is configured).
3. The **Summarizer** drafts a report from that research.
4. The **Critic** reviews the draft and returns a *structured* verdict —
   `approve` or `revise` — with specific issues.
5. If the verdict is `revise`, the draft goes **back to the Summarizer** with the
   critique attached. This loop repeats up to a configurable limit.
6. Once approved (or the limit is hit), the **Finalizer** polishes the report and
   **streams it token-by-token** to the UI.

---

## Architecture

### The graph

```
        ┌─────────────┐
        │  researcher │  tool-calling loop → sources + notes
        └──────┬──────┘
               ▼
        ┌─────────────┐ ◄─────────────────┐
        │  summarizer │  draft / revise    │  feedback edge
        └──────┬──────┘                    │  (verdict = "revise")
               ▼                           │
        ┌─────────────┐                    │
        │   critic    │ ──── structured ───┘
        └──────┬──────┘      verdict
               │ approve  (or max revisions reached)
               ▼
        ┌─────────────┐
        │  finalizer  │  streams the final report
        └─────────────┘
```

The Critic → Summarizer edge is the **reflection loop**. It's conditional: a
router function reads the Critic's structured verdict and either loops back or
proceeds to the Finalizer. A `max_revisions` bound guarantees termination.

### Model (single Groq model, all roles)

Every agent runs on one Groq model, set in a single place via `GROQ_MODEL`.
Groq exposes an OpenAI-compatible API and a free tier, which keeps the whole
workflow runnable at no cost.

| Setting      | Default                     | Notes                                          |
| ------------ | --------------------------- | ---------------------------------------------- |
| `GROQ_MODEL` | `llama-3.3-70b-versatile`   | Used by the Researcher, Summarizer, and Critic |

> **Heads-up:** Groq deprecated `llama-3.3-70b-versatile` on 2026-06-17. If it
> begins returning a `model_decommissioned` error, switch `GROQ_MODEL` to
> `openai/gpt-oss-120b` — no other changes needed.

The architecture still routes per role, so pointing different roles at different
models later is a one-line change in `config.py` (the role accessors).

### Streaming: three modes folded into one protocol

The backend consumes **three of LangGraph's stream modes at once** and translates
them into a single SSE event protocol the browser understands:

| LangGraph mode | Carries                       | Becomes (SSE event)             |
| -------------- | ----------------------------- | ------------------------------- |
| `updates`      | a node's output state delta   | `node_complete`                 |
| `custom`       | in-node progress messages     | `progress`                      |
| `messages`     | token chunks                  | `token` (finalizer only)        |

Because the browser receives Server-Sent Events over a **POST** request (the
native `EventSource` is GET-only), the frontend reads the response body as a
stream with `fetch` + `ReadableStream` and parses the SSE frames by hand.

### Stack

**Backend** — Python · FastAPI · LangGraph · LangChain · Groq · Tavily
**Frontend** — React 18 · TypeScript · Vite · Tailwind CSS · react-markdown

---

## Project layout

```
multi-agent-workflow-assistant/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── graph.py      # graph wiring + conditional router
│   │   │   ├── nodes.py      # the four agent nodes
│   │   │   ├── tools.py      # web search tool (Tavily) + source dedup
│   │   │   ├── state.py      # shared WorkflowState (TypedDict)
│   │   │   └── prompts.py    # per-agent system prompts
│   │   ├── services/
│   │   │   └── runner.py     # LangGraph stream → SSE event translation
│   │   ├── config.py         # pydantic-settings (env-driven)
│   │   ├── schemas.py        # request/response models
│   │   └── main.py           # FastAPI app + routes
│   ├── tests/                # pytest + httpx (graph routing, API, mocked runs)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/workflow.ts            # SSE-over-POST client
│   │   ├── hooks/useWorkflowStream.ts # event → UI state reducer
│   │   ├── components/                # pipeline rail, report, sources, input
│   │   ├── types.ts                   # mirrors the backend event protocol
│   │   └── App.tsx
│   └── package.json
└── docker-compose.yml        # runs the backend
```

---

## Running it locally

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env and set GROQ_API_KEY (TAVILY_API_KEY is optional)

uvicorn app.main:app --reload
```

The API is now at `http://localhost:8000` (docs at `/docs`).

> No `TAVILY_API_KEY`? The Researcher automatically falls back to the model's own
> knowledge — the app still runs end-to-end, just without live web search.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In development, Vite proxies `/api` to the backend,
so there's nothing else to configure.

### Or with Docker (backend)

```bash
cp backend/.env.example backend/.env   # set GROQ_API_KEY
docker compose up --build
```

---

## Configuration

All backend settings are environment variables (see `backend/.env.example`):

| Variable             | Default                       | Purpose                              |
| -------------------- | ----------------------------- | ------------------------------------ |
| `GROQ_API_KEY`       | *(required)*                  | Groq API access                      |
| `TAVILY_API_KEY`     | *(optional)*                  | Enables live web search              |
| `GROQ_MODEL`         | `llama-3.3-70b-versatile`     | Model used by every agent role       |
| `MAX_REVISIONS`      | `2`                           | Reflection-loop bound                |
| `CORS_ORIGINS`       | `http://localhost:5173`       | Allowed frontend origins             |

> `GROQ_MODEL` is intentionally a single setting. Groq deprecated
> `llama-3.3-70b-versatile` on 2026-06-17; if it stops working, set
> `GROQ_MODEL=openai/gpt-oss-120b`.

---

## Testing

```bash
cd backend
source .venv/bin/activate
pytest
```

The suite covers the conditional router's decision logic (approve / revise /
revision-limit), the graph's structure, request validation, the
no-API-key guard, and full mocked happy-path runs (no network or API calls).

---

## Deployment notes

- **Backend** containerizes via the included multi-stage `Dockerfile` (runs as a
  non-root user) and is suited to any container host. `docker-compose.yml` runs
  it directly.
- **Frontend** is a static Vite build (`npm run build` → `dist/`) and deploys
  cleanly to Vercel/Netlify. Set `VITE_API_URL` to your deployed backend URL.

---

## Interview talking points

This project was built to make specific engineering decisions easy to explain:

- **Reflection loop, bounded.** The Critic → Summarizer feedback edge is what
  separates "a chain of prompts" from an agentic workflow. The `max_revisions`
  bound is what stops it from looping forever — agents that can revise must also
  be forced to terminate.

- **Structured output drives deterministic routing.** The Critic uses
  `.with_structured_output(Critique)` to return a Pydantic model with a
  `Literal["approve", "revise"]` verdict. The graph routes on that field — so
  control flow is deterministic and never depends on parsing free-form text.

- **Hand-rolled tool-calling loop.** The Researcher's `bind_tools` + execute +
  feed-results-back loop is written out explicitly rather than hidden behind a
  prebuilt agent executor. Every step is visible and explainable, and there's a
  forced-synthesis fallback so it always produces notes even if the model keeps
  wanting to search.

- **Three stream modes, one protocol.** Folding `updates`, `custom`, and
  `messages` into a single SSE event stream is what makes the UI feel live —
  node completions, progress lines, *and* token streaming all arrive on one
  connection.

- **SSE over POST.** The browser can't use `EventSource` for a POST, so the
  client reads the `fetch` response as a `ReadableStream` and parses SSE frames
  manually — a small but real detail that trips people up.

- **Per-role, cost-aware model selection.** Cheap/fast model for high-volume
  research tool calls; stronger models where writing and judgement matter.

- **Testable by design.** The graph router is a plain function tested in
  isolation; nodes accept injected models so the whole workflow runs under
  mocks with no API calls. The API is exercised with FastAPI's test client.

- **Graceful degradation.** Missing the search key doesn't break the app — the
  Researcher falls back to model knowledge. Missing the API key returns a clean
  503 instead of a stack trace.

---

Built by **Md. Sazed Ul Karim** — full-stack developer with a GMP pharmaceutical
engineering background.
