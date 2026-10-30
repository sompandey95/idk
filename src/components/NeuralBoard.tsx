import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { ArrowDown, ArrowRight, Radio } from "lucide-react";
import { getRelayTarget, SIGNALS, SIGNAL_META } from "../game/simulation";
import type { GameRun, Pulse, Signal } from "../game/simulation";
import type { GameCopy } from "../services/copy";

type Point = { x: number; y: number };
function layout(width: number, height: number) {
  const portrait = width < 640;
  return {
    portrait,
    source: [0, 1, 2].map((i) =>
      portrait
        ? { x: width * (0.24 + i * 0.26), y: height * 0.15 }
        : { x: width * 0.12, y: height * (0.26 + i * 0.24) },
    ),
    relays: [0, 1, 2, 3].map((i) =>
      portrait
        ? { x: width * (0.14 + i * 0.24), y: height * 0.47 }
        : { x: width * 0.44, y: height * (0.17 + i * 0.22) },
    ),
    gates: SIGNALS.map((_, i) =>
      portrait
        ? { x: width * (0.14 + i * 0.24), y: height * 0.84 }
        : { x: width * 0.86, y: height * (0.17 + i * 0.22) },
    ),
  };
}
function bezier(a: Point, b: Point, t: number, portrait: boolean): Point {
  const c1 = portrait
    ? { x: a.x, y: a.y + (b.y - a.y) * 0.5 }
    : { x: a.x + (b.x - a.x) * 0.5, y: a.y };
  const c2 = portrait
    ? { x: b.x, y: a.y + (b.y - a.y) * 0.5 }
    : { x: a.x + (b.x - a.x) * 0.5, y: b.y };
  const u = 1 - t;
  return {
    x:
      u ** 3 * a.x +
      3 * u ** 2 * t * c1.x +
      3 * u * t ** 2 * c2.x +
      t ** 3 * b.x,
    y:
      u ** 3 * a.y +
      3 * u ** 2 * t * c1.y +
      3 * u * t ** 2 * c2.y +
      t ** 3 * b.y,
  };
}
function connection(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  portrait: boolean,
) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  if (portrait)
    ctx.bezierCurveTo(a.x, (a.y + b.y) / 2, b.x, (a.y + b.y) / 2, b.x, b.y);
  else ctx.bezierCurveTo((a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y, b.x, b.y);
  ctx.stroke();
}
function pulsePoint(pulse: Pulse, positions: ReturnType<typeof layout>) {
  const sourceIndex =
    pulse.signal === "noise" ? 1 : SIGNALS.indexOf(pulse.signal);
  return pulse.stage === "incoming"
    ? bezier(
        positions.source[sourceIndex],
        positions.relays[pulse.relay],
        pulse.progress,
        positions.portrait,
      )
    : bezier(
        positions.relays[pulse.relay],
        positions.gates[SIGNALS.indexOf(pulse.destination!)],
        pulse.progress,
        positions.portrait,
      );
}

export function NeuralBoard({
  runRef,
  run,
  selected,
  onSelect,
  onRoute,
  reducedMotion,
  copy,
}: {
  runRef: MutableRefObject<GameRun | null>;
  run: GameRun;
  selected: number;
  onSelect: (relay: number) => void;
  onRoute: (relay: number, signal: Signal) => void;
  reducedMotion: boolean;
  copy: GameCopy;
}) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ selected, reducedMotion });
  latest.current = { selected, reducedMotion };
  const [size, setSize] = useState({ width: 1000, height: 480 });
  const dragRelay = useRef<number | null>(null);
  const dragPoint = useRef<Point | null>(null);
  const positions = layout(size.width, size.height);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    element.width = Math.round(size.width * dpr);
    element.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    const draw = (time: number) => {
      ctx.clearRect(0, 0, size.width, size.height);
      const current = runRef.current;
      if (!current) return;
      const pos = layout(size.width, size.height);
      ctx.fillStyle = "#28313a";
      for (let x = 20; x < size.width; x += 28)
        for (let y = 20; y < size.height; y += 28) {
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x, y, 1, 1);
        }
      ctx.globalAlpha = 1;
      pos.source.forEach((source, sourceIndex) =>
        pos.relays.forEach((relay) => {
          ctx.strokeStyle = "#202b35";
          ctx.lineWidth = 1;
          connection(ctx, source, relay, pos.portrait);
        }),
      );
      current.relays.forEach((relay, index) => {
        const target = getRelayTarget(relay);
        if (index === latest.current.selected)
          pos.gates.forEach((gate, i) => {
            if (SIGNALS[i] === target) return;
            ctx.setLineDash([3, 7]);
            ctx.strokeStyle = "#39434e";
            ctx.lineWidth = 1;
            connection(ctx, pos.relays[index], gate, pos.portrait);
            ctx.setLineDash([]);
          });
        ctx.strokeStyle = `${SIGNAL_META[target].color}${index === latest.current.selected ? "bc" : "60"}`;
        ctx.lineWidth = index === latest.current.selected ? 2 : 1.25;
        connection(
          ctx,
          pos.relays[index],
          pos.gates[SIGNALS.indexOf(target)],
          pos.portrait,
        );
      });
      if (dragRelay.current !== null && dragPoint.current) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "#e1eee9";
        ctx.lineWidth = 2;
        connection(
          ctx,
          pos.relays[dragRelay.current],
          dragPoint.current,
          pos.portrait,
        );
        ctx.setLineDash([]);
      }
      // The simulation owns packet progress. Rendering never mutates game state.
      for (const pulse of current.pulses) {
        const point = pulsePoint(pulse, pos);
        const color = SIGNAL_META[pulse.signal].color;
        if (!latest.current.reducedMotion) {
          const glow = ctx.createRadialGradient(
            point.x,
            point.y,
            0,
            point.x,
            point.y,
            22,
          );
          glow.addColorStop(0, `${color}50`);
          glow.addColorStop(1, `${color}00`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 22, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#10171e";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(SIGNAL_META[pulse.signal].symbol, point.x, point.y);
      }
      for (const event of current.events) {
        const age = current.elapsed - event.time;
        if (
          !["correct", "error"].includes(event.kind) ||
          !event.signal ||
          age > 0.65 ||
          latest.current.reducedMotion
        )
          continue;
        const p = pos.gates[SIGNALS.indexOf(event.signal)];
        ctx.strokeStyle =
          event.kind === "correct"
            ? SIGNAL_META[event.signal].color
            : "#f2829c";
        ctx.globalAlpha = Math.max(0, 1 - age / 0.65);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 22 + age * 36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, runRef]);

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRelay.current !== null && dragPoint.current) {
      const rect = container.current!.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const index = positions.gates.findIndex(
        (g) => Math.hypot(g.x - point.x, g.y - point.y) < 34,
      );
      if (index >= 0) onRoute(dragRelay.current, SIGNALS[index]);
    }
    dragRelay.current = null;
    dragPoint.current = null;
  };
  return (
    <div
      className={`neural-board ${positions.portrait ? "board-portrait" : ""}`}
      ref={container}
      onPointerMove={(event) => {
        if (dragRelay.current !== null) {
          const rect = container.current!.getBoundingClientRect();
          dragPoint.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
        }
      }}
      onPointerUp={pointerUp}
      onPointerCancel={() => {
        dragRelay.current = null;
        dragPoint.current = null;
      }}
    >
      <canvas ref={canvas} aria-hidden="true" data-testid="neural-canvas" />
      <span className="layer-label input-label">{copy.incoming}</span>
      <span className="layer-label relay-label">{copy.relays}</span>
      <span className="layer-label output-label">{copy.outputs}</span>
      {positions.source.map((p, i) => (
        <div
          className="source-node"
          key={i}
          style={
            {
              left: p.x,
              top: p.y,
              "--signal": SIGNAL_META[SIGNALS[i]].color,
            } as React.CSSProperties
          }
        >
          <Radio size={19} />
          <span>{SIGNAL_META[SIGNALS[i]].symbol}</span>
        </div>
      ))}
      {positions.relays.map((p, i) => (
        <button
          key={i}
          type="button"
          data-relay={i}
          aria-pressed={selected === i}
          aria-label={`${copy.selectRelay} ${i + 1}`}
          disabled={run.phase !== "playing"}
          className={`relay-node ${selected === i ? "is-selected" : ""}`}
          style={
            {
              left: p.x,
              top: p.y,
              "--signal": SIGNAL_META[getRelayTarget(run.relays[i])].color,
            } as React.CSSProperties
          }
          onClick={() => onSelect(i)}
          onPointerDown={(event) => {
            if (run.phase === "playing") {
              dragRelay.current = i;
              onSelect(i);
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }}
        >
          <span className="relay-core">{String(i + 1).padStart(2, "0")}</span>
          <span className="relay-target">
            {SIGNAL_META[getRelayTarget(run.relays[i])].symbol}
          </span>
        </button>
      ))}
      {positions.gates.map((p, i) => (
        <button
          key={i}
          data-gate={SIGNALS[i]}
          className={`gate-node ${getRelayTarget(run.relays[selected]) === SIGNALS[i] ? "is-routed" : ""}`}
          disabled={run.phase !== "playing"}
          aria-label={`${copy.chooseGate}: ${SIGNAL_META[SIGNALS[i]].label}`}
          title={SIGNAL_META[SIGNALS[i]].label}
          style={
            {
              left: p.x,
              top: p.y,
              "--signal": SIGNAL_META[SIGNALS[i]].color,
            } as React.CSSProperties
          }
          onClick={() => onRoute(selected, SIGNALS[i])}
        >
          <span className="gate-core">{SIGNAL_META[SIGNALS[i]].symbol}</span>
          <span className="gate-label">
            {i === 3 ? "⊘" : SIGNAL_META[SIGNALS[i]].label}
          </span>
        </button>
      ))}
      <div className="board-watermark">
        <span className="status-dot" />
        {copy.live}
        <span>
          {positions.portrait ? (
            <ArrowDown size={12} />
          ) : (
            <ArrowRight size={12} />
          )}
        </span>
      </div>
    </div>
  );
}
