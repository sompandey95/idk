# Synapse v0.2

The prototype now has a focused home screen using the supplied neural-core artwork, a responsive board, meaningful relay routing, and a fixed-tick simulation. Desktop and portrait use the same model. World coordinates use CSS pixels, with device-pixel scaling applied once.

Selecting a destination sets that connection's weight to 2 and the others to 0.1. Routing evaluates these weights through the ReLU signal helper. A signal commits its destination at the relay. Route edits cannot restart clocks or generate extra packets.

Adaptive flow uses recent outcomes, a six-outcome warmup, a ten-second adjustment gate, and bounded changes. Daily, sprint, and duel modes share a time-based schedule. Difficulty calibration still needs playtests.

## Implemented

- Safe training, adaptive solo, daily runs, sprints, and real Firebase friend rooms.
- Tap, drag, mouse, and keyboard controls; visible selection and previews.
- Stable zero-integrity/timed endings, accurate results, independent haptics, and charged focus.
- Dialog focus handling, solo pausing behind menus, zoom, reduced motion, and seven languages.
- Validated daily progress, action-based achievements, unlockable interface colors, and seasonal XP rollover.
- Versioned saves, migration, Unicode backups, solo checkpoints, cached offline assets, and a durable outbox.
- Google account connection, private profiles, transactional receipts/best scores, regional queries, personal ranks, and actual opponent score updates.
- Separate community boards by scoring mode, without fictional leaderboard entries.

Unused Gemini, Express, motion, confetti, and related dependencies were removed. Firebase and feature panels load in separate chunks. The main app bundle is substantially smaller. The original-quality PNG remains the largest static asset.

## Verification and limits

Use `npm test`, `npm run lint`, and `npm run build`. The checked-in `npm run test:security` script performs 20 checks against a demo Firestore emulator. Browser checks cover desktop, high-density portrait, landscape, modal pausing, two-client score exchange, and production offline reload. Evidence is in `docs/preview`.

Final verification passed 27 automated game/progress tests, 20 permission checks, TypeScript, and the production build. Two isolated browser profiles shared a duel seed and received actual opponent score updates. Transactional upload cleared the outbox, repeated synchronization did not increment the run count again, and a fresh browser restored the cloud profile. Offline reload preserved the run ID and Japanese language selection. The browser checks reported no uncaught JavaScript errors; see `preview/integration-results.json` and `preview/security-results.txt`.

The emulator's Java/Netty `sun.misc.Unsafe` warning comes from its distribution. Successful startup still exposes the local API on port 8088; the warning is unrelated to gameplay.

No production Firebase settings, rules, indexes, OAuth accounts, hosting, or GitHub pushes were changed. Follow the README for live configuration. Community results remain client-reported, not proof of an untampered run. Haptics depend on browser/hardware support. Solo checkpoints can synchronize, while live duels cannot transfer across devices.

The next product evidence should come from players completing training and understanding why a signal succeeds or fails. Test pressure, readability, focus charge, and session length before expanding seasonal or social features.
