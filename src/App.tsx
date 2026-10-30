import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowRight,
  AudioLines,
  Award,
  Check,
  ChevronRight,
  Cloud,
  Globe,
  LoaderCircle,
  Play,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Home } from "./components/Home";
import { GameView } from "./components/GameView";
import { Dialog } from "./components/Dialog";
import { useGame } from "./hooks/useGame";
import { useCloud } from "./hooks/useCloud";
import { accuracy, SIGNALS, stepRun } from "./game/simulation";
import { loadPlayer, PLAYER_EVENT, savePlayer } from "./services/player";
import { getCopy } from "./services/copy";
import { loadPreferences, savePreferences } from "./services/preferences";
import { sound } from "./services/sound";
import { achievementCopy } from "./services/achievementCopy";
import type { DuelRoom } from "./services/firebase";
import type { RunMode } from "./game/simulation";

const Panels = lazy(() => import("./components/Panels"));

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="Synapse home">
      <svg viewBox="0 0 38 38" fill="none" aria-hidden="true">
        <path
          d="M19 3 33 11v16l-14 8-14-8V11L19 3Z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="m12 23 7-12 7 12H12Z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="19" cy="11" r="3" fill="currentColor" />
        <circle cx="12" cy="23" r="3" fill="currentColor" />
        <circle cx="26" cy="23" r="3" fill="currentColor" />
      </svg>
      <span>
        SYNAPSE<small>O V E R D R I V E</small>
      </span>
    </button>
  );
}

export default function App() {
  const [player, setPlayer] = useState(loadPlayer);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [panel, setPanel] = useState("");
  const [selected, setSelected] = useState(0);
  const [audio, setAudio] = useState(sound.isSoundEnabled());
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [roomError, setRoomError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const roomRef = useRef(room);
  roomRef.current = room;
  const startedRooms = useRef(new Set<string>());
  const previousBest = useRef(0);
  const autoPaused = useRef(false);
  const cloud = useCloud();
  const c = getCopy(preferences.language);
  const game = useGame((run) => {
    setPanel("");
    if (run.mode !== "tutorial") void cloud.sync();
  });
  const run = game.snapshot;
  const start = useCallback(
    (mode: RunMode, seed?: number) => {
      previousBest.current = loadPlayer().highScore;
      setSelected(0);
      setPanel("");
      autoPaused.current = false;
      if (mode !== "duel") {
        setRoomId("");
        setRoom(null);
      }
      game.start(mode, seed);
    },
    [game.start],
  );
  const open = useCallback(
    (kind: string) => {
      if (
        game.runRef.current?.phase === "playing" &&
        game.runRef.current.mode !== "duel"
      ) {
        game.pause();
        autoPaused.current = true;
      }
      setPanel(kind);
    },
    [game.pause],
  );
  const close = useCallback(() => {
    setPanel("");
    setAudio(sound.isSoundEnabled());
    if (autoPaused.current) {
      autoPaused.current = false;
      game.resume();
    }
    if (roomRef.current?.status === "waiting") {
      const id = roomRef.current.id;
      void import("./services/firebase")
        .then((service) => service.cancelWaitingRoom(id))
        .catch(() => {});
      setRoomId("");
      setRoom(null);
    }
  }, [game.resume]);
  const home = () => {
    if (game.runRef.current?.phase === "playing") game.pause();
    else {
      game.exit();
      setRoomId("");
      setRoom(null);
      setPanel("");
    }
  };

  useEffect(() => {
    const update = () => setPlayer(loadPlayer());
    window.addEventListener(PLAYER_EVENT, update);
    window.addEventListener("storage", update);
    const day = setInterval(update, 60000);
    // Persist schema migration and a stable local identity before the first run.
    savePlayer(loadPlayer());
    return () => {
      window.removeEventListener(PLAYER_EVENT, update);
      window.removeEventListener("storage", update);
      clearInterval(day);
    };
  }, []);
  useEffect(() => {
    savePreferences(preferences);
    document.documentElement.lang = preferences.language;
    document.documentElement.dataset.motion = preferences.reducedMotion
      ? "reduced"
      : "full";
  }, [preferences]);
  useEffect(() => {
    if (run?.id) window.scrollTo({ top: 0, behavior: "instant" });
  }, [run?.id]);
  useEffect(() => {
    document.body.dataset.state = !run
      ? "title"
      : run.phase === "finished"
        ? "gameover"
        : run.phase;
    document.documentElement.dataset.skin = player.equippedSkin;
  }, [run?.phase, player.equippedSkin]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (
        panel ||
        (event.target as HTMLElement).closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === "Escape" || event.code === "KeyP") {
        if (game.runRef.current?.phase === "playing") game.pause();
        else if (game.runRef.current?.phase === "paused") game.resume();
        return;
      }
      if (event.code === "KeyM") {
        setAudio(sound.toggleSound());
        return;
      }
      if (!run || run.phase === "finished") {
        if (
          (event.code === "Space" || event.code === "Enter") &&
          event.target === document.body
        ) {
          event.preventDefault();
          start("adaptive");
        }
        return;
      }
      if (run.phase !== "playing") return;
      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        setSelected(Number(event.key) - 1);
      }
      const gate = ["KeyA", "KeyB", "KeyC", "KeyQ"].indexOf(event.code);
      if (gate >= 0) {
        event.preventDefault();
        game.route(selected, SIGNALS[gate]);
      }
      if (event.code === "KeyF") {
        event.preventDefault();
        game.focus();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [
    panel,
    run?.phase,
    selected,
    start,
    game.pause,
    game.resume,
    game.route,
    game.focus,
  ]);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    setRoomError(false);
    import("./services/firebase")
      .then((service) => {
        if (alive)
          unsubscribe = service.watchRoom(
            roomId,
            (value) => {
              if (alive) setRoom(value);
            },
            () => {
              if (alive) setRoomError(true);
            },
          );
      })
      .catch(() => {
        if (alive) setRoomError(true);
      });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [roomId]);
  useEffect(() => {
    if (!roomId) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [roomId]);
  useEffect(() => {
    if (
      !room ||
      room.status !== "active" ||
      !room.startAt ||
      startedRooms.current.has(room.id)
    )
      return;
    const delay = Math.max(0, room.startAt - Date.now());
    const timer = setTimeout(() => {
      startedRooms.current.add(room.id);
      start("duel", room.seed);
      if (game.runRef.current)
        stepRun(
          game.runRef.current,
          Math.max(0, (Date.now() - room.startAt!) / 1000),
        );
    }, delay);
    return () => clearTimeout(timer);
  }, [room?.id, room?.status, room?.startAt, start]);
  useEffect(() => {
    if (!roomId || !cloud.user) return;
    let lastScore = -1;
    let sentFinal = false;
    let sendina = false;
    const send = async () => {
      const active = game.runRef.current;
      const currentRoom = roomRef.current;
      if (!currentRoom || active?.mode !== "duel" || sendina || !cloud.online)
        return;
      const done = active.phase === "finished";
      if (lastScore === active.score && (!done || sentFinal)) return;
      sendina = true;
      try {
        await (
          await import("./services/firebase")
        ).sendDuelScore(currentRoom, active.score, done);
        lastScore = active.score;
        sentFinal = done;
      } catch {
        setRoomError(true);
      } finally {
        sendina = false;
      }
    };
    const timer = setInterval(() => void send(), 1000);
    return () => clearInterval(timer);
  }, [roomId, cloud.user, cloud.online]);

  const isHost = room?.hostId === cloud.user?.uid;
  const opponent = room
    ? {
        name: (isHost ? room.guestName : room.hostName) || c.opponent,
        score: isHost ? room.guestScore : room.hostScore,
      }
    : undefined;
  const bothDone = room?.hostDone && room?.guestDone;
  const ownScore = isHost ? room?.hostScore : room?.guestScore;
  const roomStatus = roomError
    ? c.roomError
    : room?.startAt
      ? `${Math.max(0, Math.ceil((room.startAt - now) / 1000))}…`
      : c.waiting;
  return (
    <div className={`app-shell ${run ? "in-game" : ""}`}>
      <a className="skip-link" href="#main-content">
        {c.play}
      </a>
      <header className="site-header">
        <Brand onClick={home} />
        <nav className="main-navigation" aria-label="Synapse">
          <button className={!panel ? "active" : ""} onClick={home}>
            {c.play}
          </button>
          <button
            className={panel === "rankings" ? "active" : ""}
            onClick={() => open("rankings")}
          >
            {c.rankings}
          </button>
          <button
            className={panel === "collection" ? "active" : ""}
            onClick={() => open("collection")}
          >
            {c.collection}
          </button>
        </nav>
        <div className="header-actions">
          <span
            className={`connection-status ${!cloud.online ? "is-offline" : ""}`}
          >
            <span className="status-dot" />
            {!cloud.online
              ? c.offline
              : cloud.status === "connected"
                ? c.connected
                : c.local}
          </span>
          <button
            className="icon-button sound-control"
            aria-label={c.sound}
            aria-pressed={audio}
            onClick={() => setAudio(sound.toggleSound())}
          >
            {audio ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            className="icon-button"
            aria-label={c.settings}
            onClick={() => open("settings")}
          >
            <Settings2 size={18} />
          </button>
          <button
            className="avatar-button"
            aria-label={c.profile}
            onClick={() => open("profile")}
          >
            {player.displayName.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>
      <main id="main-content">
        {run ? (
          <GameView
            run={run}
            runRef={game.runRef}
            selected={selected}
            setSelected={setSelected}
            route={game.route}
            focus={game.focus}
            pause={game.pause}
            reducedMotion={preferences.reducedMotion}
            copy={c}
            locale={preferences.language}
            opponent={run.mode === "duel" ? opponent : undefined}
          />
        ) : (
          <Home
            player={player}
            copy={c}
            start={start}
            open={open}
            checkpoint={game.checkpoint}
            resume={game.resumeCheckpoint}
            locale={preferences.language}
          />
        )}
      </main>
      {!run && (
        <footer className="site-footer">
          <span>
            <span className="footer-mark">✳</span>
            {c.footer}
          </span>
          <div>
            <span className="offline-label">
              <ShieldCheck size={13} />
              {c.local}
            </span>
            <button className="text-button" onClick={() => open("settings")}>
              <Globe size={13} />
              {preferences.language.toUpperCase()}
            </button>
            <span className="mono small">V.02</span>
          </div>
        </footer>
      )}
      {run?.phase === "paused" && !panel && (
        <Dialog
          title={c.paused}
          eyebrow={c.adaptive}
          onClose={game.resume}
          closeLabel={c.close}
        >
          <div className="pause-content">
            <div className="pause-orbit">
              <AudioLines size={30} />
            </div>
            <p>{c.pauseDescription}</p>
            <button className="button button-primary" onClick={game.resume}>
              <Play size={16} fill="currentColor" />
              {c.resume}
              <ArrowRight size={16} />
            </button>
            <button
              className="button button-secondary"
              onClick={() => start(run.mode)}
            >
              {c.restart}
            </button>
            <button className="text-button" onClick={game.exit}>
              {c.menu}
            </button>
          </div>
        </Dialog>
      )}
      {run?.phase === "finished" && !panel && (
        <Dialog
          title={
            run.mode === "tutorial"
              ? c.tutorialDone
              : run.mode === "duel" && bothDone
                ? ownScore === opponent?.score
                  ? c.tie
                  : (ownScore || 0) > (opponent?.score || 0)
                    ? c.won
                    : c.lost
                : c.finished
          }
          eyebrow={run.mode === "tutorial" ? c.learn : c[run.mode]}
          onClose={game.exit}
          closeLabel={c.close}
        >
          <div className="results-content">
            <div className="result-emblem">
              {run.mode === "tutorial" ? (
                <Check size={30} />
              ) : (
                <Activity size={30} />
              )}
            </div>
            <p>
              {run.mode === "tutorial"
                ? c.tutorialDoneDescription
                : run.finishReason === "time"
                  ? c.timeFinished
                  : c.integrityFinished}
            </p>
            <div className="result-score">
              <span>{c.score}</span>
              <strong>{run.score.toLocaleString(preferences.language)}</strong>
              {run.mode === "adaptive" && run.score > previousBest.current && (
                <small>
                  <Sparkles size={12} />
                  {c.newBest}
                </small>
              )}
            </div>
            <div className="result-metrics">
              <div>
                <span>{c.correct}</span>
                <strong>{run.correct}</strong>
              </div>
              <div>
                <span>{c.accuracy}</span>
                <strong>{accuracy(run)}%</strong>
              </div>
              <div>
                <span>{c.peakStreak}</span>
                <strong>{run.maxStreak}</strong>
              </div>
            </div>
            {run.mode === "duel" && (
              <p className="notice">
                {bothDone
                  ? `${c.opponent}: ${opponent?.score.toLocaleString(preferences.language)}`
                  : roomError
                    ? c.syncError
                    : c.waitingResult}
              </p>
            )}
            {game.unlocks.length > 0 && (
              <div className="unlock-notice">
                <Award size={22} />
                <div>
                  <span>{c.unlocked}</span>
                  <strong>
                    {game.unlocks
                      .map((a) => achievementCopy(preferences.language, a).name)
                      .join(" · ")}
                  </strong>
                </div>
              </div>
            )}
            {game.saveFailed && (
              <p className="notice notice-error">{c.saveError}</p>
            )}
            <button
              className="button button-primary"
              onClick={() =>
                start(
                  run.mode === "tutorial" || run.mode === "duel"
                    ? "adaptive"
                    : run.mode,
                )
              }
            >
              <Play size={16} />
              {run.mode === "tutorial" ? c.start : c.again}
              <ArrowRight size={16} />
            </button>
            <button className="text-button" onClick={game.exit}>
              {c.menu}
            </button>
          </div>
        </Dialog>
      )}
      {panel && (
        <Suspense
          fallback={
            <div className="loading-overlay">
              <LoaderCircle className="spin" aria-label={c.loading} />
            </div>
          }
        >
          <Panels
            panel={panel}
            close={close}
            copy={c}
            player={player}
            preferences={preferences}
            setPreferences={setPreferences}
            cloud={cloud}
            open={open}
            roomId={roomId}
            setRoomId={setRoomId}
            roomStatus={roomStatus}
          />
        </Suspense>
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {run?.phase === "finished"
          ? `${c.finished} ${c.score}: ${run.score}`
          : ""}
      </div>
    </div>
  );
}
