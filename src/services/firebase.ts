import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  connectAuthEmulator,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  runTransaction,
  updateDoc,
  getCountFromServer,
  connectFirestoreEmulator,
  deleteDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import config from "../../firebase-applet-config.json";
import {
  applyRunToPlayer,
  currentSeason,
  loadCheckpoint,
  loadPlayer,
  normalizePlayerState,
  saveCheckpoint,
  savePlayer,
} from "./player";
import type { PlayerState, RunRecord } from "./player";
import { isRunCheckpoint } from "../game/simulation";

const emulated = import.meta.env.VITE_USE_EMULATORS === "true";
const existingApp = getApps().length ? getApp() : null;
const app =
  existingApp ??
  initializeApp(emulated ? { ...config, projectId: "demo-synapse" } : config);
export const auth = getAuth(app);
const databaseId = emulated ? "(default)" : config.firestoreDatabaseId;
export const db = existingApp
  ? getFirestore(app, databaseId)
  : initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      databaseId,
    );
if (emulated && !existingApp) {
  connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8088);
}
export const observeAccount = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);
export async function connectAccount() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return (await signInWithPopup(auth, provider)).user;
}

export interface ScoreEntry {
  uid: string;
  displayName: string;
  region: string;
  score: number;
  accuracy: number;
  wave: number;
  mode: "adaptive" | "daily" | "sprint";
  season: string;
  completedAt: string;
}
export function boardSeason(mode: string): string {
  return mode === "daily"
    ? new Date().toISOString().slice(0, 10)
    : currentSeason();
}
function scoreId(uid: string, mode: string, season: string) {
  return `${uid}_${mode}_${season}`;
}
export function subscribeBoard(
  mode: string,
  region: string,
  update: (entries: ScoreEntry[], cached: boolean) => void,
  error: (error: unknown) => void,
) {
  const filters = [
    where("mode", "==", mode),
    where("season", "==", boardSeason(mode)),
  ];
  if (region !== "GLOBAL") filters.push(where("region", "==", region));
  return onSnapshot(
    query(
      collection(db, "scores"),
      ...filters,
      orderBy("score", "desc"),
      limit(50),
    ),
    { includeMetadataChanges: true },
    (snap) =>
      update(
        snap.docs.map((d) => d.data() as ScoreEntry),
        snap.metadata.fromCache,
      ),
    error,
  );
}
export async function getPersonalRank(
  uid: string,
  mode: string,
  region: string,
): Promise<{ entry: ScoreEntry; rank: number } | null> {
  const snapshot = await getDoc(
    doc(db, "scores", scoreId(uid, mode, boardSeason(mode))),
  );
  if (!snapshot.exists()) return null;
  const entry = snapshot.data() as ScoreEntry;
  if (region !== "GLOBAL" && entry.region !== region) return null;
  const filters = [
    where("mode", "==", mode),
    where("season", "==", boardSeason(mode)),
    where("score", ">", entry.score),
  ];
  if (region !== "GLOBAL") filters.push(where("region", "==", region));
  const higher = await getCountFromServer(
    query(collection(db, "scores"), ...filters),
  );
  return { entry, rank: higher.data().count + 1 };
}

let syncing: Promise<void> | null = null;
async function performSync(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Account required");
  const uid = user.uid;
  const localAtStart = loadPlayer();
  const profileRef = doc(db, "players_v2", uid);
  // Create a profile from existing local career data once, preserving migrated progress.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists()) {
      const state = { ...localAtStart, playerId: uid, pendingSyncQueue: [] };
      transaction.set(profileRef, {
        state,
        importedRuns: localAtStart.pendingSyncQueue.map((run) => run.id),
        checkpoint: loadCheckpoint(),
        updatedAt: new Date().toISOString(),
      });
    }
  });
  for (const record of localAtStart.pendingSyncQueue) {
    if (auth.currentUser?.uid !== uid) throw new Error("Account changed");
    const ledgerRef = doc(db, "players_v2", uid, "runs", record.id);
    const publish = ["adaptive", "daily", "sprint"].includes(record.mode);
    const season =
      record.mode === "daily"
        ? record.startedAt.slice(0, 10)
        : `${new Date(record.completedAt).getUTCFullYear()}-Q${1 + Math.floor(new Date(record.completedAt).getUTCMonth() / 3)}`;
    const scoreRef = doc(db, "scores", scoreId(uid, record.mode, season));
    await runTransaction(db, async (transaction) => {
      const [profile, ledger, score] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(ledgerRef),
        publish ? transaction.get(scoreRef) : Promise.resolve(null),
      ]);
      if (ledger.exists()) return;
      const saved = normalizePlayerState(profile.data()?.state);
      const imported: string[] = profile.data()?.importedRuns ?? [];
      const state =
        imported.includes(record.id) || saved.recordedRunIds.includes(record.id)
          ? saved
          : applyRunToPlayer(saved, record).state;
      transaction.set(ledgerRef, record);
      transaction.update(profileRef, {
        state: { ...state, playerId: uid, pendingSyncQueue: [] },
        importedRuns: imported.filter((id) => id !== record.id),
        updatedAt: new Date().toISOString(),
      });
      if (publish && (!score?.exists() || record.score > score.data().score)) {
        const entry: ScoreEntry = {
          uid,
          mode: record.mode as ScoreEntry["mode"],
          season,
          displayName: localAtStart.displayName,
          region: localAtStart.region,
          score: record.score,
          accuracy: record.resolved
            ? Math.round((record.correct / record.resolved) * 100)
            : 100,
          wave: record.wave,
          completedAt: record.completedAt,
        };
        transaction.set(scoreRef, entry);
      }
    });
    // Read again after await: a newly finished run must not be overwritten by this acknowledgement.
    const latest = loadPlayer();
    latest.pendingSyncQueue = latest.pendingSyncQueue.filter(
      (r) => r.id !== record.id,
    );
    savePlayer(latest);
  }
  const profile = await getDoc(profileRef);
  if (auth.currentUser?.uid !== uid) throw new Error("Account changed");
  const latest = loadPlayer();
  let merged = normalizePlayerState(profile.data()?.state);
  for (const pending of latest.pendingSyncQueue)
    if (!merged.recordedRunIds.includes(pending.id))
      merged = applyRunToPlayer(merged, pending).state;
  merged.playerId = uid;
  merged.highScore = Math.max(merged.highScore, latest.highScore);
  merged.displayName =
    latest.displayName === "Operator" && merged.displayName !== "Operator"
      ? merged.displayName
      : latest.displayName;
  merged.region =
    latest.totalGames === 0 && merged.totalGames > 0
      ? merged.region
      : latest.region;
  merged.equippedSkin = latest.equippedSkin;
  merged.pendingSyncQueue = latest.pendingSyncQueue;
  savePlayer(merged);
  const remoteCheckpoint = profile.data()?.checkpoint;
  const localCheckpoint = loadCheckpoint();
  const nextCheckpoint =
    localCheckpoint &&
    (!isRunCheckpoint(remoteCheckpoint) ||
      localCheckpoint.id !== remoteCheckpoint.id ||
      localCheckpoint.tick >= remoteCheckpoint.tick)
      ? localCheckpoint
      : isRunCheckpoint(remoteCheckpoint) &&
          !merged.recordedRunIds.includes(remoteCheckpoint.id)
        ? remoteCheckpoint
        : null;
  if (!localCheckpoint && nextCheckpoint) saveCheckpoint(nextCheckpoint);
  // Career counters are only changed by ledger transactions, never by this metadata update.
  await updateDoc(profileRef, {
    "state.displayName": merged.displayName,
    "state.region": merged.region,
    "state.equippedSkin": merged.equippedSkin,
    checkpoint: nextCheckpoint,
    updatedAt: new Date().toISOString(),
  });
}
export function syncProgress(): Promise<void> {
  if (syncing) return syncing;
  syncing = performSync().finally(() => {
    syncing = null;
  });
  return syncing;
}

export interface DuelRoom {
  id: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  hostScore: number;
  guestScore: number;
  hostDone: boolean;
  guestDone: boolean;
  status: "waiting" | "active";
  seed: number;
  startAt: number | null;
  createdAt: number;
}
export async function createRoom(displayName: string): Promise<string> {
  if (!auth.currentUser) throw new Error("Account required");
  const id = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const room: DuelRoom = {
    id,
    hostId: auth.currentUser.uid,
    hostName: displayName,
    guestId: null,
    guestName: null,
    hostScore: 0,
    guestScore: 0,
    hostDone: false,
    guestDone: false,
    status: "waiting",
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
    startAt: null,
    createdAt: Date.now(),
  };
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "duels", id);
    if ((await tx.get(ref)).exists()) throw new Error("Retry room");
    tx.set(ref, room);
  });
  return id;
}
export async function joinRoom(id: string, displayName: string): Promise<void> {
  if (!auth.currentUser) throw new Error("Account required");
  const uid = auth.currentUser.uid;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "duels", id);
    const snap = await tx.get(ref);
    const room = snap.data() as DuelRoom | undefined;
    if (
      !room ||
      room.hostId === uid ||
      room.status !== "waiting" ||
      room.guestId ||
      Date.now() - room.createdAt > 15 * 60 * 1000
    )
      throw new Error("Room unavailable");
    tx.update(ref, {
      guestId: uid,
      guestName: displayName,
      status: "active",
      startAt: Date.now() + 5000,
    });
  });
}
export const watchRoom = (
  id: string,
  next: (room: DuelRoom | null) => void,
  error: (error: unknown) => void,
) =>
  onSnapshot(
    doc(db, "duels", id),
    (snap) => next(snap.exists() ? (snap.data() as DuelRoom) : null),
    error,
  );
export async function cancelWaitingRoom(id: string): Promise<void> {
  const ref = doc(db, "duels", id);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (
      snapshot.exists() &&
      snapshot.data().hostId === auth.currentUser?.uid &&
      snapshot.data().status === "waiting"
    )
      tx.delete(ref);
  });
}
export async function sendDuelScore(
  room: DuelRoom,
  score: number,
  done = false,
) {
  const uid = auth.currentUser?.uid;
  if (!uid || ![room.hostId, room.guestId].includes(uid))
    throw new Error("Not a participant");
  const host = uid === room.hostId;
  await updateDoc(
    doc(db, "duels", room.id),
    host
      ? { hostScore: score, hostDone: done }
      : { guestScore: score, guestDone: done },
  );
}
