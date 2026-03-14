# ARCHITECTURE.md

System Architecture Documentation

This document describes the architecture and structure of this project.
AI agents should follow this structure when modifying or adding code.

---

# 1. Project Structure

Recommended directory layout:

project-root/

src/
Core application logic

app/
CLI entry points or application runners

tests/
Unit and integration tests

data/
Sample data or test datasets

scripts/
Utility scripts

docs/
Documentation

---

# 2. Architectural Principles

The project follows these principles:

* Separation of concerns
* Modular design
* Testable components
* Minimal external dependencies

Core logic should be placed inside `/src`.

---

# 3. Module Responsibilities

src/

data_processing/
Data loading and parsing

analysis/
Data analysis and calculations

export/
Export functionality (CSV, Excel, etc.)

utils/
Shared helper functions

---

# 4. Data Flow

Typical processing flow:

Input data
↓
Parsing
↓
Validation
↓
Analysis
↓
Output generation

Agents should maintain this flow when adding new features.

---

# 5. Coding Boundaries

Agents should follow these rules:

* Do not place business logic in CLI files
* Avoid circular dependencies
* Keep modules focused and small

---

# 6. Testing Strategy

Testing structure mirrors the source structure.

Example:

src/analysis/calculation.py
tests/analysis/test_calculation.py

Every feature should have tests.

---

# 7. Extension Strategy

When adding new features:

1. Identify the correct module
2. Extend existing modules when possible
3. Avoid creating redundant utilities
4. Maintain the project structure

---

# 8. Performance Considerations

Prefer:

* clear algorithms
* maintainable code
* readable structure

Performance optimization should only occur when necessary.

---

# 9. Documentation Policy

Important modules should include:

* docstrings
* usage examples
* comments for complex logic
