# P3 Template — File Contract Headers

This template defines the structure for P3 file contract headers. Each source file should have one at the top, using the comment syntax appropriate for its language.

---

## The Four Fields

| Field | Question | Purpose |
|-------|----------|---------|
| **WHO** | What does this file provide? | Enables instant relevance judgment |
| **FROM** | What does this file depend on? | Shows dependency chain |
| **TO** | Who uses this file? | Shows consumer chain |
| **HERE** | Where is this file and what's its role? | Enables module boundary filtering |

---

## Templates by Language

### TypeScript / JavaScript

```typescript
/**
 * [WHO]: Provides {exported functions/components/types/constants}
 * [FROM]: Depends on {module/package/file} for {specific capability}
 * [TO]: Consumed by {adjacent modules or downstream consumers}
 * [HERE]: {file path} - {what it does}; {relationship with neighbors}
 */
```

### Python

```python
"""
[WHO]: Provides {exported functions/classes/constants}
[FROM]: Depends on {module/package} for {specific capability}
[TO]: Consumed by {adjacent modules or downstream consumers}
[HERE]: {file path} - {what it does}; {relationship with neighbors}
"""
```

### Go

```go
// [WHO]: Provides {exported functions/types/constants}
// [FROM]: Depends on {package} for {specific capability}
// [TO]: Consumed by {adjacent packages}
// [HERE]: {file path} - {what it does}; {relationship with neighbors}
```

### Rust

```rust
//! [WHO]: Provides {exported functions/traits/types}
//! [FROM]: Depends on {crate/module} for {specific capability}
//! [TO]: Consumed by {adjacent modules}
//! [HERE]: {file path} - {what it does}; {relationship with neighbors}
```

### Java / Kotlin

```java
/**
 * [WHO]: Provides {class/interface/enum}
 * [FROM]: Depends on {package/library} for {specific capability}
 * [TO]: Consumed by {adjacent packages}
 * [HERE]: {file path} - {what it does}; {relationship with neighbors}
 */
```

### C / C++

```c
/**
 * [WHO]: Provides {functions/types/macros}
 * [FROM]: Depends on {header/library} for {specific capability}
 * [TO]: Consumed by {other files}
 * [HERE]: {file path} - {what it does}; {relationship with neighbors}
 */
```

### Ruby

```ruby
# [WHO]: Provides {module/class/methods}
# [FROM]: Depends on {gem/library} for {specific capability}
# [TO]: Consumed by {adjacent modules}
# [HERE]: {file path} - {what it does}; {relationship with neighbors}
```

### Shell (Bash/Zsh)

```bash
# [WHO]: Provides {functions}
# [FROM]: Depends on {commands/files} for {specific capability}
# [TO]: Consumed by {other scripts}
# [HERE]: {file path} - {what it does}; {relationship with neighbors}
```

---

## Writing Effective P3 Headers

### WHO — Instant Relevance Judgment

WHO should let the reader decide in 2 seconds whether this file matters to their current task.

❌ Bad (too vague):
```
[WHO]: Provides utility functions
[WHO]: Contains types and interfaces
[WHO]: Helper methods for the application
[WHO]: Various tools
```

✅ Good (specific and searchable):
```
[WHO]: Provides buildSystemPrompt(), BuildSystemPromptOptions interface
[WHO]: Provides AgentSession, SessionManager, EventBus
[WHO]: Exports createApp(), configureRoutes(), AppOptions type
[WHO]: Provides CSS variables, theme tokens, color palette constants
[WHO]: Defines UserSchema, LoginRequest, LoginResponse types
```

### FROM — Dependency Chain

FROM should list the key dependencies, not every import.

❌ Bad:
```
[FROM]: Depends on many external packages
[FROM]: Uses various internal modules
```

✅ Good:
```
[FROM]: Depends on config for settings, skills for plugin discovery, tools for registration
[FROM]: Depends on @pencil-agent/agent-core for Agent class, ai package for model providers
[FROM]: Depends on zod for validation, express for routing, prisma for database
```

### TO — Consumer Chain

TO should list who depends on this file, enabling impact analysis.

❌ Bad:
```
[TO]: Used by other modules
[TO]: Consumed by the application
```

✅ Good:
```
[TO]: Consumed by agent runtime for session management, SDK for programmatic access
[TO]: Consumed by interactive-mode, print-mode, rpc-mode (all three run modes)
[TO]: Consumed by auth middleware, user service, admin panel
```

### HERE — Location + Role

HERE should tell the reader what this file does in context, not just where it sits.

❌ Bad (just restates path):
```
[HERE]: core/runtime/agent-session.ts
[HERE]: src/utils/format.ts
```

✅ Good (path + role + relationships):
```
[HERE]: core/runtime/agent-session.ts - wraps Agent core with session persistence; consumed by tools, extensions
[HERE]: src/utils/format.ts - date/currency/number formatting; shared across all UI components
[HERE]: src/middleware/auth.ts - JWT verification gate; sits between router and controllers
```

---

## P3 Quality Gate Checklist

Before delivering P3 headers, verify ALL items:

```
□ 1. WHO — lists actual top-level exports (verified by reading the file)
□ 2. FROM — lists actual key imports (not every import, but the important ones)
□ 3. TO — lists actual consumers (verified by grep for imports of this file)
□ 4. HERE — path matches actual location, describes role accurately
□ 5. SYNTAX — uses correct comment syntax for the file's language
□ 6. PLACEMENT — at top of file, after any license/copyright comments
□ 7. BRIEF — each field is 1-2 lines, not a paragraph
□ 8. NO FABRICATION — every claim verified against actual code
□ 9. NO DUPLICATES — no repeated information between fields
□ 10. SEARCHABLE — WHO uses names that can be grep'd in the codebase
```

---

## Insertion Rules

1. **Position**: After any existing license/copyright headers, before any other code
2. **Spacing**: One blank line after P3 header, before the rest of the file
3. **Existing headers**: If a file already has a docstring/comment block at the top that serves a similar purpose, integrate the P3 fields into it rather than adding a duplicate block
4. **Generated files**: Skip P3 for auto-generated files (e.g., .d.ts, generated protobuf, GraphQL schema output)
5. **Config files**: Skip P3 for pure configuration files (JSON, YAML, TOML) unless they contain significant logic
