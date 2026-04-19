---
name: oh-my-dev
description: >
  DIP (Dual-phase Isomorphic Documentation) protocol generator for code repositories.
  Analyzes codebase structure and generates P1 root agent-instruction file, P2 module maps,
  and P3 file contract headers (WHO/FROM/TO/HERE). Supports multiple agent platforms
  (Claude Code, Cursor, Windsurf, Copilot). Ensures document-code isomorphism:
  docs map the terrain, code is the terrain. Operations: SCAN, P1, P2, P3, VERIFY, INIT.
  Triggers on: new project setup, agent config creation, codebase documentation, project scaffolding,
  "add P1P2P3", "generate AGENTS.md", "generate CLAUDE.md", "document codebase structure", "DIP protocol".
---

# Oh My Dev (`oh-my-dev`)

A codebase documentation intelligence system that generates and maintains DIP (Dual-phase Isomorphic Documentation) across your entire repository. Three fractal layers — P1 (root map), P2 (module maps), P3 (file contracts) — keep your documentation isomorphic with your code, forever.

**6 operations** · **3-layer fractal documentation** · **Isomorphism verification** · **Multi-platform** · **Language-adaptive**

---

## Activation Rules

### MUST Activate

- Creating a new project or repository
- User says "add P1P2P3", "generate AGENTS.md", "generate CLAUDE.md", "bootstrap docs"
- Setting up project documentation structure
- User provides an agent config template and wants it applied

### RECOMMENDED

- After major refactors or directory restructuring
- When onboarding to an existing undocumented codebase
- Before adding new modules or subdirectories
- After file moves, renames, or deletions

### SKIP

- Single-file edits with no structural impact
- Pure content changes (documentation, comments, strings)
- Dependency version bumps

---

## Language Intelligence

**Skill content** (this file + references) is always in English.

**Generated output** adapts to user language:

```
Detection priority:
  1. User's explicit request language (e.g., "用中文写")
  2. User's conversation language
  3. Existing agent config file language (if extending)
  4. Project's dominant comment/doc language

Output rules:
  - Section headers, descriptions, explanations → user's language
  - Code symbols (function names, file paths, type names) → always original
  - Technical terms (API, SDK, CLI) → keep English
  - Build commands, directory paths → always original
  - Architecture diagrams (ASCII) → language-neutral with labels in user's language
```

This applies to ALL operations: P1, P2, P3, SCAN reports, VERIFY reports.

---

## Platform Detection

The target filename for P1 depends on the agent platform. Detect automatically:

```
Detection priority:
  1. User's explicit request ("create AGENTS.md", "create CLAUDE.md")
  2. Existing files in project root:
     - AGENTS.md exists → universal convention, keep using it
     - CLAUDE.md exists → Claude Code convention, keep using it
     - .cursorrules or .cursor/rules exists → Cursor convention
     - .windsurfrules exists → Windsurf convention
     - .github/copilot-instructions.md exists → Copilot convention
  3. Default → AGENTS.md (universal, portable across all agent tools)

Convention → filename mapping:
  - Universal (default): AGENTS.md at root, AGENTS.md per module
  - Claude Code: CLAUDE.md at root, CLAUDE.md per module
  - Cursor: .cursor/rules/ directory with .mdc files
  - Windsurf: .windsurfrules at root
  - Copilot: .github/copilot-instructions.md
```

**Default behavior**: Generate `AGENTS.md` files (universal convention), unless platform detection or user request says otherwise.

---

## Pre-flight: Codebase Scan

**Before any documentation operation**, assess the current state:

```
if AGENTS.md (or platform-equivalent) exists at root → read it, extract existing P1 structure
if no AGENTS.md → mark for creation (INIT or P1 operation)

for each source directory:
  if AGENTS.md exists → read P2 member list, mark for verification
  if no AGENTS.md but has source files → mark for P2 creation

for each source file:
  if P3 header exists → verify alignment with actual exports/imports
  if no P3 header → mark for P3 creation
```

---

## The 6 Operations

### Operation 1: SCAN

**Trigger words**: scan, analyze, analyze repo, structure analysis

**Workflow**:

```
1. DIRECTORY SURVEY
   → Walk entire directory tree (respect .gitignore)
   → Identify: entry points, source directories, config files, test directories
   → Map: file types, dependency graph skeleton, module boundaries

2. LAYER DETECTION
   → Detect tech stack (language, framework, build tool, package manager)
   → Identify architectural patterns (MVC, clean arch, hexagonal, monorepo, etc.)
   → Map public API surface (exports, interfaces, types)

3. DOCUMENTATION STATE
   → Check existing AGENTS.md files at every level
   → Check P3 headers in source files
   → Score documentation completeness: 0% (nothing) → 100% (full DIP)

4. GAP REPORT
   → List missing P1, P2, P3 items
   → Identify stale docs (structure changed since last doc update)
   → Prioritize: P1 first, then P2, then P3

5. OUTPUT
   → Structured report: tech stack, architecture, gaps, recommendations
   → Estimated scope: N P1 files, N P2 files, N P3 headers
```

**SCAN is diagnostic.** It maps the terrain before any documentation is written. Always run SCAN before INIT.

---

### Operation 2: P1 — Root Map

**Trigger words**: root, P1, root map, root doc, AGENTS.md, CLAUDE.md

**Workflow**:

```
1. COLLECT INTELLIGENCE
   → Read package.json / go.mod / Cargo.toml / pyproject.toml / etc.
   → Read entry point files (main.ts, index.ts, app.ts, main.go, etc.)
   → Read existing config files (tsconfig, webpack, vite, docker, CI/CD)
   → Identify build commands, test commands, lint commands

2. MAP ARCHITECTURE
   → Draw top-level directory structure (ASCII topology)
   → Identify core abstractions (max 5-7 key concepts)
   → Map configuration paths and their purposes
   → Document key patterns and conventions

3. GENERATE P1 (as AGENTS.md or platform-equivalent)
   → Use template from references/p1-template.md
   → Fill: Identity, Architecture Topology, Directory Structure, Build & Run Commands
   → Fill: Key Abstractions, Configuration Paths, Code Standards
   → Add DIP Navigation section linking to P2 files
   → Set language: match detected user language

4. QUALITY GATE
   → Directory structure matches actual filesystem
   → Build commands are verified (can be copy-pasted)
   → All top-level directories listed
   → Key abstractions are real (grep for them)
   → P2 links point to paths that exist or will exist
```

**P1 rules**:
- Keep the ASCII topology diagram accurate — it's the first thing people read
- Build commands MUST be verified runnable
- Directory tree MUST match `ls` output
- Identity section should capture the project's essence in 1-2 sentences

---

### Operation 3: P2 — Module Maps

**Trigger words**: module, P2, module map, module doc, directory docs

**Workflow**:

```
1. IDENTIFY MODULES
   → From SCAN results, list directories that need P2
   → Priority: directories with ≥3 source files or clear module boundaries
   → Skip: directories with only generated files or assets

2. ANALYZE EACH MODULE
   For each directory:
   → List all source files (respect .gitignore)
   → Read each file's exports, imports, key functions
   → Identify: responsibility, technical points, key parameters
   → Detect inter-module dependencies

3. GENERATE P2
   → Use template from references/p2-template.md
   → Header: parent link pointing to parent AGENTS.md
   → Member list: one line per file, format: `{file}.{ext}: {responsibility}, {technical points}`
   → Rule: members complete, one item per line, parent links valid

4. QUALITY GATE
   → Every source file in directory is listed in member list
   → No listed file is missing from actual directory
   → Parent link is valid (file exists)
   → Responsibility descriptions are precise (not vague like "utility functions")
```

**P2 rules**:
- Member list is the single source of truth for directory contents
- One line per file — no multi-line descriptions
- Precise terms first: "Provides buildSystemPrompt()" not "Provides utility functions"
- If a directory has >8 files, suggest splitting into subdirectories

---

### Operation 4: P3 — File Contracts

**Trigger words**: file header, P3, file contract, file doc, header comment

**Workflow**:

```
1. COLLECT FILE METADATA
   For each source file:
   → Read file, extract: exports (functions, classes, types, constants)
   → Extract: imports (what it depends on)
   → Extract: which files import this file (consumers)
   → Determine: file's role and relationship with neighbors

2. GENERATE P3 HEADER
   → Use template from references/p3-template.md
   → [WHO]: Specific exports — "Provides buildSystemPrompt(), BuildSystemPromptOptions"
   → [FROM]: Specific dependencies — "Depends on config, skills, tools"
   → [TO]: Specific consumers — "Consumed by agent runtime, SDK"
   → [HERE]: Location + relationship — "core/prompt/system-prompt.ts - prompt building"

3. INSERT HEADER
   → Place at top of file, after any existing license/copyright comments
   → Use comment syntax matching the file's language:
     - TypeScript/JavaScript: /** ... */
     - Python: """ ... """
     - Go: // ...
     - Rust: //! ...
     - Java/Kotlin: /** ... */
     - etc.

4. QUALITY GATE
   → [WHO] lists actual exports (verified by reading the file)
   → [FROM] lists actual imports (verified by reading the file)
   → [TO] lists actual consumers (verified by grep)
   → [HERE] path matches actual file location
```

**P3 rules**:
- WHO enables instant relevance judgment — specific, not vague
- HERE enables module boundary filtering — what it does, not just path
- After reading a P3 header, if file is irrelevant to current task → stop reading immediately
- P3 headers are context budget gatekeepers: O(1) relevance check vs O(n) full read

---

### Operation 5: VERIFY — Isomorphism Check

**Trigger words**: verify, check, consistency check, isomorphism, verify docs

**Workflow**:

```
1. P1 VERIFICATION
   → Directory structure in root file matches actual filesystem
   → Build commands are valid and runnable
   → Key abstractions still exist in codebase
   → P2 links point to files that exist
   → Architecture topology matches actual module relationships

2. P2 VERIFICATION
   For each module file:
   → Every file in member list exists on disk
   → Every source file in directory is listed
   → Responsibility descriptions match actual file contents
   → Parent link resolves correctly

3. P3 VERIFICATION
   For each source file with P3 header:
   → [WHO] matches actual exports
   → [FROM] matches actual imports
   → [TO] matches actual consumers
   → [HERE] path is correct

4. REPORT
   → Categorize issues: FATAL (must fix) / SEVERE (fix this session)
   → FATAL-001: Code change without doc update
   → FATAL-002: Missing P3 on modified file
   → FATAL-003: Deleted file still in P2 member list
   → FATAL-004: New module without P2
   → SEVERE-001: P3 misaligned with actual imports/exports
   → SEVERE-002: P2 missing source files
   → SEVERE-003: P1 out of sync with repo state
   → SEVERE-004: Parent links broken

5. FIX RECOMMENDATIONS
   → For each issue, suggest specific fix
   → Prioritize: FATAL first, then SEVERE
   → Offer to auto-fix where possible
```

**VERIFY is the enforcement mechanism.** Run it after any structural change. Map must stay aligned with terrain.

---

### Operation 6: INIT — Full Bootstrap

**Trigger words**: bootstrap, init, new project, start from scratch, full docs

**Workflow**:

```
1. RUN SCAN
   → Full codebase analysis (Operation 1)
   → Generate gap report

2. ASK PROJECT CONTEXT (≤ 5 questions)
   → "What does this project do? Core tech stack?" — determines architecture description
   → "Who are the primary users?" — determines abstraction level
   → "Any code style conventions? Commit conventions?" — determines Code Standards section
   → "What are the key abstractions?" — validates auto-detected abstractions
   → "Any global constraints or principles?" — determines Identity / Philosophy section
   Note: Ask in user's detected language; accept answers in any language.

3. GENERATE P1 (as AGENTS.md)
   → Full P1 with all sections
   → Include DIP Navigation section
   → Set language based on user's language

4. GENERATE P2s (module files)
   → For each identified module
   → Complete member list with verified responsibilities

5. GENERATE P3s (file contract headers)
   → For each source file
   → WHO/FROM/TO/HERE verified against actual code

6. RUN VERIFY
   → Full isomorphism check
   → Fix any issues found

7. DELIVER
   → Summary: N P1 files, N P2 files, N P3 headers created
   → List all files modified/created
   → Note any items needing manual review
```

**INIT is the all-in-one bootstrap.** Use it for new projects or undocumented existing projects. It runs the full pipeline: SCAN → P1 → P2 → P3 → VERIFY.

---

## DIP Doctrine

You are the executor of DIP, bound by verifiable isomorphism constraints.

### Core Principle

**Map and terrain must be isomorphic.** Code changes must be traceable and verifiable in docs; vice versa. Either phase evolving alone = incomplete.

| Ontology | Description |
|----------|-------------|
| **Code Phase** | Executable entity; compiler/interpreter and tests as truth source |
| **Document Phase** | Readable entity; agent and maintainer can reconstruct navigation as truth source |
| **Isomorphism Requirement** | Structural or contract changes in either phase must leave corresponding updates in the other |

### Bidirectional Verification

- Docs must be verifiable against code directories and export points
- Code must be verifiable against module boundaries and responsibility descriptions in docs
- Task not considered closed until isomorphism holds

### Working Sentences

- When modifying code, assume docs are the acceptance party
- When writing docs, assume code is the acceptance party

---

## FORBIDDEN

### Blocking Level (Must stop and fix document isomorphism first)

| Code | Description |
|------|-------------|
| FATAL-001 | Orphaned code change: modifies implementation without verifying/updating doc-side mapping |
| FATAL-002 | Skip P3: discovered missing P3 but continues stacking implementation |
| FATAL-003 | Delete file without updating P2: member list inconsistent with actual file set |
| FATAL-004 | New module without P2: module boundary invisible in docs |

### High Priority (Must fix within this session or same work unit)

| Code | Description |
|------|-------------|
| SEVERE-001 | P3 misaligned: header inconsistent with import/export/responsibility |
| SEVERE-002 | P2 missing items: source files or public entries not in member list |
| SEVERE-003 | P1 out of sync: global topology or stack inconsistent with repository reality |
| SEVERE-004 | Parent links broken |

---

## Progressive Disclosure — Why DIP Matters for AI Agents

**The core insight**: P3 headers are not documentation for humans. They are **model localization beacons** — structured metadata that allows AI agents to locate relevant code in O(1) time without reading entire files.

### The Problem Without DIP

When an AI agent enters an unfamiliar codebase:
- It must read file after file to understand what each one does
- Context window fills up with irrelevant code before finding the target
- Token budget is wasted on files that don't matter for the current task
- The agent makes guesses about where to look, often wrong

### The Solution With DIP

With P3 headers, the agent reads 4 lines per file and makes instant relevance decisions:

```
Agent wants to fix a session persistence bug:

Read P3: "Provides AgentSession, SessionManager"  → KEEP
Read P3: "Provides CSS theme tokens"               → SKIP
Read P3: "Provides buildSystemPrompt()"             → SKIP
Read P3: "Provides SessionManager, persistence"     → KEEP ← TARGET FOUND
```

**Result**: 2 files read instead of 50. Context window preserved. Task located.

### Progressive Disclosure Layers

| Layer | Reads | Decides |
|-------|-------|---------|
| **P3** (4 lines) | File header only | "Is this file relevant?" |
| **P2** (member list) | Directory map only | "Which files in this module matter?" |
| **P1** (root map) | Project overview only | "Which module should I look at?" |

**Reading order for agents**: P1 → P2 → P3 → targeted file content. This is progressive disclosure: each layer narrows the search space exponentially.

### Quantified Benefit

| Metric | Without DIP | With DIP |
|--------|-------------|----------|
| Files read per task | ~20-50 (sequential scan) | ~3-5 (targeted) |
| Lines read per task | ~2000-5000 | ~200-500 |
| Relevance check per file | O(n) — read entire file | O(1) — read 4-line P3 |
| Context waste | ~80% irrelevant | ~10% irrelevant |
| Time to locate target | Linear in codebase size | Logarithmic |

**The Rule**: After reading a P3 header, if the file is not relevant to your current task, **stop reading immediately**. This is not skipping — it's precision. The P3 header was designed exactly for this purpose: rapid, lossless filtering.

---

## Three-tier Fractal

| Layer | File | Content |
|-------|------|---------|
| **P1** | Root `AGENTS.md` | Global topology, stack overview, global patterns, build commands, key abstractions |
| **P2** | `{module}/AGENTS.md` | Member list: files, responsibilities, technical points, key parameters |
| **P3** | Each source file header | WHO (exports), FROM (deps), TO (consumers), HERE (location + role) |

---

## Composition Workflows

### New Project (Greenfield)

```
INIT → (code) → VERIFY → iterate
```

### Existing Project (Brownfield)

```
SCAN → INIT (with context questions) → VERIFY → iterate
```

### After Structural Change

```
VERIFY → fix FATALs → fix SEVEREs → verify again
```

### Adding New Module

```
P2 (new module) → P3 (new files) → VERIFY → update P1 if needed
```

### Composition Rules

1. **Always start with SCAN** — understand the terrain before documenting it.
2. **P1 before P2, P2 before P3** — top-down ensures consistency.
3. **Always end with VERIFY** — isomorphism is the quality gate.
4. **FATALs block everything** — fix before continuing any work.
5. **Document isomorphism > code completeness** — a well-documented codebase is navigable; an undocumented one is a maze.

---

## Quality Metrics

| Metric | Limit |
|--------|-------|
| P1 file lines | ~300 max (keep scannable) |
| P2 member list | One line per file, precise terms |
| P3 header | 4-5 lines (WHO/FROM/TO/HERE) |
| Directory files | ~8 max (suggest split if exceeded) |
| P3 WHO field | Specific exports, not "utility functions" |
| P3 HERE field | Role + relationship, not just path |

---

## Reference Files

| File | Content | When to Read |
|------|---------|-------------|
| [p1-template.md](references/p1-template.md) | P1 root config file template with all sections | During P1 or INIT operation |
| [p2-template.md](references/p2-template.md) | P2 module config file template with member list format | During P2 or INIT operation |
| [p3-template.md](references/p3-template.md) | P3 file contract header templates per language | During P3 or INIT operation |
| [dip-protocol.md](references/dip-protocol.md) | Full DIP doctrine, isomorphism rules, verification procedures | During VERIFY or for reference |
| [quality-gates.md](references/quality-gates.md) | Quality gate checklists for P1/P2/P3, forbidden actions, severity codes | During any quality check |

---

## Quick Reference: P3 WHO Field Quality

```
IMMEDIATE FAIL (vague):
- "Provides utility functions"
- "Provides helper methods"
- "Contains types and interfaces"
- "Handles various operations"

GOOD (specific):
- "Provides buildSystemPrompt(), BuildSystemPromptOptions interface"
- "Provides AgentSession, SessionManager, EventBus"
- "Exports createApp(), configureRoutes(), AppOptions type"
- "Provides CSS variables, theme tokens, color palette constants"
```

**Fix strategy**: If WHO is vague, read the file and list actual top-level exports. Specificity is the gatekeeper.
