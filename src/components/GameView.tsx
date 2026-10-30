import {
  ArrowLeft,
  Pause,
  Play,
  Zap,
  Target,
  Activity,
  Clock3,
  ChevronRight,
} from "lucide-react";
import type { MutableRefObject } from "react";
import {
  accuracy,
  durationForMode,
  getRelayTarget,
  SIGNALS,
  SIGNAL_META,
} from "../game/simulation";
import type { GameRun, Signal } from "../game/simulation";
import type { GameCopy } from "../services/copy";
import { NeuralBoard } from "./NeuralBoard";

export function GameView({
  run,
  runRef,
  selected,
  setSelected,
  route,
  focus,
  pause,
  reducedMotion,
  copy: c,
  locale,
  opponent,
}: {
  run: GameRun;
  runRef: MutableRefObject<GameRun | null>;
  selected: number;
  setSelected: (value: number) => void;
  route: (relay: number, signal: Signal) => void;
  focus: () => void;
  pause: () => void;
  reducedMotion: boolean;
  copy: GameCopy;
  locale: string;
  opponent?: { name: string; score: number };
}) {
  const timed = Number.isFinite(durationForMode(run.mode));
  const remaining = Math.max(0, durationForMode(run.mode) - run.elapsed);
  const mode = run.mode === "tutorial" ? c.learn : c[run.mode];
  const signals = run.pulses
    .filter((p) => p.stage === "incoming")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);
  return (
    <section className="game-page">
      <div className="game-heading">
        <div>
          <span className="eyebrow">
            SYNAPSE / {run.mode === "tutorial" ? "00" : "01"}
          </span>
          <h1>
            {mode}
            <span className="live-tag">
              <span className="status-dot" />
              {run.mode === "tutorial" ? "TRAINING" : "LIVE"}
            </span>
          </h1>
        </div>
        {run.mode !== "duel" && (
          <button className="button button-secondary" onClick={pause}>
            <Pause size={16} />
            {c.pause}
            <kbd>Esc</kbd>
          </button>
        )}
      </div>
      <div className="game-stats">
        <div className="score-stat">
          <span>{c.score}</span>
          <strong>{run.score.toLocaleString(locale)}</strong>
        </div>
        <div>
          <span>{c.wave}</span>
          <strong>{String(run.wave).padStart(2, "0")}</strong>
        </div>
        <div>
          <span>{c.accuracy}</span>
          <strong>
            {accuracy(run)}
            <small>%</small>
          </strong>
        </div>
        <div>
          <span>{c.streak}</span>
          <strong>
            {run.streak}
            <small>×</small>
          </strong>
        </div>
        <div className="integrity-stat">
          <span>
            <Activity size={13} />
            {c.integrity}
            <b>{run.integrity}%</b>
          </span>
          <div
            className={`integrity-track ${run.integrity <= 30 ? "is-critical" : ""}`}
          >
            <i style={{ width: `${run.integrity}%` }} />
          </div>
        </div>
      </div>
      {run.mode === "tutorial" && (
        <div className="tutorial-banner">
          <span className="tutorial-step">{run.correct}/4</span>
          <div>
            <strong>{c.tutorialHint}</strong>
            <p>{c.tutorialGoal}</p>
          </div>
        </div>
      )}
      {opponent && (
        <div className="opponent-strip">
          <span>
            {c.opponent}: <strong>{opponent.name}</strong>
          </span>
          <strong>{opponent.score.toLocaleString(locale)}</strong>
        </div>
      )}
      <div
        className={`board-card ${run.focusUntil > run.elapsed ? "focus-active" : ""}`}
      >
        <div className="board-toolbar">
          <div>
            <span className="status-dot" />
            <span>{run.focusUntil > run.elapsed ? c.focusActive : c.live}</span>
          </div>
          <span className="board-flow">
            <Activity size={13} />
            {c.difficulty} <b>{run.difficulty.toFixed(2)}×</b>
          </span>
          <span className="board-timer">
            <Clock3 size={14} />
            {Math.floor((timed ? remaining : run.elapsed) / 60)}:
            {String(
              Math.floor((timed ? remaining : run.elapsed) % 60),
            ).padStart(2, "0")}
          </span>
        </div>
        <NeuralBoard
          runRef={runRef}
          run={run}
          selected={selected}
          onSelect={setSelected}
          onRoute={route}
          reducedMotion={reducedMotion}
          copy={c}
        />
        <div className="board-bottom">
          <span>
            <Target size={13} />
            {c.routeHint}
          </span>
          <span className="signal-queue">
            {signals.map((p) => (
              <span key={p.id} style={{ color: SIGNAL_META[p.signal].color }}>
                {SIGNAL_META[p.signal].symbol}
                <ChevronRight size={10} />R{p.relay + 1}
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className="routing-dock">
        <div className="relay-picker">
          <span className="dock-label">
            <b>01</b>
            {c.selectRelay}
          </span>
          <div>
            {[0, 1, 2, 3].map((i) => (
              <button
                data-select-relay={i}
                key={i}
                className={selected === i ? "is-selected" : ""}
                aria-pressed={selected === i}
                aria-label={`${c.selectRelay} ${i + 1}`}
                onClick={() => setSelected(i)}
              >
                {String(i + 1).padStart(2, "0")}
                <kbd>{i + 1}</kbd>
              </button>
            ))}
          </div>
        </div>
        <span className="dock-arrow">→</span>
        <div className="gate-picker">
          <span className="dock-label">
            <b>02</b>
            {c.chooseGate}
          </span>
          <div>
            {SIGNALS.map((signal, i) => (
              <button
                data-route={signal}
                key={signal}
                style={
                  {
                    "--signal": SIGNAL_META[signal].color,
                  } as React.CSSProperties
                }
                aria-label={`${c.chooseGate}: ${SIGNAL_META[signal].label}`}
                aria-pressed={getRelayTarget(run.relays[selected]) === signal}
                className={
                  getRelayTarget(run.relays[selected]) === signal
                    ? "is-selected"
                    : ""
                }
                onClick={() => route(selected, signal)}
              >
                <span>{SIGNAL_META[signal].symbol}</span>
                <kbd>{["A", "B", "C", "Q"][i]}</kbd>
              </button>
            ))}
          </div>
        </div>
        <button
          className={`focus-button ${run.focusCharge >= 100 ? "is-ready" : ""}`}
          disabled={run.focusCharge < 100 || run.focusUntil > run.elapsed}
          onClick={focus}
          title={c.focusDescription}
        >
          <span className="focus-icon">
            <Zap size={18} />
          </span>
          <span>
            <strong>{c.focus}</strong>
            <small>
              {run.focusUntil > run.elapsed
                ? `${Math.ceil(run.focusUntil - run.elapsed)}s`
                : run.focusCharge >= 100
                  ? c.focusReady
                  : `${run.focusCharge}%`}
            </small>
          </span>
          <kbd>F</kbd>
          <i style={{ width: `${run.focusCharge}%` }} />
        </button>
      </div>
    </section>
  );
}
