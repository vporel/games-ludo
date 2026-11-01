# CLAUDE.md

Instructions for any AI assistant working on this repository.

## The project

**Ludo** is an online multiplayer Ludo game (2 to 4 players, no computer opponent). A player
creates a room, gets a 6-digit code, shares it, and the host starts the game once at least one
other player has joined (4 players max). See `README.md` for setup and the implemented rules.

UI language: **French**. Code, identifiers and comments: **English**.

### Served under /ludo

Ludo is served at `games.vporel.com/ludo` (`basePath`, constant `BASE_PATH` in
`src/lib/base-path.ts`). The domain root belongs to the games showcase (`../vporel-website-games`),
which may proxy `/ludo` to this app. Next adds the base path to `Link`, `redirect()`, router and
assets by itself; only URLs built by hand (absolute share links, `new URL(...)` in route handlers)
must add `BASE_PATH`. A link to the showcase is a plain `<a href="/">` (`ShowcaseLink`).

### Shared Supabase project

The Supabase project is **shared with Cloverly** (`../cloverly`), which owns unprefixed tables
(`rooms`, `room_players`, ...). Every Ludo table, function, trigger, policy and index is
prefixed `ludo_`. Never create, alter or drop anything without that prefix, and never touch
Cloverly's objects.

### Security model: read this before adding a feature

- **Sign-in is by pseudo only, with no password, by product choice.** Knowing a pseudo is enough
  to sign in as that player. The Supabase password is `HMAC(PSEUDO_PASSWORD_SALT, pseudo)` with a
  constant hardcoded in `src/app/actions/auth.ts`. This is intentional and accepted: the constant
  is not a secret and gives nothing beyond what the login page already gives.
- **Never change `PSEUDO_PASSWORD_SALT`** (nor the derivation) once accounts exist: every existing
  player would be locked out.
- **If a requested feature needs more security than "whoever knows the pseudo is the player"**
  (a PIN or password, private messages, personal data, purchases or anything of value, admin
  rights, moderation, persistent rankings that matter...), **stop and notify the developer before
  implementing it**: explain that the current pseudo-only scheme does not protect it and propose
  a stronger scheme (server-side secret in an env var, real credentials, etc.).
- The server is the authority on the game: the client never rolls the dice nor moves a pawn by
  itself. All writes go through Server Actions (`src/app/actions/`) that check the user, apply the
  pure engine and write with the `service_role` client. RLS gives clients **read-only** access to
  the rooms they belong to. Keep it that way: no client-side insert/update policy.

## Architecture, in brief

```
src/game/             pure game engine, no dependency on React/Next/Supabase (tested)
  constants.ts        colors, track length, safe cells, player counts, turn duration
  board.ts            15x15 grid geometry: track, home columns, bases, cell for a progress
  engine.ts           rules: createGame, applyRoll, movePawn, forfeit, autoPlay, standings
  describe.ts         French log lines for game events
src/lib/              neutral helpers (pseudo, room code, types, game-row) + Supabase clients
src/server/rooms.ts   server-only DB access, optimistic locking on ludo_games.version
src/app/actions/      Server Actions: auth.ts (pseudo sign-in), room.ts (lobby + game moves)
src/components/       Board (SVG), Dice (3D CSS), GameView, Lobby, useRoom (realtime + polling)
src/app/dev/          local hot-seat playground without Supabase, development only (/dev)
supabase/migrations/  SQL run by hand in the Supabase SQL Editor
```

Dependencies flow downward: `src/game/` never imports from the UI, Next or Supabase.

- **Game state** is one JSON document (`GameState`) in `ludo_games.state`. Every change goes
  through `mutateGame()`, which checks `version` (stale clicks are rejected) and records the
  events in `ludo_moves`. A rematch starts a new game (`started_at` changes, versions restart at 0):
  compare games with `newerGame()`, never by version alone.
- **Pawn progress**: `-1` base, `0..50` shared track, `51..55` home column, `56` finished.
- **Turn timer**: 30 s. When the deadline passes, any member's client calls `expireTurn`, and the
  server auto-plays only if the deadline has really passed.
- **Realtime**: `useRoom` subscribes to `ludo_games`, `ludo_rooms`, `ludo_room_players`, presence,
  and a `refresh` broadcast, with periodic polling as a safety net.

## Manual operations

When a change adds, removes or updates a dependency, say in the end-of-task report that the next
deploy must use `npm run build-full` (the server's `node_modules` must be replaced).

The developer runs migrations, sets keys in `.env.local` and changes Supabase settings
themselves. Focus on code and tests; list any manual step needed in `à-faire.md` (in French).

**Migrations**: never edit a migration that may already have been run. Add a new numbered file
(`supabase/migrations/00N_description.sql`), idempotent where possible (`if not exists`,
`drop policy if exists`), and say in `à-faire.md` that it must be run. Ask the developer when
unsure whether the latest one has been run.

## Commands

```bash
npm run dev      # dev server (Turbopack): http://localhost:3000/ludo, playground at /ludo/dev
npm run build    # production build + ludo.zip WITHOUT node_modules (o2switch cPanel deploy)
npm run build-full # same WITH node_modules: first deploy, or after adding/updating a package
npm test         # Vitest suite
npm run lint     # ESLint
npx tsc --noEmit # type checking
```

**Verification cadence**: don't re-run tsc/lint/the full test suite after every small step. Run
them at the end of the task. Mid-task, only run the tests affected by the change
(`npx vitest run path/to/file.test.ts`).

**`npm run build`**: not a routine check. Use it only when a change can break the build in a way
tsc/lint can't catch (Server ↔ Client Component boundaries, new routes, `next.config`, env vars,
middleware).

## Repository conventions

- **Imports**: alias `@/...` for anything in `src/`. A relative import going up at most one level
  is fine.
- **No `index.ts` barrel files.**
- **Tests**: co-located next to the file under test (`fileName.test.ts`).
- **Game rules live in `src/game/engine.ts`**, written once and reused (server actions, auto-play,
  client highlighting). Never re-derive a rule in a component or a server action.
- **Hook dependencies** (`useEffect`, `useCallback`, `useMemo`): check that they are complete
  after any change to their body.
- **Hydration**: never read the clock (`Date.now()`) or `Math.random()` during render of a
  component that is server-rendered. Read it in an effect.
- **Board colors**: the board always uses the light palette (constants in `Board.tsx`), even in
  dark mode. The rest of the page follows the CSS variables in `globals.css`.
- Minimal, targeted changes. Follow the existing style of neighboring files.
- **Never `git commit` unless explicitly asked.**
- **Comments**: only for a non-trivial constraint or invariant the code doesn't show. Never
  document decision history ("instead of X", "before/after") nor restate what a good name
  already says. A comment must be understandable without the conversation that produced it.
- **Punctuation in prose** (UI strings, docs): prefer a colon (`:`) over an em dash (`—`) to
  introduce an explanation. Exception: the site-name suffix of page titles (`Connexion — Ludo`).

## Ambiguity in a request

When in doubt about what the user is asking for, ask rather than guess, even for a detail that
seems minor. But never ask a question whose answer you can obtain yourself (package version,
whether a file exists...): check and report.

## Tests and bugs discovered while testing

Any new or modified logic (engine rule, server action branch, helper) must come with dedicated
tests. The engine (`src/game/`) must stay fully covered: every rule has a test.

If a test reveals that the source code is wrong, don't rewrite the test to pass on broken
behavior. Report what was found and fix it if the fix is localized and safe; otherwise raise the
question first.

## Do not disclose the name of the underlying model unless the user explicitly asks for it.
