# P2 Template — Module AGENTS.md

This template defines the structure for a P2 (module-level) AGENTS.md file. Each directory with ≥3 source files or clear module boundaries should have one. The default filename is `AGENTS.md`; replace with `CLAUDE.md` or other platform-specific names when detected.

---

## Template

```markdown
# {module}/

> P2 | Parent: {parent path}/AGENTS.md

## Member List

{file}.{ext}: {responsibility}, {technical points}, {key parameters or invariants}
{file}.{ext}: {responsibility}, {technical points}
{file}.{ext}: {responsibility}, {technical points}, {key parameters or invariants}

Rule: Members complete, one item per line, parent links valid, precise terms first

---

[COVENANT]: Update this file header on changes and verify against parent AGENTS.md
```

---

## Member List Format Rules

### Format

```
{filename}: {responsibility}, {technical points}, {key parameters}
```

### Examples

Good — specific and precise:
```
agent-session.ts: Central session lifecycle manager, wraps Agent core with persistence, model switching, compaction, event emission
sdk.ts: Programmatic API factory, exports createAgentSession() for embedding, depends on AgentSession
event-bus.ts: Typed event emission system, provides on()/emit()/off() for extension hooks, generic event types
```

Bad — vague and uninformative:
```
agent-session.ts: Session management
sdk.ts: API helpers
event-bus.ts: Event utilities
```

### Precision Guidelines

1. **Responsibility**: What does this file DO? Use verbs: "manages", "provides", "exports", "handles"
2. **Technical points**: How does it do it? Key patterns, algorithms, data structures
3. **Key parameters**: Important constraints, invariants, or configuration

### When to Include Key Parameters

- Public API surface (function signatures, exported types)
- Important invariants (e.g., "singleton", "max 100 items", "sorted by date")
- Configuration knobs (e.g., "timeout from env var API_TIMEOUT")
- Thread safety or concurrency notes

### When NOT to Include

- Implementation details that change frequently
- Obvious information (e.g., "written in TypeScript")
- Redundant context (e.g., "in this module" when it's clear from location)

---

## P2 Quality Gate Checklist

Before delivering a P2 file, verify ALL items:

```
□ 1. COMPLETENESS — every source file in directory is listed
□ 2. ACCURACY — every listed file exists on disk
□ 3. PRECISION — responsibility descriptions use specific terms, not vague ones
□ 4. PARENT LINK — points to a valid parent AGENTS.md
□ 5. ONE LINE — each file gets exactly one line
□ 6. NO ORPHANS — no files in member list are deleted or moved
□ 7. NO MISSING — no new files are unlisted
□ 8. FORMAT — follows {file}.{ext}: {responsibility} pattern consistently
□ 9. SPLIT CHECK — if directory has >8 files, suggest splitting into subdirectories
□ 10. ORDER — files listed in a logical order (index first, then by dependency or alphabetically)
```

---

## When to Create P2

Create a P2 AGENTS.md when a directory:

- Has ≥3 source files
- Represents a clear module boundary
- Is referenced from P1 as a module
- Has internal structure worth documenting

Skip P2 when a directory:

- Contains only generated files
- Contains only static assets (images, fonts)
- Has 1-2 trivial files (e.g., just an index.ts barrel)
- Is a leaf with no internal structure

---

## Subdirectory Handling

If a P2 directory contains subdirectories that also have P2 files:

```markdown
# core/

> P2 | Parent: ./AGENTS.md

## Member List

index.ts: Barrel exports for core module, re-exports from runtime/, tools/, extensions/

## Submodules

- [P2: core/runtime/](./runtime/AGENTS.md) — Agent runtime & SDK
- [P2: core/tools/](./tools/AGENTS.md) — Built-in tools
- [P2: core/extensions/](./extensions/AGENTS.md) — Extension system
```

This keeps the parent P2 clean while linking to child P2 files.
