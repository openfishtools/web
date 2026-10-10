<!-- caveman-begin -->
Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Answer first: Answer, then reason, then next step.
- Kill ceremony: No greeting, hedging, pleasantries, recap, or closer.
- Short word: "fix" not "implement a solution for".
- Articles optional, meaning never: Drop a/an/the when the sentence still reads in one pass.
- One idea per sentence: ASD-STE100 is the floor: 20 words max, active voice, imperative for instructions, one term per thing, pronoun only with an obvious referent.
- Payload verbatim: Code blocks unchanged.
- Tool runs: bounded status: No text between routine calls.
- User's language: Compress the style, not the language.
- Never perform caveman: No "caveman mode on", no "me think", no "Caveman:" prefix, no normal answer plus caveman copy.

Switch: /caveman (default), /ultracave (fragments, each fact once), /megacave (Classical Chinese 文言文)
Stop: "stop caveman" or "normal mode"

Auto-Clarity: plain prose for security warnings, irreversible actions, step order a fragment could scramble, user confused. Resume after.

Boundaries: code, comments, commits, PRs, docs written normal.
Floor: code, commands, paths, numbers and error strings verbatim; never drop not/never/no/only.
<!-- caveman-end -->

# OpenFishTools Web Platform AI Agent Guidelines

## 1. System Architecture & Component Map
- `index.html`: Main single-page application shell, interactive tool runner grid, resource cards, and modal containers.
- `scripts/portfolio.js`: Core client controller: tool orchestration, dynamic resource catalog rendering, category filtering, search, and fluid FLIP modal morphing.
- `api/index.js`: Express application server handling:
  - `/api/resources`: Live GitHub Org repository fetcher with in-memory cache and zero database dependency.
  - `/api/tools`: Live GitHub tree manifest query mapping tools from `openfishtools/web-tools`.
  - `/api/version`: Dynamic deployment and build commit metadata endpoint.
- `styles/portfolio.css`: Main UI design system tokens, card grids, modal transitions, and responsive styles.
- `assets/projects/`: Official vector SVG project logos (`web.svg`, `web-tools.svg`, `cep.svg`, `studio.svg`).
- `build/`: Staging and Cloudflare Pages builders (`build.js`, `build-cf.js`).
- `package.json`: Single source of truth for web platform version.

## 2. Resource Catalog Rules (ZERO DATABASE DEPENDENCY)
- **NO Database Coupling**: The `/api/resources` route MUST NEVER depend on MongoDB, Mongoose, or database connections.
- **GitHub Live Sync**: Resources are fetched directly from GitHub Organization repositories (`https://api.github.com/orgs/openfishtools/repos`) backed by in-memory caching and resilient fallback registry.
- **No Archive Password**: Do not reintroduce archive password prompts (`#res-modal-password-section`). Public projects require no password.

## 3. Modal Morphing & FLIP Animation Standards
- **Universal Morphing**: Modals use FLIP geometry calculations via `getModalTargetGeometry()`.
- **Resting & Transition States**:
  - Source card must hide during transition and cleanly restore on close.
  - Transition duration must remain clamped (0.34s–0.42s) with `var(--ease-spring-soft)` timing.
- **Responsive Geometry**:
  - Mobile (<= 600px): Bottom-sheet style layout.
  - Desktop (>= 601px): Centered card expansion.

## 4. Strict File Manipulation Tooling (NO SCRIPT-BASED EDITS)
- **STRICTLY FORBIDDEN**: Using Python scripts, Node.js scripts, `sed`, `awk`, `echo >`, `cat << 'EOF'`, or shell redirection to edit or generate code files.
- **MANDATORY**: All file creations and code modifications MUST strictly use the agent's native tool calls (`replace_file_content` or `write_to_file`).

## 5. Error Investigation & Diagnostic Protocol
When debugging UI or server issues:
1. **Localhost Server**: Start dev server (`npm start` or `node api/index.js`) on `http://localhost:3000`.
2. **Inspect Console**: Check browser DevTools console for uncaught exceptions, network failures, or layout reflows.
3. **Build Verification**: Run `npm run build` to verify Cloudflare Pages staging build succeeds before pushing.

## 6. Versioning & SSOT
- **Single Source of Truth**: Platform version is defined in `package.json`.
- **Bumping Version**: Update `"version"` in `package.json` directly. Shields badges and external consumers query this value automatically.
- **NO Hardcoded Fallbacks**: Never hardcode fallback version literals in library files.

## 7. Strict Git Safety & Working Tree Protection
- **Zero Silent Git Changes**: STRICTLY FORBIDDEN to run `git checkout`, `git restore`, `git reset`, `git clean`, `git pull`, `git switch`, or any Git command that alters or discards local changes without explicit user consent.
- **Preserve Uncommitted Work**: Always respect and preserve active uncommitted edits and untracked files in the working directory.
- **Zero Emojis**: Git commit messages, comments, and documentation must never contain emojis.
