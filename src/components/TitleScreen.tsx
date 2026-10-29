import React from 'react';
import { Play, Trophy, Award, Users, Globe, User, Cpu, Activity, ShieldCheck } from 'lucide-react';
import { translations, SupportedLanguage } from '../services/i18n.ts';
import { PlayerState } from '../services/storage.ts';

interface TitleScreenProps {
  onStart: () => void;
  playerState: PlayerState;
  lang: SupportedLanguage;
  onOpenLeaderboard: () => void;
  onOpenAchievements: () => void;
  onOpenProfile: () => void;
  onOpenMultiplayer: () => void;
  onOpenLanguage: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  playerState,
  lang,
  onOpenLeaderboard,
  onOpenAchievements,
  onOpenProfile,
  onOpenMultiplayer,
  onOpenLanguage,
}) => {
  const t = translations[lang] || translations.en;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-4 sm:p-8 bg-[#050811] text-white z-20 select-none overflow-y-auto">
      {/* Top Banner / System Telemetry */}
      <div className="w-full max-w-5xl flex items-center justify-between text-xs font-mono text-cyan-400/80 border-b border-cyan-500/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>NEURAL ARCHITECTURE // DDA ENGINE ONLINE</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onOpenLanguage}
            className="flex items-center gap-1.5 hover:text-cyan-300 transition"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang.toUpperCase()}</span>
          </button>
          <span>REGION: {playerState.region}</span>
        </div>
      </div>

      {/* Hero Title & SVG Emblem Lockup */}
      <div className="my-auto flex flex-col items-center text-center max-w-2xl px-4">
        {/* Inline Neural Core SVG Emblem */}
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-6">
          <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_0_16px_rgba(0,240,255,0.6)]">
            <defs>
              <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f0ff" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#ff007f" />
              </linearGradient>
            </defs>
            {/* Outer Hexagon Orbit */}
            <polygon
              points="50,5 90,27 90,73 50,95 10,73 10,27"
              fill="none"
              stroke="#00f0ff"
              strokeWidth="1.5"
              strokeDasharray="4, 3"
              className="animate-spin"
              style={{ transformOrigin: 'center', animationDuration: '24s' }}
            />
            {/* Inner Neural Node Ring */}
            <circle cx="50" cy="50" r="28" fill="#090e1d" stroke="url(#neonGrad)" strokeWidth="2.5" />
            <circle cx="50" cy="30" r="4.5" fill="#00f0ff" />
            <circle cx="68" cy="60" r="4.5" fill="#a855f7" />
            <circle cx="32" cy="60" r="4.5" fill="#ff007f" />
            <line x1="50" y1="30" x2="68" y2="60" stroke="#00f0ff" strokeWidth="1.5" opacity="0.8" />
            <line x1="68" y1="60" x2="32" y2="60" stroke="#a855f7" strokeWidth="1.5" opacity="0.8" />
            <line x1="32" y1="60" x2="50" y2="30" stroke="#ff007f" strokeWidth="1.5" opacity="0.8" />
            {/* Center Core */}
            <circle cx="50" cy="50" r="6" fill="#00ff9d" className="animate-pulse" />
          </svg>
        </div>

        <h1 className="text-4xl sm:text-6xl font-display font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-400 neon-glow-cyan mb-2">
          {t.appName}
        </h1>

        <p className="text-sm sm:text-base font-mono text-cyan-200/90 mb-6">
          {t.tagline}
        </p>

        {/* Primary Start CTA Button */}
        <button
          data-start="true"
          onClick={onStart}
          className="group relative px-8 py-4 sm:px-10 sm:py-4.5 rounded-lg font-display font-bold text-lg sm:text-xl text-black bg-cyan-400 hover:bg-cyan-300 transition-all duration-200 shadow-[0_0_25px_rgba(0,240,255,0.6)] hover:shadow-[0_0_35px_rgba(0,240,255,0.9)] hover:scale-105 active:scale-95 flex items-center gap-3 cursor-pointer mb-6"
        >
          <Play className="w-6 h-6 fill-black" />
          <span>{t.startBtn}</span>
        </button>

        {/* Secondary Hub Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full max-w-lg mb-4">
          <button
            onClick={onOpenLeaderboard}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-slate-900/90 hover:bg-cyan-950/60 border border-slate-700/80 hover:border-cyan-500/50 text-cyan-300 text-xs font-mono transition"
          >
            <Trophy className="w-4 h-4 text-cyan-400" />
            <span>{t.leaderboard}</span>
          </button>

          <button
            onClick={onOpenAchievements}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-slate-900/90 hover:bg-amber-950/60 border border-slate-700/80 hover:border-amber-500/50 text-amber-300 text-xs font-mono transition"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>{t.achievements}</span>
          </button>

          <button
            onClick={onOpenMultiplayer}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-slate-900/90 hover:bg-fuchsia-950/60 border border-slate-700/80 hover:border-fuchsia-500/50 text-fuchsia-300 text-xs font-mono transition"
          >
            <Users className="w-4 h-4 text-fuchsia-400" />
            <span>{t.multiplayer}</span>
          </button>

          <button
            onClick={onOpenProfile}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-slate-900/90 hover:bg-indigo-950/60 border border-slate-700/80 hover:border-indigo-500/50 text-indigo-300 text-xs font-mono transition"
          >
            <User className="w-4 h-4 text-indigo-400" />
            <span>{t.playerProfile}</span>
          </button>
        </div>

        {/* Daily Matrix Banner */}
        <div className="w-full p-3 rounded-lg bg-[#09112a]/80 border border-cyan-500/20 text-left flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-cyan-400 font-bold block">{playerState.dailyChallenge.title}</span>
            <span className="text-slate-300">{playerState.dailyChallenge.requirement}</span>
          </div>
          <div className="text-right">
            <span className={`px-2 py-0.5 rounded font-bold ${
              playerState.dailyChallenge.completed ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
            }`}>
              {playerState.dailyChallenge.completed ? 'COMPLETED' : `${playerState.dailyChallenge.currentCount}/${playerState.dailyChallenge.targetCount}`}
            </span>
          </div>
        </div>
      </div>

      {/* Clean Control Hints Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/80 pt-3 flex-wrap gap-2">
        <span>{t.controlsHint}</span>
        <div className="flex items-center gap-3">
          <span>OPERATOR: <strong className="text-white">{playerState.displayName}</strong></span>
          <span>BEST: <strong className="text-cyan-400">{playerState.highScore.toLocaleString()}</strong></span>
        </div>
      </div>
    </div>
  );
};
