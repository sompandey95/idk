# Synapse: Overdrive

Find your flow. Protect the core. A neural routing arcade built with React, TypeScript, Canvas, and Firebase.

## Run locally

```powershell
cd C:\Users\som076\Desktop\idk-main
npm install
npm run dev
```

Open the URL printed by Vite, normally **http://localhost:3000**. Verification used Node.js 24.21.0. Bun is optional.

## Play

Select a relay, then an output. Signals arriving at that relay follow its strongest outgoing connection. Match **α, β, γ** to their destinations and send pink noise to **⊘**. Signals already leaving a relay keep their committed route.

| Input | Action |
| --- | --- |
| Tap/click a relay, then an output | Change a route |
| Drag a relay to an output | Change a route |
| 1–4 | Select a relay |
| A / B / C / Q | Route to Alpha / Beta / Gamma / Quarantine |
| F | Use focus when charged |
| Escape / P | Pause or resume solo play |
| M | Toggle sound |

Correct signals charge a six-second slowdown. Adaptive solo adjusts to recent outcomes. Daily runs, sprints, and duels use fixed difficulty schedules and a 90-second limit. Training ends after four correct signals. Duels continue while their tabs are hidden.

## Offline progress

Profiles, unlocks, settings, paused checkpoints, and pending submissions save on the device. Existing prototype profiles migrate automatically. Profile → Download a backup exports Unicode-safe JSON, including the active run. A backup is local progress, not a sign-in credential.

Offline relaunch requires opening a production build online once and allowing its service worker to finish caching. Development mode intentionally does not register that worker.

```powershell
npm run build
npm run preview
```

Open the preview URL online first. The app and its lazy-loaded features are cached. External fonts fall back to system fonts offline. Browser storage can be cleared or denied; a downloaded backup provides a separate copy.

## Firebase setup

Local gameplay works without Firebase. Google sign-in, cloud restoration, community scores, and friend rooms need configuration on the project in `firebase-applet-config.json`:

1. Enable **Google** under Firebase Authentication and set the support email.
2. Add `localhost` and your eventual hosting domain under **Authentication → Settings → Authorized domains**.
3. Deploy the supplied rules and indexes:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore --project cultivated-orb-q3kqt
```

`firebase.json` targets the named database `ai-studio-529a8d5b-f4be-49fe-bd5b-44906f028ee8`. Review the target before deploying. This implementation session did not change production Firebase settings or deploy anything.

The new collections are `players_v2`, `players_v2/{uid}/runs`, `scores`, and `duels`. Legacy documents are not deleted. Private profiles are owner-only, run receipts are immutable, and duel score changes belong to participants. Transactions preserve best scores and deduplicate uploaded runs. Region and season filtering run before result limits.

Scores are **community competition with client-submitted results**, not server-verified rankings. A trusted validation service is required before claiming cheat resistance or offering prizes. Connected profiles can restore solo checkpoints on another device; live duels cannot transfer between devices.

References: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [authorized domains](https://firebase.google.com/docs/auth/faq-and-troubleshooting), [named databases](https://firebase.google.com/docs/cli#configuration_for_multiple_cloud_firestore_databases), [offline caching](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## Verification

```powershell
npm test
npm run lint
npm run build
```

Tests cover real routing effects, frame-rate independence, timed endings, quarantine failure, pause behavior, focus consumption, restoration, daily accuracy, Unicode backups, migration, and duplicate results. The lint script runs TypeScript checking.

Run the security checks against a local Firestore emulator; Java is required:

```powershell
npx firebase-tools emulators:exec --only firestore --project demo-synapse --config firebase.emulator.json "npm run test:security"
```

For local auth and duel testing, start these in separate terminals:

```powershell
npx firebase-tools emulators:start --only "auth,firestore" --project demo-synapse --config firebase.emulator.json
```

```powershell
$env:VITE_USE_EMULATORS = "true"
npm run dev -- --port 3002
```

Emulator mode uses **demo-synapse** and the local default database. Remove that environment variable or use a fresh terminal for normal Firebase access.

## Source

- `src/game/simulation.ts`: seeded, fixed-tick simulation and weighted routing.
- `src/hooks/useGame.ts`: run lifecycle, feedback, checkpoints, and finalization.
- `src/services/player.ts`: migration, progression, backups, and durable submissions.
- `src/services/firebase.ts`: authentication, cloud reconciliation, leaderboards, and duels.
- `src/components`: home, board, accessible dialogs, and feature panels.
- `scripts/build-sw.mjs`: production app-shell caching.
- `docs/preview`: screenshots and browser results.

See [REBUILD.md](docs/REBUILD.md) for implementation notes and the historical [GAME_AUDIT.md](docs/GAME_AUDIT.md) for the original assessment. Neural-core artwork was supplied by the user and integrated without modifying the image.
