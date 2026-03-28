# Configured Plugins

## Superpowers

| Skill | Description |
|-------|-------------|
| `brainstorming` | Explores user intent, requirements, and design before implementation. Must be used before any creative work. |
| `writing-plans` | Creates detailed, multi-step implementation plans from specs or requirements before touching code. |
| `executing-plans` | Executes a written implementation plan in a separate session with review checkpoints. |
| `subagent-driven-development` | Executes implementation plans using independent subagents within the current session. |
| `dispatching-parallel-agents` | Runs 2+ independent tasks in parallel when they have no shared state or sequential dependencies. |
| `test-driven-development` | Guides writing tests before implementation code for any feature or bugfix. |
| `systematic-debugging` | Structured debugging process for any bug, test failure, or unexpected behavior before proposing fixes. |
| `verification-before-completion` | Requires running verification commands and confirming output before claiming work is complete. |
| `requesting-code-review` | Initiates code review when completing tasks, implementing major features, or before merging. |
| `receiving-code-review` | Handles incoming code review feedback with technical rigor and verification. |
| `using-git-worktrees` | Creates isolated git worktrees for feature work that needs separation from the current workspace. |
| `finishing-a-development-branch` | Guides completion of development work with structured options for merge, PR, or cleanup. |
| `writing-skills` | Creates, edits, or verifies skills before deployment. |

## Claude-Mem

| Skill | Description |
|-------|-------------|
| `mem-search` | Searches persistent cross-session memory database to recall work from previous sessions. |
| `smart-explore` | Token-optimized structural code search using tree-sitter AST parsing for efficient codebase exploration. |
| `make-plan` | Creates detailed, phased implementation plans with documentation discovery. |
| `do` | Executes a phased implementation plan using subagents. |
| `timeline-report` | Generates a narrative report analyzing a project's full development history from the memory timeline. |

## Feature Dev

| Skill | Description |
|-------|-------------|
| `feature-dev` | Guided feature development with codebase understanding and architecture focus. |

## Frontend Design

| Skill | Description |
|-------|-------------|
| `frontend-design` | Creates distinctive, production-grade frontend interfaces with high design quality. Avoids generic AI aesthetics. |

## UI/UX Pro Max

| Skill | Description |
|-------|-------------|
| `ui-ux-pro-max` | UI/UX design intelligence for web and mobile. Includes 50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, and 25 chart types across 10 stacks. |

## Commit Commands

| Skill | Description |
|-------|-------------|
| `commit` | Creates a git commit. |
| `commit-push-pr` | Commits, pushes, and opens a pull request in one step. |
| `clean_gone` | Cleans up local git branches that have been deleted on the remote. |

## Utilities

| Skill | Description |
|-------|-------------|
| `simplify` | Reviews changed code for reuse, quality, and efficiency, then fixes issues found. |
| `claude-api` | Helps build apps with the Claude API or Anthropic SDK. |
| `keybindings-help` | Customizes keyboard shortcuts and keybindings for Claude Code. |
