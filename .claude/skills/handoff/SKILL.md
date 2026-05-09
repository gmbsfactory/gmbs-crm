---
name: handoff
description: Summarizes the current conversation (discussion, decisions, implementation plan, progress) and generates a self-contained briefing prompt that a fresh agent can act on cold. Use when switching context, delegating to a specialist, or resuming work in a new session.
argument-hint: [optional focus area or target agent]
model: claude-haiku-4-5-20251001
---

# Handoff Synthesizer

You are a **context distiller**. Your job: read everything in this conversation, extract what matters, discard noise, and produce two artifacts — a **Summary** and a **Handoff Prompt**.

## Target: $ARGUMENTS

---

## Step 1 — Reconstruct the Thread

Scan the full conversation and extract:

| Category | What to capture |
|----------|----------------|
| **Problem / Goal** | What the user is trying to achieve (one crisp sentence) |
| **Decisions made** | Architectural, design, or product choices that were agreed upon |
| **Implementation plan** | Steps that were laid out (ordered if sequential) |
| **Work completed** | What has already been done (files changed, tests passing, endpoints added) |
| **Work in progress** | Partially done — what state it's in |
| **Blocked / deferred** | Things explicitly put on hold or out of scope |
| **Key files touched** | File paths and what changed in each |
| **Open questions** | Unresolved issues the next agent must address |
| **Constraints** | Non-negotiables: layers, naming, standards, test requirements |

---

## Step 2 — Emit the Summary

```markdown
## Conversation Summary — <date>

### Goal
<one sentence>

### Decisions
- <decision 1> — *why*
- <decision 2> — *why*

### Implementation Plan
1. <step 1> — ✅ done / 🟡 in progress / 🔴 not started
2. <step 2> — …

### Work Completed
- `<file>:<line>` — <what changed>
- …

### Work In Progress
- <description of partial state — what's done vs. what remains>

### Blocked / Deferred
- <item> — *reason*

### Open Questions
- <question> — *why it matters*

### Key Constraints
- <constraint> — *source (architecture rule, user preference, spec)*
```

---

## Step 3 — Emit the Handoff Prompt

Generate a **self-contained prompt** that a fresh agent can receive with zero prior context and act on immediately. The prompt must:

- Open with the project context paragraph (copy from CLAUDE.md preamble if relevant)
- State the goal precisely
- List decisions already made (so the agent doesn't re-litigate them)
- List files to read first (ordered by importance)
- Describe the exact next action — not "continue the work" but "implement X in file Y"
- State success criteria explicitly
- End with constraints / anti-patterns the agent must respect

```markdown
## Handoff Prompt — ready to paste

---

### Context
You are working on **OntoStudio** — a semantic operating system for real-world systems (FastAPI backend + React 19 frontend). The project uses a strict layered architecture: Domain → Service → API, and all API types are auto-generated from Pydantic schemas (`npm run generate:types`).

<add 1–3 sentences specific to the feature area if relevant>

### Goal
<precise goal — what done looks like>

### Already Decided (do not re-litigate)
- <decision>
- <decision>

### Read These First
1. `<file>` — <why>
2. `<file>` — <why>

### Next Action
<specific, concrete instruction — file, function, behavior>

### Success Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] Tests pass: `uv run pytest <path>`
- [ ] No TypeScript errors: `npm run build`

### Constraints
- <constraint>
- Never manually edit `src/generated/api-types.ts`
- No `any` in TypeScript, no untyped dicts crossing Python layer boundaries
- Tests are mandatory — no feature is done without tests

---
```

---

## Rules

- **Be surgical**: only include what a fresh agent actually needs. Omit exploratory tangents, failed approaches (unless they reveal a constraint), and already-closed questions.
- **Prefer file:line references** over descriptions when a specific location matters.
- **Date the summary** — memories decay; the date anchors them.
- **If $ARGUMENTS names a specialist**, tailor the handoff prompt to that specialist's domain (e.g., for `/backend-engineer`, emphasize layer boundaries and test requirements; for `/frontend-designer`, emphasize design-system tokens and component structure).
- **Flag conflicts**: if the conversation contains contradictory decisions, surface them explicitly in Open Questions rather than silently picking one.
- **Never invent** progress. If you are unsure whether something was completed, mark it 🟡 in progress.
