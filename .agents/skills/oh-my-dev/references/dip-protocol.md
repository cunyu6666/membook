# DIP Protocol — Dual-phase Isomorphic Documentation

This document defines the full DIP doctrine, isomorphism rules, and verification procedures.

---

## What is DIP?

DIP stands for **Dual-phase Isomorphic Documentation** — a protocol where the Code phase and the Document phase must be structurally consistent and mutually verifiable.

- **Code Phase**: Executable entity; compiler, interpreter, and tests are the truth source
- **Document Phase**: Readable entity; agent and maintainer can reconstruct navigation as the truth source
- **Isomorphism Requirement**: Structural or contract changes in either phase must leave corresponding updates in the other

### The Map-Terrain Metaphor

The codebase is the terrain. The documentation (P1/P2/P3) is the map. The map must reflect the terrain, or people get lost.

- Map without terrain = fantasy (docs describe what doesn't exist)
- Terrain without map = jungle (code works but nobody can navigate it)
- Map = terrain = DIP achieved

---

## The Three Layers

### P1 — Root (Project Charter)

**File**: Root `AGENTS.md` (or platform-equivalent like `CLAUDE.md`)

**Purpose**: Global topology, stack overview, global patterns, build commands, key abstractions

**Content**:
- Identity / Project Overview
- Architecture Topology (ASCII diagram)
- Directory Structure
- Build & Run Commands
- Key Abstractions
- Configuration Paths
- Code Standards
- DIP Navigation (links to P2 files)

**Quality criteria**:
- Someone reading P1 alone can understand the project's shape
- Build commands are copy-pasteable and verified
- Directory tree matches actual filesystem
- Architecture diagram reflects actual module relationships

### P2 — Module (Directory Map)

**File**: `{module}/AGENTS.md` (or platform-equivalent)

**Purpose**: Member list for the directory — every file listed with its responsibility

**Content**:
- Header with parent link
- Member list: `{file}.{ext}: {responsibility}, {technical points}, {key parameters}`
- Submodule links (if applicable)

**Quality criteria**:
- Every source file in the directory is listed
- Every listed file exists on disk
- Responsibility descriptions are specific and precise
- Parent link resolves correctly

### P3 — File (Contract Header)

**File**: Top of each source file

**Purpose**: Instant relevance judgment — WHO provides what, FROM what deps, TO what consumers, HERE what role

**Content**:
- `[WHO]`: Specific exports
- `[FROM]`: Key dependencies
- `[TO]`: Known consumers
- `[HERE]`: Location + role + relationships

**Quality criteria**:
- WHO matches actual exports
- FROM matches actual imports
- TO matches actual consumers (grep-verified)
- HERE describes role, not just path

---

## Isomorphism Rules

### Bidirectional Verification

1. **Docs → Code**: Every claim in docs is verifiable in code
   - Listed files exist
   - Listed exports are real
   - Described relationships hold
   - Build commands work

2. **Code → Docs**: Every structural fact in code is reflected in docs
   - New files appear in P2 member lists
   - New modules get P2 files
   - New exports appear in P3 WHO fields
   - Directory changes reflected in P1 structure

### When Isomorphism Breaks

Isomorphism breaks when:

- A file is added but not listed in P2
- A file is deleted but still listed in P2
- A function is exported but not in P3 WHO
- A dependency is added but not in P3 FROM
- A module is created but has no P2
- A directory is restructured but P1 still shows old structure
- A build command changes but P1 still shows old command

### Severity Levels

| Level | Code | Action |
|-------|------|--------|
| **FATAL** | FATAL-001 to FATAL-004 | Must stop and fix before continuing any work |
| **SEVERE** | SEVERE-001 to SEVERE-004 | Must fix within this session or work unit |

---

## FORBIDDEN Actions

### Blocking Level (FATAL)

| Code | Description |
|------|-------------|
| FATAL-001 | Orphaned code change: modifies implementation without verifying/updating doc-side mapping |
| FATAL-002 | Skip P3: discovered missing P3 but continues stacking implementation |
| FATAL-003 | Delete file without updating P2: member list inconsistent with actual file set |
| FATAL-004 | New module without P2: module boundary invisible in docs |

### High Priority (SEVERE)

| Code | Description |
|------|-------------|
| SEVERE-001 | P3 misaligned: header inconsistent with import/export/responsibility |
| SEVERE-002 | P2 missing items: source files or public entries not in member list |
| SEVERE-003 | P1 out of sync: global topology or stack inconsistent with repository reality |
| SEVERE-004 | Parent links broken |

---

## Workflow

### Before Working in a Directory

```
Read AGENTS.md at that level
  → exists? load it, understand structure
  → not exists? mark for creation, minimally complete

Read target file P3 header
  → exists? understand contract before implementing
  → not exists? complete P3 first, then implement
```

### After Implementation

```
Implement and test
  ↓
Verify document isomorphism
  → P3 header matches new exports?
  → P2 member list includes new files?
  → P1 structure reflects changes?
  ↓
If any mismatch → fix docs before marking task complete
```

### Complete DIP Lifecycle

```
New project:
  INIT (SCAN → P1 → P2 → P3 → VERIFY)

Existing project:
  SCAN → generate gap report → fill gaps → VERIFY

Structural change:
  Change code → update affected P3 → update affected P2 → update P1 if needed → VERIFY

Ongoing maintenance:
  VERIFY periodically → fix drift → maintain isomorphism
```

---

## Language Policy

### Documentation Language

DIP documentation language should match the project's primary working language:

- If the project uses English in code and comments → English documentation
- If the project uses Chinese in comments → Chinese documentation with English technical terms
- If the user communicates in a specific language → match that language

### Technical Terms

Technical terms should stay in their original form:

- Function names, type names, file paths: always in code's language
- Architectural concepts: use industry-standard terms
- Explanations: match the documentation language

---

## Cognitive Architecture Integration

DIP supports a three-layer cognitive model:

| Layer | DIP Layer | Purpose |
|-------|-----------|---------|
| **Phenomenon** | P3 (file contracts) | Observable: what this file does, what it depends on |
| **Essence** | P2 (module maps) | Structural: how files relate, module boundaries |
| **Philosophy** | P1 (root charter) | Normative: design principles, trade-offs, conventions |

This means:

- P3 answers: "Can I use this file?" (phenomenon)
- P2 answers: "How do these files work together?" (essence)
- P1 answers: "Why is the project designed this way?" (philosophy)

Each layer provides progressive disclosure appropriate to its cognitive scope.
