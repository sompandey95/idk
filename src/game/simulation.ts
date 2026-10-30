import { calculateSynapseSignal } from "./neuralEngine";

export const SIGNALS = ["alpha", "beta", "gamma", "noise"] as const;
export type Signal = (typeof SIGNALS)[number];
export type RunMode = "adaptive" | "daily" | "sprint" | "duel" | "tutorial";
export type RunPhase = "playing" | "paused" | "finished";
export const TICK_RATE = 60;
export const SIGNAL_META: Record<
  Signal,
  { color: string; symbol: string; label: string }
> = {
  alpha: { color: "#76e5dc", symbol: "α", label: "Alpha" },
  beta: { color: "#b5a0ff", symbol: "β", label: "Beta" },
  gamma: { color: "#ecc77c", symbol: "γ", label: "Gamma" },
  noise: { color: "#f2829c", symbol: "⊘", label: "Quarantine" },
};

export interface Pulse {
  id: number;
  signal: Signal;
  relay: number;
  stage: "incoming" | "outgoing";
  progress: number;
  destination: Signal | null;
  bornAt: number;
  legDuration: number;
}
export interface Relay {
  weights: Record<Signal, number>;
}
export interface RunEvent {
  id: number;
  kind: "correct" | "error" | "wave" | "focus" | "route";
  signal?: Signal;
  relay?: number;
  points?: number;
  time: number;
}
export interface RouteAction {
  tick: number;
  relay: number;
  signal: Signal;
}
export interface GameRun {
  version: 2;
  id: string;
  mode: RunMode;
  seed: number;
  rng: number;
  phase: RunPhase;
  tick: number;
  accumulator: number;
  elapsed: number;
  nextSpawnTick: number;
  serial: number;
  score: number;
  integrity: number;
  correct: number;
  resolved: number;
  quarantined: number;
  streak: number;
  maxStreak: number;
  wave: number;
  difficulty: number;
  peakDifficulty: number;
  recentOutcomes: boolean[];
  adjustmentTick: number;
  tuningCount: number;
  focusCharge: number;
  focusUntil: number;
  focusUses: number;
  pulses: Pulse[];
  relays: Relay[];
  events: RunEvent[];
  eventSerial: number;
  actions: RouteAction[];
  finishReason: "integrity" | "time" | "tutorial" | null;
  startedAt: string;
}

export function dailySeed(
  date = new Date().toISOString().slice(0, 10),
): number {
  let hash = 2166136261;
  for (const char of `synapse-v2-${date}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function random(run: GameRun): number {
  // A serializable PRNG makes the packet stream reproducible and resumable.
  run.rng = (run.rng + 0x6d2b79f5) >>> 0;
  let value = run.rng;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function getRelayTarget(relay: Relay): Signal {
  return SIGNALS.reduce(
    (best, next) =>
      calculateSynapseSignal(1, relay.weights[next], 0, "relu") >
      calculateSynapseSignal(1, relay.weights[best], 0, "relu")
        ? next
        : best,
    SIGNALS[0],
  );
}

export function createRun(
  mode: RunMode = "adaptive",
  seed = Date.now() >>> 0,
): GameRun {
  const effectiveSeed = mode === "daily" ? dailySeed() : seed;
  return {
    version: 2,
    id: globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}-${seed}`,
    mode,
    seed: effectiveSeed,
    rng: effectiveSeed,
    phase: "playing",
    tick: 0,
    accumulator: 0,
    elapsed: 0,
    nextSpawnTick: mode === "tutorial" ? 90 : 120,
    serial: 0,
    score: 0,
    integrity: 100,
    correct: 0,
    resolved: 0,
    quarantined: 0,
    streak: 0,
    maxStreak: 0,
    wave: 1,
    difficulty: 1,
    peakDifficulty: 1,
    recentOutcomes: [],
    adjustmentTick: 0,
    tuningCount: 0,
    focusCharge: 0,
    focusUntil: 0,
    focusUses: 0,
    pulses: [],
    events: [],
    eventSerial: 0,
    actions: [],
    relays: SIGNALS.map((target) => ({
      weights: Object.fromEntries(
        SIGNALS.map((signal) => [signal, signal === target ? 2 : 0.1]),
      ) as Record<Signal, number>,
    })),
    finishReason: null,
    startedAt: new Date().toISOString(),
  };
}

function emit(run: GameRun, event: Omit<RunEvent, "id" | "time">) {
  run.events.push({ ...event, id: ++run.eventSerial, time: run.elapsed });
  if (run.events.length > 24) run.events.shift();
}

export function routeRelay(
  run: GameRun,
  relayIndex: number,
  signal: Signal,
): boolean {
  if (
    run.phase !== "playing" ||
    !run.relays[relayIndex] ||
    !SIGNALS.includes(signal)
  )
    return false;
  if (getRelayTarget(run.relays[relayIndex]) === signal) return false;
  run.relays[relayIndex].weights = Object.fromEntries(
    SIGNALS.map((s) => [s, s === signal ? 2 : 0.1]),
  ) as Record<Signal, number>;
  run.tuningCount++;
  run.actions.push({ tick: run.tick, relay: relayIndex, signal });
  emit(run, { kind: "route", relay: relayIndex, signal });
  return true;
}

export function activateFocus(run: GameRun): boolean {
  if (
    run.phase !== "playing" ||
    run.focusCharge < 100 ||
    run.focusUntil > run.elapsed
  )
    return false;
  run.focusCharge = 0;
  run.focusUntil = run.elapsed + 6;
  run.focusUses++;
  run.integrity = Math.min(100, run.integrity + 10);
  emit(run, { kind: "focus" });
  return true;
}

export function accuracy(run: Pick<GameRun, "correct" | "resolved">): number {
  return run.resolved ? Math.round((run.correct / run.resolved) * 100) : 100;
}

export function durationForMode(mode: RunMode): number {
  return mode === "daily" || mode === "sprint" || mode === "duel"
    ? 90
    : Infinity;
}

function spawnPulse(run: GameRun) {
  let relay: number;
  let signal: Signal;
  if (run.mode === "tutorial") {
    relay = run.serial % 4;
    signal = SIGNALS[(run.serial + 1) % 4];
  } else {
    // Both draws occur for every packet: routing cannot influence future random inputs.
    relay = Math.floor(random(run) * 4);
    const choice = random(run);
    const noiseProbability = Math.min(0.24, 0.1 + (run.difficulty - 1) * 0.06);
    signal =
      choice < noiseProbability
        ? "noise"
        : SIGNALS[
            Math.min(
              2,
              Math.floor(
                ((choice - noiseProbability) / (1 - noiseProbability)) * 3,
              ),
            )
          ];
  }
  run.pulses.push({
    id: ++run.serial,
    relay,
    signal,
    stage: "incoming",
    progress: 0,
    destination: null,
    bornAt: run.elapsed,
    legDuration: run.mode === "tutorial" ? 6 : 3.1 / run.difficulty,
  });
  const interval =
    run.mode === "tutorial" ? 7.5 : Math.max(1.15, 3.1 / run.difficulty);
  run.nextSpawnTick += Math.round(interval * TICK_RATE);
}

function resolvePulse(run: GameRun, pulse: Pulse) {
  const correct = pulse.destination === pulse.signal;
  run.resolved++;
  run.recentOutcomes = [...run.recentOutcomes, correct].slice(-12);
  if (correct) {
    run.correct++;
    if (pulse.signal === "noise") run.quarantined++;
    run.streak++;
    run.maxStreak = Math.max(run.maxStreak, run.streak);
    const points = Math.round(
      (pulse.signal === "noise" ? 180 : 100) *
        (1 + Math.min(4, Math.floor(run.streak / 5)) * 0.25) *
        run.difficulty,
    );
    run.score += points;
    run.integrity = Math.min(100, run.integrity + 2);
    run.focusCharge = Math.min(100, run.focusCharge + 10);
    emit(run, {
      kind: "correct",
      signal: pulse.signal,
      relay: pulse.relay,
      points,
    });
  } else {
    run.streak = 0;
    run.integrity = Math.max(
      0,
      run.integrity - (pulse.signal === "noise" ? 18 : 12),
    );
    run.focusCharge = Math.max(0, run.focusCharge - 5);
    emit(run, { kind: "error", signal: pulse.signal, relay: pulse.relay });
  }
  const nextWave = 1 + Math.floor(run.resolved / 10);
  if (nextWave !== run.wave) {
    run.wave = nextWave;
    emit(run, { kind: "wave" });
  }
  // Only adaptive solo uses player-dependent difficulty. Seeded modes share a schedule.
  if (
    run.mode === "adaptive" &&
    run.recentOutcomes.length >= 6 &&
    run.tick - run.adjustmentTick >= 600
  ) {
    const recentAccuracy =
      run.recentOutcomes.filter(Boolean).length / run.recentOutcomes.length;
    const adjustment =
      recentAccuracy > 0.82 ? 0.12 : recentAccuracy < 0.55 ? -0.1 : 0;
    run.difficulty =
      Math.round(
        Math.max(0.75, Math.min(2.4, run.difficulty + adjustment)) * 100,
      ) / 100;
    run.adjustmentTick = run.tick;
  }
  if (run.integrity <= 0) {
    if (run.mode === "tutorial") run.integrity = 100;
    else {
      run.phase = "finished";
      run.finishReason = "integrity";
    }
  }
  if (run.mode === "tutorial" && run.correct >= 4) {
    run.phase = "finished";
    run.finishReason = "tutorial";
  }
}

function fixedStep(run: GameRun) {
  run.tick++;
  run.elapsed = run.tick / TICK_RATE;
  if (run.elapsed >= durationForMode(run.mode)) {
    run.phase = "finished";
    run.finishReason = "time";
    return;
  }
  if (run.mode !== "adaptive" && run.mode !== "tutorial")
    run.difficulty = Math.min(2.2, 1 + Math.floor(run.elapsed / 20) * 0.15);
  run.peakDifficulty = Math.max(run.peakDifficulty, run.difficulty);
  if (run.tick >= run.nextSpawnTick) spawnPulse(run);
  const slow = run.focusUntil > run.elapsed ? 0.45 : 1;
  for (let i = run.pulses.length - 1; i >= 0 && run.phase === "playing"; i--) {
    const pulse = run.pulses[i];
    pulse.progress += slow / (TICK_RATE * pulse.legDuration);
    if (pulse.progress < 1) continue;
    if (pulse.stage === "incoming") {
      pulse.destination = getRelayTarget(run.relays[pulse.relay]);
      pulse.stage = "outgoing";
      pulse.progress -= 1;
      pulse.legDuration = 1.25 / run.difficulty;
    } else {
      run.pulses.splice(i, 1);
      resolvePulse(run, pulse);
    }
  }
}

export function stepRun(run: GameRun, deltaSeconds: number): void {
  if (
    run.phase !== "playing" ||
    !Number.isFinite(deltaSeconds) ||
    deltaSeconds <= 0
  )
    return;
  run.accumulator += deltaSeconds;
  while (run.accumulator + 1e-9 >= 1 / TICK_RATE && run.phase === "playing") {
    run.accumulator -= 1 / TICK_RATE;
    fixedStep(run);
  }
}

export function isRunCheckpoint(value: unknown): value is GameRun {
  if (!value || typeof value !== "object") return false;
  const r = value as GameRun;
  const numericalFields = [
    "seed",
    "rng",
    "tick",
    "elapsed",
    "nextSpawnTick",
    "serial",
    "score",
    "integrity",
    "correct",
    "resolved",
    "quarantined",
    "streak",
    "maxStreak",
    "wave",
    "difficulty",
    "peakDifficulty",
    "adjustmentTick",
    "tuningCount",
    "focusCharge",
    "focusUntil",
    "focusUses",
    "eventSerial",
  ] as const;
  return (
    r.version === 2 &&
    typeof r.id === "string" &&
    r.id.length <= 128 &&
    ["adaptive", "daily", "sprint", "tutorial"].includes(r.mode) &&
    numericalFields.every((key) => Number.isFinite(r[key]) && r[key] >= 0) &&
    Number.isFinite(r.accumulator) &&
    Math.abs(r.accumulator) <= 1 &&
    ["playing", "paused"].includes(r.phase) &&
    Number.isFinite(r.tick) &&
    r.tick >= 0 &&
    Number.isFinite(r.integrity) &&
    r.integrity > 0 &&
    r.integrity <= 100 &&
    Number.isFinite(r.score) &&
    r.score >= 0 &&
    r.relays?.length === 4 &&
    r.relays.every((relay) =>
      SIGNALS.every((s) => Number.isFinite(relay.weights?.[s])),
    ) &&
    Array.isArray(r.pulses) &&
    r.pulses.length < 100 &&
    r.pulses.every(
      (p) =>
        p &&
        SIGNALS.includes(p.signal) &&
        Number.isInteger(p.relay) &&
        p.relay >= 0 &&
        p.relay < 4 &&
        Number.isFinite(p.progress) &&
        p.progress >= 0 &&
        p.progress <= 1.1 &&
        Number.isFinite(p.legDuration) &&
        p.legDuration > 0 &&
        ((p.stage === "incoming" && p.destination === null) ||
          (p.stage === "outgoing" && SIGNALS.includes(p.destination!))),
    ) &&
    Array.isArray(r.recentOutcomes) &&
    r.recentOutcomes.length <= 12 &&
    r.recentOutcomes.every((v) => typeof v === "boolean") &&
    Array.isArray(r.actions) &&
    Array.isArray(r.events) &&
    r.events.every(
      (e) => e && Number.isFinite(e.id) && Number.isFinite(e.time),
    ) &&
    typeof r.startedAt === "string" &&
    Number.isFinite(Date.parse(r.startedAt))
  );
}
