import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRunToPlayer,
  createDefaultState,
  currentSeason,
  exportBackup,
  importBackup,
  loadPlayer,
  makeDailyChallenge,
  normalizePlayerState,
  recordCompletedRun,
  saveCheckpoint,
  savePlayer,
  loadCheckpoint,
} from "./player";
import type { RunRecord } from "./player";
import { createRun } from "../game/simulation";

const items = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
    clear: () => items.clear(),
  },
});
function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: crypto.randomUUID(),
    mode: "adaptive",
    seed: 123,
    score: 1200,
    wave: 2,
    correct: 10,
    resolved: 10,
    quarantined: 2,
    maxStreak: 10,
    peakDifficulty: 1.2,
    tuningCount: 20,
    focusUses: 1,
    elapsed: 40,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}
test("completed runs are idempotent and incorrect packets never count as correct progress", () => {
  const first = record({
    correct: 0,
    resolved: 30,
    maxStreak: 0,
    focusUses: 0,
    tuningCount: 0,
  });
  const result = applyRunToPlayer(createDefaultState(), first);
  assert.equal(result.state.totalPacketsClassified, 0);
  assert.equal(result.state.dailyChallenge.progress, 0);
  assert.equal(
    result.state.achievements.find((a) => a.id === "first_synapse")?.unlocked,
    false,
  );
  assert.equal(applyRunToPlayer(result.state, first).state.totalGames, 1);
});
test("daily bonus XP is included when calculating season tier", () => {
  const state = createDefaultState();
  state.seasonExp = 950;
  const challenge = state.dailyChallenge;
  const result = applyRunToPlayer(
    state,
    record({ score: 0, correct: challenge.target, resolved: challenge.target }),
  );
  assert.equal(result.state.dailyChallenge.completed, true);
  assert.ok(result.state.seasonExp > 1000);
  assert.equal(
    result.state.seasonTier,
    1 + Math.floor(result.state.seasonExp / 1000),
  );
});
test("tuning and focus achievements respond to actual recorded actions", () => {
  const result = applyRunToPlayer(createDefaultState(), record());
  assert.equal(
    result.state.achievements.find((a) => a.id === "weight_tuner")?.unlocked,
    true,
  );
  assert.equal(
    result.state.achievements.find((a) => a.id === "quantum_surge")?.unlocked,
    true,
  );
});
test("different scoring modes cannot overwrite the adaptive personal best", () => {
  const base = applyRunToPlayer(
    createDefaultState(),
    record({ score: 1000 }),
  ).state;
  const daily = applyRunToPlayer(
    base,
    record({ mode: "daily", score: 9000 }),
  ).state;
  const lower = applyRunToPlayer(daily, record({ score: 10 })).state;
  assert.equal(lower.highScore, 1000);
  assert.equal(lower.dailyBest, 9000);
});
test("local backup preserves Unicode, achievements, and a paused active run", () => {
  items.clear();
  const player = applyRunToPlayer(createDefaultState(), record()).state;
  player.displayName = "玩家・테스트";
  savePlayer(player);
  const run = createRun("adaptive", 77);
  run.tick = 600;
  run.elapsed = 10;
  saveCheckpoint(run);
  const backup = exportBackup();
  items.clear();
  savePlayer(createDefaultState());
  assert.equal(importBackup(backup), true);
  assert.equal(loadPlayer().displayName, player.displayName);
  assert.equal(loadPlayer().totalGames, 1);
  assert.equal(
    loadPlayer().achievements.find((a) => a.id === "weight_tuner")?.unlocked,
    true,
  );
  assert.equal(loadCheckpoint()?.phase, "paused");
  assert.equal(loadCheckpoint()?.seed, 77);
});
test("finished results are durably queued once, including while the network is unavailable", () => {
  items.clear();
  savePlayer(createDefaultState());
  const run = createRun();
  run.phase = "finished";
  run.finishReason = "integrity";
  run.correct = 3;
  run.resolved = 4;
  run.score = 300;
  assert.equal(recordCompletedRun(run).persisted, true);
  recordCompletedRun(run);
  assert.equal(loadPlayer().pendingSyncQueue.length, 1);
  assert.equal(loadPlayer().totalGames, 1);
});
test("migration retains legacy records and safely reconstructs missing fields", () => {
  const state = normalizePlayerState({
    displayName: "Legacy",
    highScore: 4200,
    totalGames: 12,
    achievements: [{ id: "first_synapse", unlocked: true, progress: 10 }],
  });
  assert.equal(state.highScore, 4200);
  assert.equal(state.totalGames, 12);
  assert.equal(state.achievements.length, 8);
  assert.equal(state.achievements[0].unlocked, true);
  assert.deepEqual(state.pendingSyncQueue, []);
  assert.equal(state.schemaVersion, 2);
  const malformed = normalizePlayerState({
    highScore: "bad",
    totalGames: -1,
    region: "unknown",
    history: [null, {}, { id: "bad" }],
  });
  assert.equal(malformed.highScore, 0);
  assert.equal(malformed.totalGames, 0);
  assert.equal(malformed.region, "NA");
  assert.deepEqual(malformed.history, []);
});
test("daily reset and season rollover preserve career statistics", () => {
  const state = createDefaultState();
  state.highScore = 900;
  state.seasonId = "2020-Q1";
  state.seasonExp = 5000;
  state.dailyChallenge = {
    ...makeDailyChallenge("2020-01-01"),
    completed: true,
    progress: 40,
  };
  const restored = normalizePlayerState(state);
  assert.equal(restored.highScore, 900);
  assert.equal(restored.seasonExp, 0);
  assert.equal(restored.seasonId, currentSeason());
  assert.equal(restored.dailyChallenge.completed, false);
  assert.equal(restored.dailyChallenge.progress, 0);
});
test("a daily run crossing midnight stays associated with its starting challenge", () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const result = applyRunToPlayer(
    createDefaultState(),
    record({ mode: "daily", score: 5000, startedAt: yesterday }),
  );
  assert.equal(result.state.dailyBest, 0);
});
