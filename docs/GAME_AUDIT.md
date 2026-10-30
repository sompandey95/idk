# SYNAPSE: Overdrive — audit and proposed direction

> Historical assessment of the original prototype, before v0.2. See [REBUILD.md](REBUILD.md) and the [README](../README.md) for the current implementation.

Reviewed on 29 October 2026. This document evaluates the supplied code against the original game request and proposes an order for improving it. It does not claim that gameplay quality can be established without playtesting.

## Assessment

The project is a recognizable arcade prototype with a coherent neon identity, procedural audio, local persistence, a working screen flow, mathematical helpers, and real Firestore subscription code. Those are useful foundations.

Its most serious problem is player agency: the main simulation chooses routes randomly without using the weights the player adjusts. Several supporting features have interfaces without the complete behavior those interfaces describe. A visual redesign alone would leave that problem intact.

The next milestone should be a short, understandable, reliable game session on desktop and mobile. Competitive services and recurring content should build on that session.

## Verified startup and changes made during this audit

The initial `npm install` failed with an esbuild peer dependency conflict. The project declared esbuild `^0.25.0`; the resolved Vite 8.3.5 requires `^0.27.0 || ^0.28.0`. The direct dependency was updated to `^0.28.2`, the Bun lockfile was refreshed, and an npm lockfile was generated.

Verified:

- `npm run dev`: starts at http://localhost:3000.
- `npm run lint`: passes TypeScript checks.
- `npm run build`: passes. The main JavaScript chunk is approximately 891 kB minified / 269 kB gzip; Vite reports a chunk-size warning.
- `npx tsx --test src/game/neuralEngine.test.ts`: all seven tests pass.
- Chrome browser checks at 1440×900 with device pixel ratios 1 and 2, 390×844 with device pixel ratio 3, and 844×390 with device pixel ratio 1.
- Seven translation dictionaries have the same 56 keys.

Git was initialized, the existing GitHub history fetched, and local `main` attached to `origin/main` for `https://github.com/sompandey95/idk.git`, preserving the working files.

Gameplay source was not changed during this audit. The existing tests exercise helpers; passing them does not verify the full simulation, online competition, persistence recovery, or mobile interaction.

## Method and evidence limits

All supplied game and service modules were reviewed. Browser checks used isolated local browser profiles. Firebase traffic was blocked in the browser probes to keep synthetic scores and profiles out of the connected database. Real Firebase authorization, deployed rules, multi-device sessions, and live multiplayer have not been tested.

Screenshots show ordinary rendered screens. Some controlled probes called the actual React event handlers with synthetic packet arrivals or passed synthetic run statistics to the storage module. Those probes isolate logic defects; they are not claims about observed player skill or playtest results.

Raw browser observations are in [audit/results.json](audit/results.json). Screenshots include [desktop gameplay](audit/desktop-playing.png), [high-density desktop gameplay](audit/desktop-hidpi-playing.png), [phone gameplay](audit/phone-playing.png), [phone landscape](audit/phone-landscape-playing.png), and [leaderboard fallback](audit/desktop-leaderboard.png).

## Original request versus implementation

| Requested capability | What is present | Assessment |
| --- | --- | --- |
| Neural network game | Node graph, packet animation, activation/loss helpers, adjustable edge weights | The helpers are not integrated into packet routing; changing weights does not direct packets. |
| Dynamic difficulty | Accuracy/streak-based changes to speed, spawn interval, and anomaly probability | Implemented heuristic, but its latency input and timer behavior need correction. No trained model is needed for this feature. |
| Real-time Firebase leaderboard | `onSnapshot`, score ordering, regional tabs | Real subscription code exists, but filtering, ownership, score validation, fallback presentation, and personal rank are incomplete. |
| Minimal neon interface | Cohesive dark background, neon palette, typography, SVG emblem | Strong recognizable direction. Visual hierarchy and readability need work. |
| Responsive touch controls | Pointer events and some responsive CSS | High-density scaling crops the graph; landscape height clips it; controls and connection handling need revision. |
| Haptic support | Feature-detected `navigator.vibrate` calls | Useful optional enhancement. Feedback is partly coupled to sound and actual device support varies. |
| Cross-platform synchronization | Profile upload and manually copied Base64 token | Partial manual transfer; no authenticated automatic cloud restore or ongoing device reconciliation. |
| Offline accessibility | Local statistics and a custom pending leaderboard queue | An already-loaded game can continue. No service worker or durable Firestore cache configuration; robust offline relaunch and recovery are missing. |
| Multiple languages | English, Spanish, German, French, Japanese, Chinese, Korean dictionaries | Dictionary coverage is consistent, but much interface text is hardcoded and the selected language resets on reload. |
| Global player statistics | Local totals and a bounded leaderboard | No complete global aggregates, complete personal ranking, or competitive match statistics. |
| Achievements | Eight definitions and end-of-run unlock evaluation | Some work, some count the wrong events, and weight tuning has no unlock implementation. |
| Daily challenges | One repeated daily task and progress | Accuracy requirement is ignored; no daily task rotation. |
| Seasonal events | Season XP, tier display, reward descriptions | Season is hardcoded and the displayed cosmetics/audio rewards are not applied. No event schedule or distinct event gameplay. |
| Detailed profiles | Editable name/region and local career statistics | Useful starting point; identity, restoration, completeness, and sync status need work. |
| Competitive multiplayer | Host/join documents, room codes, duel overlay | Current in-game opponent score is random in both modes; match state, fair inputs, score publication, and result resolution are incomplete. |
| Social integration | Sharing a room code | Broader social functionality is absent. A focused invite and rematch flow would be a better next step than a social feed. |

## Critical findings

### 1. Weight tuning does not determine routes

**Evidence:** `src/App.tsx:213` and `src/App.tsx:272` choose edges using `Math.random()` over candidate edges. Neither consults edge weight, activation, or packet vector. `calculateSynapseSignal`, `computeActivation`, and `calculateLoss` are not used to drive gameplay outcomes. Node values and biases are not updated by a forward pass.

**Controlled confirmation:** Holding the random choice constant, changing the two outgoing weights of `hid_1` to -2 and +2 still sent the same packet class to `out_0`.

**Impact:** The main control teaches an expectation that the game does not honor. Connection creation can change available routes, but tuning their strength does not select or suppress them. Inverting weights is consequently cosmetic for routing.

**Recommendation:** Establish a readable rule linking player edits to routes. A small deterministic weighted-signal calculation is sufficient if neural behavior is central. If the intended game is a routing arcade, explicit switches or route priorities may communicate choices better. Test those alternatives before adding more mathematical concepts. Do not introduce an AI API or large ML dependency just to justify the theme.

### 2. The graph is cropped on high-density screens

**Evidence:** `src/components/NeuralCanvas.tsx:237` uses the physical backing dimensions for world coordinates; `:503` also multiplies the backing dimensions by DPR and `:510` scales the context. That applies the scale twice to graph placement.

**Browser confirmation:** At DPR 1, all eleven node centers are visible at 1440×900. At DPR 2, the entire output layer is outside the viewport. The same output-layer loss occurs at a 390×844, DPR 3 phone viewport, where the code caps the rendering DPR to 2. Landscape is independently clipped by the 420-pixel minimum canvas height: the board bottom reaches 594.5 on a 390-pixel-tall viewport.

**Recommendation:** Use CSS-pixel coordinates for layout and interaction, apply DPR once to the drawing buffer, and size the board to the available viewport. Add a portrait-specific topology rather than shrinking the desktop layout.

### 3. Online competition does not use the opponent's live score

**Evidence:** `src/App.tsx:232` runs the same random score generator for any duel mode other than `none`. The game does not subscribe to match score changes. `:196` submits the final score with `isHost=true`, including for a guest. The match seed is stored but never drives the packet stream. Joining fabricates host data and a seed rather than restoring the real match record.

**Related defects:** The host listener is not cleaned up. Repeated active snapshots can schedule repeated starts. Joining has no transactional seat reservation. Room creation ignores failure. There is no complete winner/tie/disconnect resolution.

**Recommendation:** Retain ghost practice as an explicitly simulated opponent. Build real duels only when both players receive the same seeded challenge, a shared start time, clear host/guest roles, participant-only writes, actual score subscriptions, and a trustworthy result path. Firestore can remain the lobby and score transport for this game; a new real-time engine is not automatically necessary.

### 4. Duel time and opponent score reset during play

**Evidence:** `src/App.tsx:259` depends on `handleGameOver`, whose identity changes with score and accuracy. Each restart of the effect resets the timer and opponent score at `:238`.

**Controlled confirmation:** After one second the HUD showed 59 seconds and a nonzero opponent score. A successful packet changed the player's score to 225, reset time to 60 seconds, and reset the opponent to zero. Returning to the menu and starting a normal run retained the duel overlay because the mode was not reset.

**Recommendation:** Give each run a fresh explicit mode and run ID. Use elapsed simulation time for solo play and an agreed deadline for an online match. Keep timer lifetime independent of changing scores.

### 5. The checked-in rules do not establish ownership

**Evidence:** `firestore.rules:26`, `:41`, and `:54` permit writes based on data shape without checking `request.auth` or participant identity. The leaderboard update rule checks only nondecreasing score; the match update rule checks only that status is a string. The test collection is publicly writable. `getAuth` is initialized, but no sign-in or account-link flow is used in the source.

**Scope:** This is a finding about the rules file supplied in the repository. The audit did not inspect or attack the deployed database.

**Recommendation:** Support immediate guest play, then account linking for recovery and cross-device identity. Use authenticated ownership checks for private player data and participant checks for matches. A competitive leaderboard also needs score validation beyond authentication: a logged-in client can still submit invented points. Verified ranked runs should use server-issued challenges and replay/result checks appropriate to the game's threat model.

## Other confirmed correctness and completeness issues

| Finding | Evidence and implication | Priority |
| --- | --- | --- |
| Tuning a weight spawns another packet | `src/App.tsx:229` depends on synapses and calls `spawn()` immediately when the effect restarts. Browser probe: `pkt_1` became `pkt_1, pkt_2` after a weight change before the normal interval. | High |
| Difficulty measures time since the most recent spawn | `src/App.tsx:288` subtracts a shared `lastPacketTimeRef`; it does not measure that packet's lifespan or the player's response. Incoming traffic can distort the metric. | High |
| Quarantine can reduce integrity to zero without ending the run | The clean-packet quarantine branch subtracts HP but has no game-over transition. Controlled arrivals reached 0% with state still `playing`. | High |
| Final statistics can omit the fatal outcome | Game-over uses the previous render's DDA accuracy while an outcome update is still pending. Shared closure HP and combo also make simultaneous arrivals worth regression coverage. | High |
| Opening hub modals leaves the solo game running | `showLeaderboard`, profile, language, and achievement flags do not pause simulation. Browser probe: classified-packet total increased behind the leaderboard. | High |
| Drag preview uses stale state | The render effect has empty dependencies and closes over the initial connection state. A browser drag produced no dashed-preview draw calls. | Medium |
| Pointer lifecycle is incomplete | No pointer capture, cancellation, or paused-state input guard. Cross-layer checking also permits hidden-to-input links rather than enforcing forward layer order. | Medium |
| Pruning can strand active packets | Rendering advances only packets whose synapse still exists; removed connections leave their packets unresolved. | Medium |
| Feedback particles expire before drawing | New particles have `life: 1`; the render loop decrements life and removes them immediately, despite a larger `maxLife`. | Low |
| Invalid achievements and daily progress | `sessionPacketsCount` counts every output arrival, while daily progress and First Pulse interpret it as correct classifications. A synthetic zero-accuracy run completed the daily and unlocked First Pulse. | High |
| Weight-tuning achievement is unreachable | Definition exists, but `recordRunStats` has no `weight_tuner` branch or tuning-count input. | Medium |
| Achievement thresholds differ from their text | Reaching epoch 5 is treated as clearing epoch 5. A nine-packet streak unlocks a reward described as a 4× multiplier even though the scoring formula's multiplier at that streak is 2.5×. | Medium |
| Daily rewards can leave the tier stale | Tier is calculated before daily bonus XP. Probe: 1,550 XP remained tier 1 instead of tier 2. | Medium |
| Manual sync is incomplete and not tamper resistant | The token omits achievements, daily progress, game totals, and active runs; its fields are editable Base64 JSON. It uploads snapshots but never fetches a cloud profile for restore. | High |
| Sync export breaks for some localized names | `btoa(JSON.stringify(...))` throws for non-Latin-1 names. Confirmed using `玩家`. | Medium |
| Offline recovery is incomplete | No service worker is registered. Online-path rejected writes are not put into the custom queue, and profile updates are not included in its offline entries. The reconnect handler lives inside the leaderboard modal. | High |
| Queue flushing can overwrite newer local changes | It loads a state snapshot, awaits uploads, then saves that entire old snapshot. A run recorded during those awaits can be overwritten. | High |
| Leaderboard filtering happens after the global limit | `src/services/firebase.ts:132` fetches global top 50, then filters region and season locally. Regional leaders outside that subset disappear. Rank is just the index of displayed rows. | High |
| Best-score preservation is incomplete | Every run overwrites the same player/season document. With the supplied nondecreasing-score rule, lower runs are rejected; with permissive deployed rules, they can replace a higher score. Retrying rejected lower runs can also leave queue entries pending. | High |
| Demo scores appear as real rankings | `LeaderboardModal.tsx:55` silently inserts fictional names and a fabricated 88% player accuracy. `navigator.onLine` controls the 'cloud active' label independently of Firestore success. Profile save likewise reports sync success even when the service returns false. | High |
| Localization stops at selected labels | Graph text, achievement definitions, challenge text, multiplayer descriptions, status messages, and much profile content remain English. No selected-language persistence, document-language update, or explicit locale number/date formatting. | Medium |
| Haptics depend partly on audio | Several audio methods return immediately when muted before reaching their haptic call. Audio and vibration preferences should operate independently. | Medium |
| Modal accessibility is incomplete | Feature modals lack dialog semantics, focus trapping, focus restoration, and comprehensive close labels. The graph has no keyboard route-editing alternative. Browser zoom is disabled in the viewport declaration. | Medium |
| Background and frame-rate behavior need definition | RAF advances packet state, while interval clocks spawn packets. Hidden-tab throttling and the 50 ms delta cap can make simulation and spawn time diverge. | Medium |
| Mobile controls need more room | Header icon controls measured 30×30 CSS pixels on the phone viewport; tactical controls were 26.5 pixels tall. A 44-pixel minimum is a proposed design target, not a claim about universal standards. | Medium |

## What should be kept

- The name, neon palette, dark playing field, and neural motif form a usable identity.
- React for the shell and Canvas for the board are reasonable for eleven nodes and a small packet budget.
- Procedural Web Audio avoids loading audio assets and supports immediate feedback.
- Mathematical helpers can support a real tiny neural simulation if that becomes the chosen mechanic.
- Local saves and existing service separation provide a starting point for more reliable persistence.
- Real Firestore subscriptions and consistently shaped translation dictionaries are useful implementation work.

The evidence does not justify replacing the stack, adding a game engine, moving work to a worker, adopting WebGL, or loading a large ML library as the first intervention.

## Proposed game and interface

### A clear first session

The objective should be understandable in one sentence: **Route signals to matching gates and isolate corrupted signals before the core fails.**

Start with a short interactive tutorial showing one signal and two possible destinations. Let the player make an edit and immediately see the resulting route change. Add the third class and quarantine after the basic rule is understood. Initial session length, wave length, and tutorial timing should be tested rather than treated as fixed truths.

Every available action needs a visible consequence: selecting a node highlights legal destinations; adjusting a route previews the likely signal path; success reinforces the matching color and symbol; damage points to the mistake. Avoid mechanics whose only explanation is neural-network terminology.

### A more focused visual hierarchy

| Screen | Proposed behavior |
| --- | --- |
| Home | Distinctive neural emblem and restrained neon title; one prominent Play action; personal best and daily challenge visible; secondary Profile, Rankings, and Settings navigation. |
| Desktop game | The board gets most of the space. Score, wave, and integrity are immediately readable. Detailed difficulty telemetry belongs in an optional inspector. |
| Phone game | Portrait-specific top-to-bottom topology, usable node spacing, safe-area padding, and a small bottom action area within thumb reach. Tap source then destination is a first-class alternative to dragging. |
| Selected node/route | Clear selection ring, legal destination highlights, labeled adjustment controls, and an immediate route preview. |
| Pause/settings | Volume, independent haptics, motion intensity, contrast/color options, language, and input guidance. A modal suspends casual play; ranked games use explicit rules for deadlines and disconnects. |
| Results | Score, personal-best comparison, why the run ended, meaningful achievements, and one obvious retry action. Duel results include win/loss/tie and opponent result. |
| Rankings | Real loading, empty, offline, pending, rejected, and connected states; regional/season queries; personal rank even outside the first page. |

Use a consistent class color on packet, destination, and success feedback. Add shapes or symbols so color is not the only cue. Reduce competing glow, avoid microtext for essential information, respect reduced-motion preferences, and use short animations whose meaning remains legible.

### Honest modes

1. **Adaptive solo:** difficulty reacts gradually to a rolling window of meaningful outcomes. Measure actual decisions if reaction time is used. Add warmup and hysteresis so a single outcome does not jerk the pace around.
2. **Daily challenge:** a shared deterministic seed with explicit scoring and completion rules. Challenge identity and reset boundary should be clearly specified, including whether the day is global UTC.
3. **Duels:** a shared challenge and difficulty schedule. Hidden per-player adaptation should not silently change ranked competitive conditions. Keep casual, adaptive, and verified competitive results distinguishable.

An exact target accuracy, timing window, cooldown, and difficulty formula are balancing hypotheses. They need playtests with both new and experienced players.

## Architecture changes proportional to the game

- Move simulation updates out of the renderer into a small typed engine with explicit run state, seeded randomness, and one clock. Keep React for menus and HUD snapshots; Canvas renders the current state.
- Define transitions for title, tutorial, playing, paused, finishing, and results. Finalize each run once and attach a unique run ID to saved/submitted results.
- Persist versioned local state with validation and safe migrations. Add an active-run checkpoint if resuming between devices is truly part of the intended experience; career-progress sync alone does not resume a live board.
- Cache the app shell and required assets for offline relaunch. Use a durable run journal/outbox with stable IDs, acknowledgements, and retry logic. Avoid two independent queues submitting the same record. Firestore persistent caching can help with read data but does not cache the website itself.
- Guest play should remain immediate. Account linking provides a recoverable identity for cloud restore; cloud synchronization needs explicit max/union/event-based merge rules rather than blindly overwriting progress with the last device's snapshot.
- Preserve best scores atomically and keep competitive result validation behind a trusted boundary. Treat offline casual runs as local/pending until the selected competitive verification policy permits publication.
- Query region and season before ordering/limiting and define indexes, tie handling, and personal-rank retrieval. Do not substitute sample data into real rankings.
- Lazy-load secondary features and avoid shipping unused integrations. Express, Gemini SDK, dotenv, and motion are declared but not used by the current source. Remove or justify them during implementation, after checking the intended future scope.

## Reassessing these recommendations

| Proposal | Judgment after reviewing the evidence |
| --- | --- |
| Fix routing, DPR, run transitions, clock lifetime, and zero-integrity handling | Essential correctness work. These are reproducible or directly traceable defects. |
| Simplify the HUD and add interactive onboarding | Strong design hypothesis supported by tiny controls, jargon, and disconnected selection behavior. Validate comprehension with people. |
| Replace every screen and discard the neon identity | Unnecessary. The identity has value; focus, readability, and interaction matter more than a wholesale reskin. |
| Add a real trained neural model | Optional. A neural-themed game can be excellent with deterministic toy calculations or explicit routing controls. The key requirement is that choices have understandable effects. |
| Use an AI API to adjust difficulty in real time | Unnecessary for this mechanic. A local measured heuristic avoids network dependence during a run. |
| Implement full social profiles, feeds, chat, clans, and large seasonal passes immediately | Premature. Start with invites, rematches, accurate statistics, and achievements that reward working mechanics. |
| Keep Firebase | Reasonable. The current failures are predominantly integration, modeling, and trust issues, not evidence that Firebase cannot serve this game. |
| Promise identical performance and haptics on all hardware | Unsupported. Specify supported devices/browsers, preserve fair rules, and provide appropriate fallbacks. |
| Call the finished game perfect based on a code review | Unsupported. Product quality needs playtesting, accessibility checks, device testing, and evidence of repeat enjoyment. |

## Implementation sequence and completion criteria

1. **Make the core trustworthy.** Player edits affect routing; clock and spawns are stable; HP-zero always ends the run; finalization runs once; all modes reset correctly; topology changes cannot orphan packets.
2. **Make a polished small session.** Interactive onboarding, usable desktop/portrait/landscape layouts, consistent symbols and colors, clear selection, independent feedback settings, keyboard alternatives, and motion controls.
3. **Make progress reliable.** Correct achievements/daily validation, versioned local saves, offline relaunch, durable retries, account recovery, profile restoration, and tested multi-device merge behavior.
4. **Make competition fair.** Authenticated participants, shared challenge conditions, real opponent updates, high-score preservation, regional/season queries, stable ranks, and result verification.
5. **Add reasons to return.** Varied daily tasks, actual cosmetic unlocks, dated seasonal modifiers, rematches, and shareable results after the basic game proves enjoyable.

Useful acceptance checks include identical seeded outcomes at different render rates; no cropped required controls at supported viewport/DPR combinations; correct completion at zero HP; no progression loss after offline completion, closing, and reopening; deduplicated submissions; Japanese/Chinese profile names surviving transfer; and two independent devices agreeing on a completed duel's result.

## Primary documentation consulted

- [Firebase: offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline) — web persistent caching must be configured; Firestore caching does not supply an offline website shell.
- [Firebase: security rules and authentication](https://firebase.google.com/docs/rules/rules-and-auth) — use authenticated identity to authorize access to player data.
- [Firebase: transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) — concurrent updates require explicit consistency handling; client transactions fail offline, so reconcile on reconnect or use a trusted submission service.
- [MDN: devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) — distinguish CSS layout size from the high-resolution canvas backing buffer.
- [MDN: navigator.vibrate](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) — haptic behavior depends on browser and hardware support.
