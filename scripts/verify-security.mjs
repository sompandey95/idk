import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  setLogLevel,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
// Denial cases are intentional; failed assertions still produce full test errors.
setLogLevel("silent");
const env = await initializeTestEnvironment({
  projectId: "demo-synapse",
  firestore: {
    host: "127.0.0.1",
    port: 8088,
    rules: await readFile(
      path.resolve(import.meta.dirname, "../firestore.rules"),
      "utf8",
    ),
  },
});
const host = env.authenticatedContext("host").firestore();
const guest = env.authenticatedContext("guest").firestore();
const stranger = env.authenticatedContext("stranger").firestore();
const anonymous = env.unauthenticatedContext().firestore();
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS", name);
}
try {
  await env.clearFirestore();
  const profile = {
    state: {
      schemaVersion: 2,
      playerId: "host",
      displayName: "Host",
      region: "EU",
      highScore: 1000,
      totalGames: 1,
    },
    importedRuns: [],
    checkpoint: null,
    updatedAt: new Date().toISOString(),
  };
  await check("owner creates private profile", () =>
    assertSucceeds(setDoc(doc(host, "players_v2", "host"), profile)),
  );
  await check("another user cannot read private progress", () =>
    assertFails(getDoc(doc(guest, "players_v2", "host"))),
  );
  await check("another user cannot edit private progress", () =>
    assertFails(
      updateDoc(doc(guest, "players_v2", "host"), { "state.highScore": 9999 }),
    ),
  );
  await check("unauthenticated users cannot write profiles", () =>
    assertFails(setDoc(doc(anonymous, "players_v2", "host"), profile)),
  );
  const score = {
    uid: "host",
    mode: "adaptive",
    season: "2026-Q4",
    displayName: "Host",
    region: "EU",
    score: 1000,
    accuracy: 90,
    wave: 3,
    completedAt: new Date().toISOString(),
  };
  await check("owner submits community score", () =>
    assertSucceeds(setDoc(doc(host, "scores", "host_adaptive_2026-Q4"), score)),
  );
  await check("public can read community scores", () =>
    assertSucceeds(getDocs(collection(anonymous, "scores"))),
  );
  await check("another user cannot forge a score for host", () =>
    assertFails(
      updateDoc(doc(guest, "scores", "host_adaptive_2026-Q4"), { score: 9000 }),
    ),
  );
  await check("a lower score cannot replace a best", () =>
    assertFails(
      updateDoc(doc(host, "scores", "host_adaptive_2026-Q4"), { score: 100 }),
    ),
  );
  await check("invalid score shape is rejected", () =>
    assertFails(
      setDoc(doc(host, "scores", "host_sprint_2026-Q4"), {
        ...score,
        mode: "sprint",
        score: -1,
      }),
    ),
  );
  const receipt = {
    id: "run1",
    mode: "adaptive",
    seed: 1,
    score: 100,
    wave: 1,
    correct: 1,
    resolved: 2,
    quarantined: 0,
    maxStreak: 1,
    peakDifficulty: 1,
    tuningCount: 2,
    focusUses: 0,
    elapsed: 8,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  await check("owner creates run receipt", () =>
    assertSucceeds(
      setDoc(doc(host, "players_v2", "host", "runs", "run1"), receipt),
    ),
  );
  await check("run receipts cannot be overwritten", () =>
    assertFails(
      updateDoc(doc(host, "players_v2", "host", "runs", "run1"), {
        score: 1000,
      }),
    ),
  );
  const room = {
    id: "A1B2C3D4",
    hostId: "host",
    hostName: "Host",
    guestId: null,
    guestName: null,
    hostScore: 0,
    guestScore: 0,
    hostDone: false,
    guestDone: false,
    status: "waiting",
    seed: 1234,
    startAt: null,
    createdAt: Date.now(),
  };
  await check("host creates duel", () =>
    assertSucceeds(setDoc(doc(host, "duels", room.id), room)),
  );
  await check("room directory cannot be listed", () =>
    assertFails(getDocs(collection(stranger, "duels"))),
  );
  await check("guest can atomically reserve empty seat", () =>
    assertSucceeds(
      updateDoc(doc(guest, "duels", room.id), {
        guestId: "guest",
        guestName: "Guest",
        status: "active",
        startAt: Date.now() + 5000,
      }),
    ),
  );
  await check("a third player cannot replace the guest", () =>
    assertFails(
      updateDoc(doc(stranger, "duels", room.id), {
        guestId: "stranger",
        guestName: "Stranger",
        status: "active",
        startAt: Date.now() + 5000,
      }),
    ),
  );
  await check("guest cannot edit host score", () =>
    assertFails(updateDoc(doc(guest, "duels", room.id), { hostScore: 9999 })),
  );
  await check("host can publish their own score", () =>
    assertSucceeds(updateDoc(doc(host, "duels", room.id), { hostScore: 100 })),
  );
  await check("guest can publish their own final score", () =>
    assertSucceeds(
      updateDoc(doc(guest, "duels", room.id), {
        guestScore: 150,
        guestDone: true,
      }),
    ),
  );
  await check("host cannot change challenge seed", () =>
    assertFails(updateDoc(doc(host, "duels", room.id), { seed: 5678 })),
  );
  await check("finished flag cannot be reversed", () =>
    assertFails(updateDoc(doc(guest, "duels", room.id), { guestDone: false })),
  );
  console.log(`${passed} security checks passed.`);
} finally {
  await env.cleanup();
}
