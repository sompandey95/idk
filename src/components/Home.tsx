import {
  ArrowUpRight,
  ArrowRight,
  Play,
  Activity,
  CalendarDays,
  Swords,
  Timer,
  ChevronRight,
  Sparkles,
  Trophy,
  AudioLines,
} from "lucide-react";
import type { GameCopy } from "../services/copy";
import type { PlayerState } from "../services/player";
import type { GameRun, RunMode } from "../game/simulation";

export function Home({
  player,
  copy: c,
  start,
  open,
  checkpoint,
  resume,
  locale,
}: {
  player: PlayerState;
  copy: GameCopy;
  start: (mode: RunMode) => void;
  open: (panel: string) => void;
  checkpoint: GameRun | null;
  resume: () => void;
  locale: string;
}) {
  const challenge = player.dailyChallenge;
  const format = (n: number) => n.toLocaleString(locale);
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="tiny-orbit" />
            {c.eyebrow}
          </div>
          <h1>
            {c.heroOne}
            <br />
            <span>{c.heroTwo}</span>
          </h1>
          <p className="hero-description">{c.heroDescription}</p>
          <div className="hero-actions">
            <button
              className="button button-primary"
              data-start
              onClick={() => start("adaptive")}
            >
              <Play size={16} fill="currentColor" />
              {c.start}
              <ArrowUpRight size={18} />
            </button>
            <button className="text-button" onClick={() => start("tutorial")}>
              {c.learn}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="hero-stats">
            <div>
              <span>{c.best}</span>
              <strong>
                {format(player.highScore)}
                <Trophy size={14} />
              </strong>
            </div>
            <div>
              <span>{c.routed}</span>
              <strong>
                {format(player.totalPacketsClassified)}
                <AudioLines size={15} />
              </strong>
            </div>
            <div>
              <span>{c.unlocked}</span>
              <strong>
                {player.achievements.filter((a) => a.unlocked).length}
                <small>/ 08</small>
              </strong>
            </div>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <img
            src="/assets/neural-core.png"
            alt=""
            fetchPriority="high"
            decoding="async"
          />
          <div className="art-coordinate coord-top">
            SYN—001 <span>NEURAL CORE</span>
          </div>
          <div className="art-coordinate coord-bottom">
            <span className="status-dot" /> SYSTEM IN BALANCE
            <span className="coordinate-cross">+</span>
          </div>
          <span className="art-plus plus-one">+</span>
          <span className="art-plus plus-two">+</span>
        </div>
      </section>
      {checkpoint && (
        <button className="continue-card" onClick={resume}>
          <div className="continue-icon">
            <Play size={18} />
          </div>
          <div>
            <strong>{c.resumeRun}</strong>
            <span>{c.savedRun}</span>
          </div>
          <span className="mono">{format(checkpoint.score)}</span>
          <ArrowRight size={18} />
        </button>
      )}
      <section className="mode-section" aria-labelledby="modes-title">
        <div className="section-heading">
          <h2 id="modes-title">{c.chooseMode}</h2>
          <span className="line" />
          <span className="mono small muted">01 — 04</span>
        </div>
        <div className="mode-grid">
          <button
            className="mode-card mode-adaptive"
            onClick={() => start("adaptive")}
          >
            <div className="mode-top">
              <span className="mode-icon">
                <Activity size={20} />
              </span>
              <span className="mode-number">01</span>
            </div>
            <h3>{c.adaptive}</h3>
            <p>{c.adaptiveDescription}</p>
            <div className="mode-bottom">
              <span className="mode-pill">
                <span className="status-dot" />
                {c.difficulty}
              </span>
              <ArrowUpRight size={20} />
            </div>
          </button>
          <button className="mode-card" onClick={() => start("daily")}>
            <div className="mode-top">
              <span className="mode-icon violet">
                <CalendarDays size={20} />
              </span>
              <span className="mode-number">02</span>
            </div>
            <h3>{c.daily}</h3>
            <p>{c.dailyDescription}</p>
            <div className="mode-bottom">
              <span className="mono small muted">{challenge.date}</span>
              <ArrowUpRight size={20} />
            </div>
          </button>
          <button className="mode-card" onClick={() => start("sprint")}>
            <div className="mode-top">
              <span className="mode-icon amber">
                <Timer size={20} />
              </span>
              <span className="mode-number">03</span>
            </div>
            <h3>{c.sprint}</h3>
            <p>{c.sprintDescription}</p>
            <div className="mode-bottom">
              <span className="mono small muted">90 SEC</span>
              <ArrowUpRight size={20} />
            </div>
          </button>
          <button className="mode-card" onClick={() => open("duel")}>
            <div className="mode-top">
              <span className="mode-icon rose">
                <Swords size={20} />
              </span>
              <span className="mode-number">04</span>
            </div>
            <h3>{c.duel}</h3>
            <p>{c.duelDescription}</p>
            <div className="mode-bottom">
              <span className="mono small muted">1 VS 1</span>
              <ArrowUpRight size={20} />
            </div>
          </button>
        </div>
      </section>
      <section className="home-bottom">
        <button className="daily-card" onClick={() => start("daily")}>
          <div className="daily-symbol">
            <CalendarDays size={22} />
          </div>
          <div>
            <p className="eyebrow">{c.daily}</p>
            <h3>{c.dailyNames[challenge.variant]}</h3>
            <p>
              {challenge.target} {c.dailyGoal} · {challenge.minimumAccuracy}%{" "}
              {c.minimum}
            </p>
            <div className="daily-progress">
              <div
                style={{
                  width: `${(challenge.progress / challenge.target) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="daily-reward">
            <span>{challenge.completed ? "✓" : `+${challenge.reward}`}</span>
            <small>{challenge.completed ? c.completed : "XP"}</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <button className="season-card" onClick={() => open("collection")}>
          <div>
            <p className="eyebrow">
              <Sparkles size={12} />
              {c.season}
            </p>
            <h3>{c.seasonDescription}</h3>
            <span>
              {c.viewCollection}
              <ArrowRight size={14} />
            </span>
          </div>
          <div className="mini-cores">
            <i />
            <i />
            <i />
          </div>
        </button>
      </section>
    </div>
  );
}
