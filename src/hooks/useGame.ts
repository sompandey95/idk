import { useCallback, useEffect, useRef, useState } from "react";
import {
  activateFocus,
  createRun,
  routeRelay,
  stepRun,
} from "../game/simulation";
import type { GameRun, RunMode, Signal } from "../game/simulation";
import {
  CHECKPOINT_EVENT,
  loadCheckpoint,
  saveCheckpoint,
  recordCompletedRun,
} from "../services/player";
import type { Achievement } from "../services/player";
import { sound } from "../services/sound";

export function useGame(onComplete?: (run: GameRun) => void) {
  const runRef = useRef<GameRun | null>(null);
  const [snapshot, setSnapshot] = useState<GameRun | null>(null);
  const [checkpoint, setCheckpoint] = useState(loadCheckpoint);
  const [unlocks, setUnlocks] = useState<Achievement[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const completed = useRef(new Set<string>());
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const publish = useCallback(
    () => setSnapshot(runRef.current ? structuredClone(runRef.current) : null),
    [],
  );
  const start = useCallback(
    (mode: RunMode, seed?: number) => {
      runRef.current = createRun(mode, seed);
      setUnlocks([]);
      setCheckpoint(null);
      saveCheckpoint(null);
      sound.playTap();
      publish();
    },
    [publish],
  );
  const resumeCheckpoint = useCallback(() => {
    const saved = loadCheckpoint();
    if (!saved) return;
    runRef.current = saved;
    saved.phase = "playing";
    setCheckpoint(null);
    publish();
  }, [publish]);
  const pause = useCallback(() => {
    const run = runRef.current;
    if (!run || run.phase !== "playing" || run.mode === "duel") return;
    run.phase = "paused";
    saveCheckpoint(run);
    publish();
  }, [publish]);
  const resume = useCallback(() => {
    if (runRef.current?.phase === "paused") {
      runRef.current.phase = "playing";
      publish();
    }
  }, [publish]);
  const exit = useCallback(() => {
    saveCheckpoint(runRef.current);
    setCheckpoint(loadCheckpoint());
    runRef.current = null;
    publish();
  }, [publish]);
  const route = useCallback(
    (relay: number, signal: Signal) => {
      if (runRef.current && routeRelay(runRef.current, relay, signal)) {
        sound.playDial(1.2);
        sound.triggerHaptic("light");
        publish();
      }
    },
    [publish],
  );
  const focus = useCallback(() => {
    if (runRef.current && activateFocus(runRef.current)) {
      sound.playEpochAdvance();
      publish();
    }
  }, [publish]);

  useEffect(() => {
    const update = () => {
      if (!runRef.current) setCheckpoint(loadCheckpoint());
    };
    window.addEventListener(CHECKPOINT_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CHECKPOINT_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastTime = 0;
    let lastPublish = 0;
    let lastSave = 0;
    let lastEvent = 0;
    let previousRunId = "";
    const loop = (now: number) => {
      const delta = lastTime ? (now - lastTime) / 1000 : 0;
      lastTime = now;
      const run = runRef.current;
      if (run && previousRunId !== run.id) {
        lastEvent = run.eventSerial;
        previousRunId = run.id;
      }
      if (run?.phase === "playing") {
        // Visibility pauses solo play. Duel clocks continue so hiding cannot extend a match.
        stepRun(run, delta);
        for (const event of run.events.filter((e) => e.id > lastEvent)) {
          if (event.kind === "correct") sound.playSuccess(run.streak);
          if (event.kind === "error") sound.playError();
          if (event.kind === "wave") sound.playEpochAdvance();
        }
        lastEvent = run.eventSerial;
        if (run.finishReason !== null && !completed.current.has(run.id)) {
          completed.current.add(run.id);
          const result = recordCompletedRun(run);
          setUnlocks(result.newUnlocks);
          setSaveFailed(!result.persisted);
          saveCheckpoint(null);
          setCheckpoint(null);
          completeRef.current?.(run);
          publish();
        } else if (now - lastPublish > 80) {
          publish();
          lastPublish = now;
        }
        if (now - lastSave > 2500) {
          saveCheckpoint(run);
          lastSave = now;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const hidden = () => {
      if (document.hidden) pause();
    };
    const leaving = () => saveCheckpoint(runRef.current);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leaving);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", leaving);
    };
  }, [pause, publish]);

  return {
    runRef,
    snapshot,
    checkpoint,
    unlocks,
    saveFailed,
    start,
    resumeCheckpoint,
    pause,
    resume,
    exit,
    route,
    focus,
  };
}
