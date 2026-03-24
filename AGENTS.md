# AGENTS.md
AI Agent Instructions for this repository
(For GPT‑5.3‑codex implementation agents)

This document defines how AI coding agents must operate in this repository.
It is written specifically for GPT‑5.3‑codex and its Subagents.

---

# 1. Project Overview

This repository contains the source code for the project.

Implementation agents must:

* Read existing code before making changes
* Prefer modifying existing files over creating new ones
* Keep changes minimal and focused
* Maintain project structure and conventions
* Ask questions when requirements are unclear
* Never invent or assume missing specifications
* Follow the design/requirements produced by GPT‑5.4 exactly

GPT‑5.3‑codex must not reinterpret, redesign, or supplement specifications.

---

# 2. Subagent Roles (Parallel Execution Allowed)

GPT‑5.3‑codex may delegate work to Subagents.
Parallel execution is allowed and encouraged when tasks are independent.

## explorer_agent
* Analyze existing code
* Locate relevant modules
* Understand dependencies
* Never modify files

## implementer_agent
* Apply code changes
* Generate minimal diffs
* Follow GPT‑5.4 design exactly

## reviewer_agent
* Review diffs
* Detect mistakes, regressions, or missing tests
* Suggest corrections

Subagents must communicate only through explicit outputs.
They must not assume or infer missing context.

---

# 3. Development Environment

Install dependencies:
    pip install -r requirements.txt

Run tests:
    pytest

Lint code:
    ruff check .

Format code:
    ruff format .

Before finishing any task:
* Run tests
* Run lint
* Fix all issues

---

# 4. Code Style Rules

* Use clear, readable Python
* Use type hints where possible
* Prefer small functions
* Avoid deeply nested logic
* Do not introduce unnecessary dependencies

Naming conventions:
* snake_case for variables and functions
* PascalCase for classes

---

# 5. Architecture Rules

* Business logic lives in /src
* CLI or entry points live in /app
* Tests must mirror the source structure
* Avoid large monolithic files

Preferred file size:
    < 400 lines

If larger, refactor into modules.

---

# 6. Testing Policy

Testing is mandatory.

For every change:
* Add or update unit tests
* Ensure all tests pass
* Do not remove existing tests unless necessary

Testing framework:
    pytest

---

# 7. Safety Rules

Never:
* Delete large parts of the codebase
* Modify environment configuration without reason
* Introduce secrets or API keys into the repository

If unsure:
* Ask for confirmation

For any change affecting more than 30 lines:
* Ask for confirmation before proceeding

---

# 8. Git Workflow

Before committing:
    git status
    git diff

Commit message format:
    type: short description

Examples:
    feat: add CSV parser
    fix: handle empty rows
    refactor: simplify validation logic

---

# 9. Task Strategy

When given a task:

1. Understand the existing code
2. Create a plan
3. Ask clarifying questions if anything is unclear
4. Use Subagents as needed (parallel allowed)
5. Implement changes
6. Produce a minimal diff patch
7. Run tests
8. Fix issues
9. Produce a clean commit

Avoid large multi-purpose changes.

---

# 10. Performance Guidelines

Prefer:
* simple algorithms
* standard libraries
* readable code

Avoid premature optimization.

---

# 11. Documentation

When adding features:
* Update README if needed
* Add docstrings to public functions
* Explain complex logic with comments

---

# 12. Output Format (Mandatory)

All code changes must be output as a unified diff.

Example:

    --- a/file.py
    +++ b/file.py
    @@ -1,4 +1,8 @@
    (diff content here)

Rules:
* Never output full file rewrites unless explicitly requested
* Never output code outside of a diff
* Never modify unrelated lines

---

# 13. Role Separation

* GPT‑5.4 handles design, requirements, and architecture
* GPT‑5.3‑codex handles implementation only
* Subagents assist GPT‑5.3‑codex but must not redesign anything
* Implementation must follow GPT‑5.4 design exactly

---

# 14. Task And Branch Management (Mandatory)

For all implementation and investigation work, agents must manage progress with `TASKS.md`
and use an appropriate working branch.

Before starting work:
* Confirm current branch is not `main`/`master`
* Create or switch to a task branch
* Register the task in `TASKS.md` with status `todo` or `in_progress`

During work:
* Keep `TASKS.md` updated as scope or status changes
* Reference the task ID in commits and PR descriptions

Before finishing:
* Update `TASKS.md` status to `done` (or clearly note blockers)
* Verify the branch name follows this format:
    `<type>/<task-id>-<short-description>`
  Examples:
    `feat/TASK-102-ai-video-tagging`
    `fix/TASK-245-billing-rounding-error`

Agents must not implement or investigate work without both `TASKS.md` tracking and branch-based management.

## 14.1 TASKS.md Ordering Rules (Mandatory)

When updating `TASKS.md`, agents must follow this order policy:

* Treat tasks with `Task ID` (format: `TASK-xxx` or `TASK-<prefix>-xxx`) as the canonical task registry.
* Keep the canonical order as:
  * `in_progress`
  * `todo`
  * `blocked`
  * `done`
* Within each status, sort by `Task ID` descending.
* Keep `Task ID` and branch naming aligned (`<type>/TASK-xxx-...`).
* Keep non-canonical notes (old plans, investigation notes, non-ID drafts) under `Archive` sections so they do not break task ordering.
* If you add or change a task, update both:
  * the `TASK INDEX` section
  * the corresponding task detail section

If ordering is inconsistent, normalize ordering first before adding new tasks.

---

# End of AGENTS.md
