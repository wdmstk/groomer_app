# AGENTS.md

AI Agent Instructions for this repository

This file provides guidance for AI coding agents (Codex, etc.) working in this repository.

---

# 1. Project Overview

This repository contains the source code for the project.

Agent responsibilities:

* Read existing code before making changes
* Prefer modifying existing code over creating new files
* Keep changes minimal and focused
* Maintain project structure and conventions

---

# 2. Development Environment

Use the following commands when working in this repository.

Install dependencies:

```
pip install -r requirements.txt
```

Run tests:

```
pytest
```

Run the application:

```
python main.py
```

Lint code:

```
ruff check .
```

Format code:

```
ruff format .
```

Always run tests and lint before finishing a task.

---

# 3. Code Style Rules

Follow these coding conventions:

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

Important architectural guidelines:

* Business logic should live in `/src`
* CLI or entry points should be in `/app`
* Tests should mirror the source structure
* Avoid large monolithic files

Preferred file size:

```
< 400 lines
```

If larger, refactor into modules.

---

# 5. Testing Policy

Testing is mandatory.

For every change:

* Add or update unit tests
* Ensure all tests pass
* Do not remove existing tests unless necessary

Testing framework:

```
pytest
```

---

# 6. Safety Rules

Never:

* Delete large parts of the codebase
* Modify environment configuration without reason
* Introduce secrets or API keys into the repository

If unsure:

Ask for confirmation.

---

# 7. Git Workflow

Before committing:

```
git status
git diff
```

Commit message format:

```
type: short description

Examples:

feat: add CSV parser
fix: handle empty rows
refactor: simplify validation logic
```

---

# 8. Task Strategy

When given a task:

1. Understand the existing code
2. Create a plan
3. Implement changes
4. Run tests
5. Fix issues
6. Produce a clean commit

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

# 11. Interaction Guidelines

If a task is ambiguous:

* Ask clarifying questions
* Do not guess requirements

If something breaks:

* Debug the root cause
* Propose a fix
