import test from "node:test";
import assert from "node:assert/strict";
import {
  activateFocus,
  accuracy,
  createRun,
  dailySeed,
  getRelayTarget,
  isRunCheckpoint,
  routeRelay,
  SIGNALS,
  stepRun,
} from "./simulation";
import type { GameRun, Signal } from "./simulation";

function outgoing(
  run: GameRun,
  signal: Signal,
  destination: Signal,
  relay = 0,
) {
  run.pulses.push({
    id: ++run.serial,
    signal,
    destination,
    relay,
    stage: "outgoing",
    progress: 0.99,
    bornAt: run.elapsed,
    legDuration: 0.01,
  });
}
function autoplay(run: GameRun, duration: number, frame: number) {
  const frames = Math.round(duration / frame);
  for (let i = 0; i < frames; i++) {
    const seen = new Set<number>();
    for (const pulse of [...run.pulses]
      .filter((p) => p.stage === "incoming")
      .sort((a, b) => b.progress - a.progress)) {
      if (!seen.has(pulse.relay)) {
        routeRelay(run, pulse.relay, pulse.signal);
        seen.add(pulse.relay);
      }
    }
    stepRun(run, frame);
  }
}
function comparable(run: GameRun) {
  return {
    tick: run.tick,
    score: run.score,
    correct: run.correct,
    resolved: run.resolved,
    rng: run.rng,
    pulses: run.pulses,
    integrity: run.integrity,
    wave: run.wave,
    difficulty: run.difficulty,
  };
}

test("relay selection changes the actual weighted route taken by a signal", () => {
  const run = createRun("adaptive", 20);
  run.pulses.push({
    id: 1,
    signal: "beta",
    relay: 0,
    stage: "incoming",
    progress: 0.99,
    destination: null,
    bornAt: 0,
    legDuration: 0.01,
  });
  assert.equal(getRelayTarget(run.relays[0]), "alpha");
  assert.equal(routeRelay(run, 0, "beta"), true);
  stepRun(run, 1 / 60);
  assert.equal(run.pulses[0].destination, "beta");
  stepRun(run, 1.3);
  assert.equal(run.correct, 1);
  assert.equal(run.integrity, 100);
  assert.ok(run.score > 0);
});
test("all four signal types are evaluated, including a clean signal misrouted to quarantine", () => {
  for (const signal of SIGNALS) {
    const run = createRun("adaptive", 1);
    outgoing(run, signal, signal);
    stepRun(run, 1 / 60);
    assert.equal(run.correct, 1, signal);
    assert.equal(run.quarantined, signal === "noise" ? 1 : 0);
  }
  const run = createRun();
  run.integrity = 12;
  outgoing(run, "alpha", "noise");
  stepRun(run, 1 / 60);
  assert.equal(run.phase, "finished");
  assert.equal(run.finishReason, "integrity");
  assert.equal(run.resolved, 1);
  assert.equal(accuracy(run), 0);
});
test("route edits do not reset the clock or spawn additional packets", () => {
  const run = createRun("sprint", 5);
  stepRun(run, 1);
  const spawnTick = run.nextSpawnTick;
  for (const signal of SIGNALS) routeRelay(run, 0, signal);
  assert.equal(run.pulses.length, 0);
  assert.equal(run.nextSpawnTick, spawnTick);
  assert.equal(run.elapsed, 1);
  stepRun(run, 1.1);
  assert.equal(run.pulses.length, 1);
});
test("pause freezes simulation and blocks editing and focus", () => {
  const run = createRun();
  stepRun(run, 3);
  run.phase = "paused";
  run.focusCharge = 100;
  const before = structuredClone(run);
  stepRun(run, 30);
  assert.equal(routeRelay(run, 0, "noise"), false);
  assert.equal(activateFocus(run), false);
  assert.deepEqual(run, before);
});
test("fixed ticks give the same outcomes at 20 and 60 render frames per second", () => {
  const slow = createRun("sprint", 1234);
  const fast = createRun("sprint", 1234);
  autoplay(slow, 45, 1 / 20);
  autoplay(fast, 45, 1 / 60);
  assert.deepEqual(comparable(slow), comparable(fast));
});
test("the 90-second deadline is stable while scoring and editing routes", () => {
  const run = createRun("sprint", 11);
  autoplay(run, 91, 1 / 60);
  assert.equal(run.phase, "finished");
  assert.equal(run.finishReason, "time");
  assert.equal(run.elapsed, 90);
  assert.ok(run.score > 0);
  assert.ok(run.tuningCount > 0);
});
test("a checkpoint continues the same random stream and simulation", () => {
  const original = createRun("adaptive", 903);
  autoplay(original, 17, 1 / 60);
  const restored = JSON.parse(JSON.stringify(original));
  assert.equal(isRunCheckpoint(restored), true);
  autoplay(original, 20, 1 / 60);
  autoplay(restored, 20, 1 / 60);
  assert.deepEqual(comparable(original), comparable(restored));
});
test("focus is earned, consumed once, and cannot be used to generate free score", () => {
  const run = createRun();
  for (let i = 0; i < 10; i++) {
    outgoing(run, "alpha", "alpha");
    stepRun(run, 1 / 60);
  }
  assert.equal(run.focusCharge, 100);
  const score = run.score;
  assert.equal(activateFocus(run), true);
  assert.equal(activateFocus(run), false);
  assert.equal(run.focusCharge, 0);
  assert.equal(run.score, score);
  assert.equal(run.focusUses, 1);
});
test("daily seeds repeat on a given date and change on the next date", () => {
  assert.equal(dailySeed("2026-10-29"), dailySeed("2026-10-29"));
  assert.notEqual(dailySeed("2026-10-29"), dailySeed("2026-10-30"));
});
test("training mistakes are safe and four correct signals finish the tutorial", () => {
  const run = createRun("tutorial", 1);
  run.integrity = 12;
  outgoing(run, "alpha", "noise");
  stepRun(run, 1 / 60);
  assert.equal(run.phase, "playing");
  assert.equal(run.integrity, 100);
  for (let i = 0; i < 4; i++) {
    outgoing(run, "beta", "beta");
    stepRun(run, 1 / 60);
  }
  assert.equal(run.phase, "finished");
  assert.equal(run.finishReason, "tutorial");
});
test("malformed checkpoints cannot introduce invalid packet destinations or simulation values", () => {
  const run = createRun();
  outgoing(run, "alpha", "alpha");
  assert.equal(isRunCheckpoint(run), true);
  const badDestination = structuredClone(run);
  badDestination.pulses[0].destination = null;
  assert.equal(isRunCheckpoint(badDestination), false);
  const badClock = structuredClone(run);
  badClock.nextSpawnTick = NaN;
  assert.equal(isRunCheckpoint(badClock), false);
  const badOutcomes = structuredClone(run);
  delete (badOutcomes as Partial<GameRun>).recentOutcomes;
  assert.equal(isRunCheckpoint(badOutcomes), false);
});
