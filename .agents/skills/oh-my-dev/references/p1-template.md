# P1 Template — Root AGENTS.md

This template defines the structure for a P1 (root-level) AGENTS.md file. Adapt section order and content to match the project's actual needs. The default filename is `AGENTS.md`; replace with `CLAUDE.md` or other platform-specific names when detected.

---

## Template

```markdown
> P1 | Root Project Charter & Navigation Map

---

## Identity

Grounded in auditable engineering discipline: conclusions must be actionable, verifiable, and maintainable; reject vague or unverified assertions.

---

## Project Overview

{Project Name} is {one-sentence description}. Built with {tech stack}, it provides {core capability}.

**Core Pillars:**
- {Pillar 1} — {brief explanation}
- {Pillar 2} — {brief explanation}
- {Pillar 3} — {brief explanation}

---

## Architecture Topology

```
|---------------------------------------------------------------|
|                    ENTRY POINTS                                |
|  {entry files} → {main flow}                                  |
|---------------------------------------------------------------|
                              |
                              v
|---------------------------------------------------------------|
|                    CORE LAYER                                  |
|  |---------------|  |---------------|  |-------------------|   |
|  | {Module A}  |  | {Module B}  |  | {Module C}      |   |
|  | - {detail}  |  | - {detail}  |  | - {detail}      |   |
|  |--------------|  |--------------|  |------------------|   |
|---------------------------------------------------------------|
                              |
                              v
|---------------------------------------------------------------|
|                    {LAYER NAME}                                |
|  {components or tools in this layer}                          |
|---------------------------------------------------------------|
```

---

## Directory Structure

```
{project}/
|---- AGENTS.md              # THIS FILE - P1 navigation map
|
|---- {entry}.{ext}          # {purpose}
|---- {config}.{ext}         # {purpose}
|
|---- {module}/              # {purpose} (P2: {module}/)
|   |---- index.{ext}        # {purpose}
|   |---- {submodule}/       # {purpose}
|   |   |---- {file}.{ext}   # {purpose}
|   |   ...
|   ...
```

---

## Build & Run Commands

```bash
# Install dependencies
{install command}

# Build
{build command}

# Development
{dev command}

# Test
{test command}

# Production
{prod command}
```

---

## Key Abstractions

### {Abstraction Name} (`{file path}`)

{One-paragraph description of the key abstraction.}
- {Bullet point about key behavior}
- {Bullet point about key behavior}

---

## Configuration Paths

| Path | Purpose |
|------|---------|
| `{path}` | {purpose} |

---

## Code Standards

### Language Policy

**Source code**: {language policy}

**Documentation**: {language policy}

**Commit messages**: {convention}

### Commit Convention

```
<type>(<scope>): <summary>
```

Types: {types used}

---

## DIP Navigation

### P1 — Root

- [P1: This File](./AGENTS.md)

### P2 — Module Maps

- [P2: {module}/](./{module}/AGENTS.md) — {brief description}

### P3 — File Contracts

**Status**: {status emoji} — {description of P3 coverage}

---

**Covenant**: Maintain map-terrain isomorphism. Keep the AGENTS.md aligned with actual structure, or the structure will drift.
```

---

## P1 Quality Gate Checklist

Before delivering a P1 file, verify ALL items:

```
□ 1. DIRECTORY STRUCTURE — matches actual `ls` output
□ 2. BUILD COMMANDS — verified copy-pasteable and runnable
□ 3. ARCHITECTURE TOPOLOGY — reflects actual module relationships
□ 4. KEY ABSTRACTIONS — grep confirms they exist in codebase
□ 5. CONFIGURATION PATHS — paths exist or are documented as auto-created
□ 6. P2 LINKS — point to paths that exist or will be created
□ 7. CODE STANDARDS — match project's actual conventions (check lint config)
□ 8. LANGUAGE — matches project's primary language and user preference
□ 9. IDENTITY — captures project essence accurately
□ 10. NO FABRICATION — every fact is verified, nothing invented
```
