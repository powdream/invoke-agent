# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Gemini, etc.) when working with code in this repository.

## Commands

```bash
bun run dev          # Run CLI without building
bun run build        # Compile binaries for all platforms (tools/build.ts)
bun run lint         # ESLint
bun run typecheck    # tsc --noEmit
bun run format       # Prettier
bun test             # Run all tests
bun test <file>      # Run a single test file (e.g. bun test src/lib/storage/sqlite.test.ts)
bun test --coverage  # Tests with coverage
```

## Release

Releases are triggered via GitHub Actions (`workflow_dispatch`):

```bash
gh workflow run release.yml \
  -f next_version_tag=<version>   # e.g. 1.2.3 or v1.2.3
  [-f ref=<branch-or-sha>]        # defaults to main
```

The workflow:
1. Bumps version in `package.json` and `.claude-plugin/plugin.json`, commits and pushes
2. Creates and pushes a `v<version>` tag
3. Builds binaries for all 5 platforms
4. Creates a GitHub release with zip archives attached

## Architecture

**invoke-agent** is a CLI tool + Claude Code plugin that enables AI agents (Claude, Cursor Agent, Gemini) to invoke each other, maintaining conversation history in a SQLite database.

### Data Flow

```
CLI / Claude Code skills
    ↓
src/cmd/commands/  (prompt, list, summary, history, output)
    ↓
src/lib/invoker/   — spawns external agent CLIs, captures output
    ↓
src/lib/storage/   — persists threads and outputs to SQLite
```

### Key Concepts

- **Thread**: a conversation between a requester agent and a responder agent. Each `prompt` command either resumes an existing responder session or starts a new one.
- **Output**: the raw response from an agent invocation (stdout, stderr, file_content, status_code), addressed by an output ID.
- **Session IDs**: stored and queried as lowercase; always normalize when comparing.

### Storage Schema (`src/lib/storage/sqlite.ts`)

- `schema_meta` — migration version tracking
- `session_threads` — per-session conversation history (requester↔responder, prompts, output IDs)
- `session_summaries` — auto-generated summaries for sessions
- `outputs` — raw agent response data

Database path: `INVOKE_AGENT_DATABASE_PATH` env var or `--db <path>` flag (default: `.invoke-agent/communication.db`).

### Invoker System (`src/lib/invoker/`)

- `invoker.ts` — core logic: resolves existing session, spawns CLI, writes output to temp file, stores in DB
- `dependency.ts` — injectable abstractions for command execution, temp files, and file reads (used in tests via mocks)

### Path Aliases

ESLint enforces no relative imports across module boundaries. Use:
- `@cmd/` → `src/cmd/`
- `@lib/` → `src/lib/`

### Claude Code Plugin

Skills live in `skills/<name>/`. Each skill directory has a `SKILL.md` describing its purpose, trigger conditions, and usage. Plugin metadata is in `.claude-plugin/plugin.json`.

### Build

`tools/build.ts` compiles self-contained binaries for 5 targets: Linux x64/ARM64, Windows x64, macOS x64/ARM64. Tool versions are pinned in `mise.toml` (bun 1.3.10, deno 2.7.5).
