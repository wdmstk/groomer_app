# AGENTS.md
AI Agent Instructions for this repository
(For GPT‑5.3‑codex implementation agents)

This document defines how AI coding agents must operate in this repository.
It is written specifically for GPT‑5.3‑codex (implementation agent).

---

# 1. Project Overview

This repository contains the source code for the project.

Agent responsibilities:

* Read existing code before making changes
* Prefer modifying existing files over creating new ones
* Keep changes minimal and focused
* Maintain project structure and conventions
* Ask questions when requirements are unclear
* Never invent or assume missing specifications

All implementation must follow the design/requirements produced by GPT‑5.4.

---

# 2. Development Environment

Use the following commands when working in this repository.

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

# 3. Code Style Rules

* Use clear, readable Python
* Use type hints where possible
* Prefer small functions
* Avoid deeply nested logic
* Do not introduce unnecessary dependencies

Naming conventions:
* snake_case for variables and functions
* PascalCase for classes

---

# 4. Architecture Rules

* Business logic lives in /src
* CLI or entry points live in /app
* Tests must mirror the source structure
* Avoid large monolithic files

Preferred file size:
    < 400 lines

If larger, refactor into modules.

---

# 5. Testing Policy

Testing is mandatory.

For every change:
* Add or update unit tests
* Ensure all tests pass
* Do not remove existing tests unless necessary

Testing framework:
    pytest

---

# 6. Safety Rules

Never:
* Delete large parts of the codebase
* Modify environment configuration without reason
* Introduce secrets or API keys into the repository

If unsure:
* Ask for confirmation

---

# 7. Git Workflow

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

# 8. Task Strategy

When given a task:

1. Understand the existing code
2. Create a plan
3. Ask clarifying questions if anything is unclear
4. Implement changes
5. Produce a minimal diff patch
6. Run tests
7. Fix issues
8. Produce a clean commit

Avoid large multi-purpose changes.

---

# 9. Performance Guidelines

Prefer:
* simple algorithms
* standard libraries
* readable code

Avoid premature optimization.

---

# 10. Documentation

When adding features:
* Update README if needed
* Add docstrings to public functions
* Explain complex logic with comments

---

# 11. Output Format (Mandatory)

All code changes must be output as a unified diff.
Example:

    --- a/file.py
    +++ b/file.py
    @@ -1,4 +1,8 @@
    (diff content here)

Never output full file rewrites unless explicitly requested.

---

# 12. Role Separation

* GPT‑5.4 handles design, requirements, and architecture.
* GPT‑5.3‑codex handles implementation only.
* Codex must not generate specifications or redesign architecture.

Follow the provided design exactly.