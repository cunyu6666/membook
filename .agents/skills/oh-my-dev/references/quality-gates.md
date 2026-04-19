# Quality Gates — P1/P2/P3 Verification Checklists

Complete checklists for each DIP layer, plus the forbidden actions registry and severity classification.

---

## P1 Quality Gate (Root AGENTS.md)

Run this checklist before delivering or verifying a P1 file:

```
STRUCTURAL:
□ 1. Directory tree matches actual filesystem (verify with ls)
□ 2. Architecture topology ASCII diagram reflects actual module relationships
□ 3. All top-level directories are listed
□ 4. No listed directory is missing from actual filesystem

COMMANDS:
□ 5. Install command is copy-pasteable and works
□ 6. Build command is copy-pasteable and works
□ 7. Dev command is copy-pasteable and works
□ 8. Test command is copy-pasteable and works (if applicable)

CONTENT:
□ 9. Key abstractions are real (grep for them in codebase)
□ 10. Configuration paths exist or are documented as auto-created
□ 11. Code standards match project's actual conventions (check lint config, .editorconfig)
□ 12. Commit convention matches project's actual convention (check git log)

NAVIGATION:
□ 13. P2 links point to paths that exist or will be created
□ 14. Related docs links are valid
□ 15. DIP Navigation section is complete

META:
□ 16. Identity section captures project essence accurately
□ 17. Language matches project's primary working language
□ 18. No fabricated information — every fact is verified
□ 19. File size ≤ 300 lines (if larger, consider splitting detailed sections into references)
□ 20. No obsolete information from previous versions
```

---

## P2 Quality Gate (Module AGENTS.md)

Run this checklist for each P2 file:

```
COMPLETENESS:
□ 1. Every source file in directory is listed in member list
□ 2. Every listed file exists on disk (no ghosts)
□ 3. Subdirectories with their own P2 are linked (not listed as files)
□ 4. No new files are unlisted
□ 5. No deleted files are still listed

PRECISION:
□ 6. Responsibility descriptions use specific terms
□ 7. Technical points are accurate (verified by reading files)
□ 8. Key parameters or invariants are noted where relevant
□ 9. Each file gets exactly one line
□ 10. Format follows {file}.{ext}: {responsibility} pattern consistently

LINKS:
□ 11. Parent link points to a valid parent AGENTS.md
□ 12. Submodule links point to valid child AGENTS.md files
□ 13. Link text matches actual directory names

QUALITY:
□ 14. No vague descriptions like "utility functions" or "helper methods"
□ 15. Order is logical (index first, then by dependency or alphabetically)
□ 16. If directory has >8 files → suggestion to split into subdirectories is noted
□ 17. Covenant footer is present
□ 18. Header references correct parent path
```

---

## P3 Quality Gate (File Contract Header)

Run this checklist for each P3 header:

```
ACCURACY:
□ 1. [WHO] lists actual top-level exports (verified by reading file)
□ 2. [FROM] lists actual key imports (not every import, but the important ones)
□ 3. [TO] lists actual consumers (verified by grep for imports of this file)
□ 4. [HERE] path matches actual file location

FORMAT:
□ 5. Uses correct comment syntax for the file's language
□ 6. Each field is 1-2 lines, not a paragraph
□ 7. No repeated information between fields
□ 8. Names in WHO are grep-able in the codebase

PLACEMENT:
□ 9. At top of file, after any license/copyright comments
□ 10. One blank line after header, before rest of file

CONTENT QUALITY:
□ 11. WHO is specific: "Provides buildSystemPrompt(), BuildSystemPromptOptions" not "utility functions"
□ 12. FROM lists meaningful dependencies, not trivial ones (e.g., skip 'path', 'fs' for Node.js)
□ 13. TO lists meaningful consumers, enabling impact analysis
□ 14. HERE describes role + relationship, not just path restatement
□ 15. No fabricated claims — every assertion verified against actual code
```

---

## Full VERIFY Procedure

When running a full isomorphism verification:

### Step 1: P1 Check

```
For root AGENTS.md:
  → Compare directory structure section vs actual ls -R
  → Compare architecture topology vs actual module boundaries
  → Run each build command, verify exit code 0
  → Grep for each "Key Abstraction" name, verify it exists
  → Check each P2 link, verify target exists or is planned
```

### Step 2: P2 Sweep

```
For each P2 AGENTS.md:
  → Compare member list vs actual directory contents
  → For each listed file: verify it exists
  → For each unlisted file: flag as SEVERE-002
  → For each listed file: spot-check responsibility description
  → Verify parent link resolves
```

### Step 3: P3 Sample

```
For each source file with P3 header (or sample if too many):
  → Read WHO field, grep for those exports in the file
  → Read FROM field, grep for those imports in the file
  → Read TO field, grep for imports of this file in the codebase
  → Verify HERE path is correct
  → Flag any mismatches as SEVERE-001
```

### Step 4: Gap Detection

```
For each source file without P3 header:
  → Flag as FATAL-002 if file was recently modified
  → Otherwise, add to P3 creation backlog

For each directory with source files but no P2:
  → Flag as FATAL-004 if it's a clear module boundary
  → Otherwise, add to P2 creation backlog
```

### Step 5: Report

```
Generate report:
  → FATAL count: {N} (must fix before continuing)
  → SEVERE count: {N} (must fix this session)
  → Coverage: P1 {yes/no}, P2 {N}/{M} directories, P3 {N}/{M} files
  → Estimated fix time: {rough estimate based on issue count}
```

---

## Severity Classification Guide

### FATAL — Blocks All Work

| Code | When | Fix |
|------|------|-----|
| FATAL-001 | Code modified without checking/updating docs | Update docs, then continue |
| FATAL-002 | Missing P3 on a file being modified | Add P3, then continue |
| FATAL-003 | File deleted but P2 still lists it | Remove from P2 member list |
| FATAL-004 | New module directory without P2 | Create P2 for the module |

**Rule**: FATALs must be fixed before ANY other work continues. They represent isomorphism breaks that compound over time.

### SEVERE — Fix Within Session

| Code | When | Fix |
|------|------|-----|
| SEVERE-001 | P3 WHO/FROM/TO doesn't match actual imports/exports | Update P3 fields |
| SEVERE-002 | P2 member list is missing files | Add missing files to member list |
| SEVERE-003 | P1 structure/topology is outdated | Update P1 to match current state |
| SEVERE-004 | P2 parent link is broken | Fix link to point to correct parent |

**Rule**: SEVEREs should be fixed within the current session. Leaving them means the next person inherits stale docs.

---

## Maintenance Schedule

| Activity | Frequency |
|----------|-----------|
| Quick VERIFY (P2 spot check) | After any file add/delete/move |
| Full VERIFY | Before releases, after major refactors |
| P3 audit (sample) | Weekly for active projects |
| P1 review | Monthly or when architecture changes |
