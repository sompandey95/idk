import { accuracy, dailySeed, isRunCheckpoint } from "../game/simulation";
import type { GameRun, RunMode } from "../game/simulation";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: string;
}
export interface DailyChallenge {
  date: string;
  variant: number;
  target: number;
  progress: number;
  minimumAccuracy: number;
  completed: boolean;
  reward: number;
}
export interface RunRecord {
  id: string;
  mode: Exclude<RunMode, "tutorial">;
  seed: number;
  score: number;
  wave: number;
  correct: number;
  resolved: number;
  quarantined: number;
  maxStreak: number;
  peakDifficulty: number;
  tuningCount: number;
  focusUses: number;
  elapsed: number;
  startedAt: string;
  completedAt: string;
}
export interface PlayerState {
  schemaVersion: 2;
  playerId: string;
  displayName: string;
  region: "NA" | "EU" | "ASIA";
  highScore: number;
  highestEpoch: number;
  totalGames: number;
  totalPacketsClassified: number;
  totalAnomaliesQuarantined: number;
  seasonId: string;
  seasonExp: number;
  seasonTier: number;
  achievements: Achievement[];
  dailyChallenge: DailyChallenge;
  pendingSyncQueue: RunRecord[];
  history: RunRecord[];
  recordedRunIds: string[];
  dailyBest: number;
  equippedSkin: "mint" | "violet" | "amber";
}

export const PLAYER_EVENT = "synapse-player-updated";
export const CHECKPOINT_EVENT = "synapse-checkpoint-updated";
const STORAGE_KEY = "synapse_player_state_v1";
const CHECKPOINT_KEY = "synapse_active_run_v2";
const ACHIEVEMENTS = [
  ["first_synapse", "First light", "Route 10 signals correctly.", 10],
  [
    "gradient_master",
    "In the flow",
    "Build a streak of 10 correct signals.",
    10,
  ],
  ["quarantine_hero", "Firewall", "Quarantine 5 corrupted signals.", 5],
  ["epoch_survivor", "Deep focus", "Complete 5 waves in one run.", 5],
  [
    "zero_loss",
    "Near perfection",
    "Finish with 95% accuracy and at least 10 signals.",
    1,
  ],
  ["dda_overdrive", "Beyond the limit", "Reach a difficulty of 2.0×.", 1],
  ["weight_tuner", "Architect", "Change relay routes 20 times.", 20],
  ["quantum_surge", "Time bender", "Activate focus mode.", 1],
] as const;

export function currentSeason(date = new Date()): string {
  return `${date.getUTCFullYear()}-Q${1 + Math.floor(date.getUTCMonth() / 3)}`;
}
export function makeDailyChallenge(
  date = new Date().toISOString().slice(0, 10),
): DailyChallenge {
  const variant = dailySeed(date) % 3;
  return {
    date,
    variant,
    target: [20, 30, 40][variant],
    minimumAccuracy: [85, 80, 80][variant],
    progress: 0,
    completed: false,
    reward: 400 + variant * 100,
  };
}
function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Number.MAX_SAFE_INTEGER, value)
    : fallback;
}
export function createDefaultState(): PlayerState {
  return {
    schemaVersion: 2,
    playerId: `local_${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    displayName: "Operator",
    region: "NA",
    highScore: 0,
    highestEpoch: 1,
    totalGames: 0,
    totalPacketsClassified: 0,
    totalAnomaliesQuarantined: 0,
    seasonId: currentSeason(),
    seasonExp: 0,
    seasonTier: 1,
    achievements: ACHIEVEMENTS.map(([id, name, description, maxProgress]) => ({
      id,
      name,
      description,
      maxProgress,
      progress: 0,
      unlocked: false,
    })),
    dailyChallenge: makeDailyChallenge(),
    pendingSyncQueue: [],
    history: [],
    recordedRunIds: [],
    dailyBest: 0,
    equippedSkin: "mint",
  };
}
export function validRunRecord(value: unknown): value is RunRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as RunRecord;
  return (
    typeof r.id === "string" &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(r.id) &&
    ["adaptive", "daily", "sprint", "duel"].includes(r.mode) &&
    (
      [
        "score",
        "correct",
        "resolved",
        "quarantined",
        "tuningCount",
        "focusUses",
        "elapsed",
        "maxStreak",
        "seed",
        "peakDifficulty",
        "wave",
      ] as const
    ).every((k) => Number.isFinite(r[k]) && r[k] >= 0) &&
    r.correct <= r.resolved &&
    r.score <= 100000000 &&
    r.resolved <= 1000000 &&
    typeof r.startedAt === "string" &&
    Number.isFinite(Date.parse(r.startedAt)) &&
    typeof r.completedAt === "string" &&
    Number.isFinite(Date.parse(r.completedAt))
  );
}
export function normalizePlayerState(value: unknown): PlayerState {
  const defaults = createDefaultState();
  if (!value || typeof value !== "object") return defaults;
  const raw = value as Partial<PlayerState>;
  const history = Array.isArray(raw.history)
    ? raw.history.filter(validRunRecord).slice(-50)
    : [];
  const seasonExp =
    raw.seasonId && raw.seasonId !== defaults.seasonId
      ? 0
      : number(raw.seasonExp);
  const daily = makeDailyChallenge();
  if (raw.dailyChallenge?.date === daily.date) {
    const savedDaily = raw.dailyChallenge as DailyChallenge & {
      currentCount?: number;
    };
    daily.progress = Math.min(
      daily.target,
      number(savedDaily.progress ?? savedDaily.currentCount),
    );
    daily.completed = daily.progress >= daily.target;
  }
  return {
    ...defaults,
    playerId:
      typeof raw.playerId === "string" &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(raw.playerId)
        ? raw.playerId
        : defaults.playerId,
    displayName:
      typeof raw.displayName === "string"
        ? raw.displayName.trim().slice(0, 24) || "Operator"
        : defaults.displayName,
    region: raw.region === "EU" || raw.region === "ASIA" ? raw.region : "NA",
    highScore: number(raw.highScore),
    highestEpoch: number(raw.highestEpoch, 1),
    totalGames: number(raw.totalGames),
    totalPacketsClassified: number(raw.totalPacketsClassified),
    totalAnomaliesQuarantined: number(raw.totalAnomaliesQuarantined),
    seasonExp,
    seasonTier: 1 + Math.floor(seasonExp / 1000),
    dailyChallenge: daily,
    dailyBest:
      raw.dailyChallenge?.date === daily.date ? number(raw.dailyBest) : 0,
    history,
    recordedRunIds: Array.isArray(raw.recordedRunIds)
      ? raw.recordedRunIds.filter((id) => typeof id === "string").slice(-1000)
      : history.map((r) => r.id),
    pendingSyncQueue: Array.isArray(raw.pendingSyncQueue)
      ? raw.pendingSyncQueue.filter(validRunRecord)
      : [],
    equippedSkin:
      raw.equippedSkin === "amber" && seasonExp >= 3000
        ? "amber"
        : raw.equippedSkin === "violet" && seasonExp >= 1000
          ? "violet"
          : "mint",
    achievements: defaults.achievements.map((a) => {
      const saved = Array.isArray(raw.achievements)
        ? raw.achievements.find((item) => item?.id === a.id)
        : null;
      return saved
        ? {
            ...a,
            progress: Math.min(a.maxProgress, number(saved.progress)),
            unlocked: saved.unlocked === true,
            ...(typeof saved.unlockedAt === "string"
              ? { unlockedAt: saved.unlockedAt }
              : {}),
          }
        : a;
    }),
  };
}
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
export function loadPlayer(): PlayerState {
  try {
    return normalizePlayerState(
      JSON.parse(storage()?.getItem(STORAGE_KEY) ?? "null"),
    );
  } catch {
    return createDefaultState();
  }
}
export function savePlayer(state: PlayerState): boolean {
  try {
    const target = storage();
    if (!target) return false;
    target.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event(PLAYER_EVENT));
    return true;
  } catch {
    return false;
  }
}
export function toRunRecord(run: GameRun): RunRecord {
  if (run.mode === "tutorial")
    throw new Error("Training does not create career records");
  return {
    id: run.id,
    mode: run.mode,
    seed: run.seed,
    score: run.score,
    wave: run.wave,
    correct: run.correct,
    resolved: run.resolved,
    quarantined: run.quarantined,
    maxStreak: run.maxStreak,
    peakDifficulty: run.peakDifficulty,
    tuningCount: run.tuningCount,
    focusUses: run.focusUses,
    elapsed: Math.round(run.elapsed),
    startedAt: run.startedAt,
    completedAt: new Date().toISOString(),
  };
}
export function applyRunToPlayer(
  input: PlayerState,
  record: RunRecord,
): { state: PlayerState; newUnlocks: Achievement[] } {
  const state = normalizePlayerState(input);
  if (!validRunRecord(record) || state.recordedRunIds.includes(record.id))
    return { state, newUnlocks: [] };
  state.recordedRunIds = [...state.recordedRunIds, record.id].slice(-1000);
  state.history = [...state.history, record].slice(-50);
  state.totalGames++;
  state.totalPacketsClassified += record.correct;
  state.totalAnomaliesQuarantined += record.quarantined;
  if (record.mode === "adaptive")
    state.highScore = Math.max(state.highScore, record.score);
  if (
    record.mode === "daily" &&
    record.startedAt.slice(0, 10) === state.dailyChallenge.date
  )
    state.dailyBest = Math.max(state.dailyBest, record.score);
  state.highestEpoch = Math.max(state.highestEpoch, record.wave);
  state.seasonExp += Math.round(record.score / 10) + record.correct * 3;
  const challenge = state.dailyChallenge;
  if (
    !challenge.completed &&
    accuracy(record) >= challenge.minimumAccuracy &&
    record.completedAt.slice(0, 10) === challenge.date
  ) {
    challenge.progress = Math.min(
      challenge.target,
      challenge.progress + record.correct,
    );
    if (challenge.progress >= challenge.target) {
      challenge.completed = true;
      state.seasonExp += challenge.reward;
    }
  }
  state.seasonTier = 1 + Math.floor(state.seasonExp / 1000);
  const newUnlocks: Achievement[] = [];
  state.achievements = state.achievements.map((a) => {
    if (a.unlocked) return a;
    const progress: Record<string, number> = {
      first_synapse: a.progress + record.correct,
      gradient_master: Math.max(a.progress, record.maxStreak),
      quarantine_hero: a.progress + record.quarantined,
      epoch_survivor: Math.max(a.progress, record.wave - 1),
      zero_loss:
        accuracy(record) >= 95 && record.resolved >= 10 ? 1 : a.progress,
      dda_overdrive: record.peakDifficulty >= 2 ? 1 : a.progress,
      weight_tuner: a.progress + record.tuningCount,
      quantum_surge: record.focusUses > 0 ? 1 : a.progress,
    };
    const next = {
      ...a,
      progress: Math.min(a.maxProgress, progress[a.id] ?? a.progress),
    };
    if (next.progress >= next.maxProgress) {
      next.unlocked = true;
      next.unlockedAt = record.completedAt;
      newUnlocks.push(next);
    }
    return next;
  });
  return { state, newUnlocks };
}
export function recordCompletedRun(run: GameRun): {
  state: PlayerState;
  newUnlocks: Achievement[];
  persisted: boolean;
} {
  const previous = loadPlayer();
  if (run.mode === "tutorial" || run.phase !== "finished")
    return { state: previous, newUnlocks: [], persisted: true };
  const record = toRunRecord(run);
  const result = applyRunToPlayer(previous, record);
  if (!previous.recordedRunIds.includes(record.id))
    result.state.pendingSyncQueue.push(record);
  return { ...result, persisted: savePlayer(result.state) };
}
export function saveCheckpoint(run: GameRun | null): void {
  try {
    if (
      !run ||
      run.phase === "finished" ||
      run.mode === "duel" ||
      run.mode === "tutorial"
    )
      storage()?.removeItem(CHECKPOINT_KEY);
    else
      storage()?.setItem(
        CHECKPOINT_KEY,
        JSON.stringify({ ...run, phase: "paused" }),
      );
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event(CHECKPOINT_EVENT));
  } catch {
    /* Session continues when storage is unavailable. */
  }
}
export function loadCheckpoint(): GameRun | null {
  try {
    const value = JSON.parse(storage()?.getItem(CHECKPOINT_KEY) ?? "null");
    return isRunCheckpoint(value) ? value : null;
  } catch {
    return null;
  }
}
export function exportBackup(): string {
  return JSON.stringify(
    {
      format: "synapse-backup",
      version: 2,
      player: loadPlayer(),
      checkpoint: loadCheckpoint(),
    },
    null,
    2,
  );
}
export function importBackup(text: string): boolean {
  try {
    if (text.length > 2000000) return false;
    const value = JSON.parse(text);
    if (
      value.format !== "synapse-backup" ||
      value.version !== 2 ||
      typeof value.player?.displayName !== "string" ||
      !Array.isArray(value.player?.achievements)
    )
      return false;
    const restored = normalizePlayerState(value.player);
    restored.playerId = loadPlayer().playerId;
    if (!savePlayer(restored)) return false;
    if (isRunCheckpoint(value.checkpoint)) saveCheckpoint(value.checkpoint);
    return true;
  } catch {
    return false;
  }
}
