import React from 'react';
import {
  Volume2,
  VolumeX,
  Smartphone,
  Trophy,
  Award,
  User,
  Users,
  Pause,
  Globe,
  Flame,
  Activity,
  Zap,
  Scissors,
  RotateCw
} from 'lucide-react';
import { DDAState } from '../game/neuralEngine.ts';
import { translations, SupportedLanguage } from '../services/i18n.ts';

interface HUDProps {
  score: number;
  epoch: number;
  combo: number;
  coreIntegrity: number; // 0 to 100
  dda: DDAState;
  loss: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  lang: SupportedLanguage;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
  onOpenLanguage: () => void;
  onOpenLeaderboard: () => void;
  onOpenAchievements: () => void;
  onOpenProfile: () => void;
  onOpenMultiplayer: () => void;
  onPause: () => void;
  onPruneSynapses: () => void;
  onInvertGradients: () => void;
  onTriggerOverdrive: () => void;
  overdriveReady: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  epoch,
  combo,
  coreIntegrity,
  dda,
  loss,
  soundEnabled,
  hapticsEnabled,
  lang,
  onToggleSound,
  onToggleHaptics,
  onOpenLanguage,
  onOpenLeaderboard,
  onOpenAchievements,
  onOpenProfile,
  onOpenMultiplayer,
  onPause,
  onPruneSynapses,
  onInvertGradients,
  onTriggerOverdrive,
  overdriveReady
}) => {
  const t = translations[lang] || translations.en;

  // Integrity color
  const integrityColor =
    coreIntegrity > 60 ? 'bg-cyan-400' : coreIntegrity > 30 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <header className="w-full flex flex-col pointer-events-auto bg-[#070c1b]/90 border-b border-cyan-500/20 px-3 py-2 sm:px-6 sm:py-3 z-30 select-none">
      {/* Top Primary Bar */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        {/* Left: Score & Epoch */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <span className="block text-[10px] sm:text-xs font-mono tracking-widest text-cyan-400/80">
              {t.score}
            </span>
            <span className="text-xl sm:text-3xl font-display font-bold tabular-nums text-cyan-300 neon-glow-cyan">
              {score.toLocaleString()}
            </span>
          </div>

          <div className="border-l border-slate-700/60 pl-3 sm:pl-4">
            <span className="block text-[10px] sm:text-xs font-mono tracking-widest text-slate-400">
              {t.epoch}
            </span>
            <span className="text-lg sm:text-2xl font-display font-semibold tabular-nums text-white">
              {epoch}
            </span>
          </div>

          {combo > 1 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-fuchsia-950/60 border border-fuchsia-500/50 text-fuchsia-300 animate-pulse">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-fuchsia-400" />
              <span className="text-xs sm:text-sm font-mono font-bold tabular-nums">
                {combo}x {t.combo}
              </span>
            </div>
          )}
        </div>

        {/* Center: DDA Telemetry Pill */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0a1128] border border-cyan-500/30 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="font-semibold">{t.ddaStatus}:</span>
          </div>
          <div className="text-slate-300">
            DIFF: <span className="text-cyan-400 font-bold tabular-nums">{dda.level.toFixed(2)}x</span>
          </div>
          <div className="text-slate-400">|</div>
          <div className="text-slate-300">
            ACC: <span className="text-emerald-400 font-bold tabular-nums">{dda.accuracyRate}%</span>
          </div>
          <div className="text-slate-400">|</div>
          <div className="text-slate-300">
            LAT: <span className="text-amber-400 font-bold tabular-nums">{dda.avgLatencyMs}ms</span>
          </div>
          <div className="text-slate-400">|</div>
          <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-500/40">
            {dda.statusMessage}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={onOpenLeaderboard}
            aria-label={t.leaderboard}
            title={t.leaderboard}
            className="p-1.5 sm:p-2 rounded bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-700/60 hover:border-cyan-500/50 text-cyan-400 transition"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={onOpenAchievements}
            aria-label={t.achievements}
            title={t.achievements}
            className="p-1.5 sm:p-2 rounded bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-700/60 hover:border-cyan-500/50 text-amber-400 transition"
          >
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={onOpenMultiplayer}
            aria-label={t.multiplayer}
            title={t.multiplayer}
            className="p-1.5 sm:p-2 rounded bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-700/60 hover:border-cyan-500/50 text-fuchsia-400 transition"
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={onOpenProfile}
            aria-label={t.playerProfile}
            title={t.playerProfile}
            className="p-1.5 sm:p-2 rounded bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-700/60 hover:border-cyan-500/50 text-indigo-400 transition"
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={onOpenLanguage}
            aria-label={t.language}
            title={t.language}
            className="p-1.5 sm:p-2 rounded bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-700/60 hover:border-cyan-500/50 text-slate-300 transition"
          >
            <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={onToggleSound}
            aria-label={t.sound}
            title={t.sound}
            className={`p-1.5 sm:p-2 rounded border transition ${
              soundEnabled
                ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-400'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          <button
            onClick={onToggleHaptics}
            aria-label={t.haptics}
            title={t.haptics}
            className={`p-1.5 sm:p-2 rounded border transition ${
              hapticsEnabled
                ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-400'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-500'
            }`}
          >
            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={onPause}
            aria-label={t.pause}
            title={t.pause}
            className="p-1.5 sm:p-2 rounded bg-slate-900/80 hover:bg-amber-950/60 border border-slate-700/60 hover:border-amber-500/50 text-amber-400 transition"
          >
            <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Secondary Bar: Integrity Gauge & Quick Operator Tools */}
      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        {/* Core Integrity Meter */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
            {t.coreIntegrity}:
          </span>
          <div className="flex-1 h-2.5 rounded-full bg-slate-950 border border-slate-700/80 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${integrityColor}`}
              style={{ width: `${Math.max(0, Math.min(100, coreIntegrity))}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold tabular-nums text-slate-200">
            {coreIntegrity}%
          </span>
        </div>

        {/* Tactical Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPruneSynapses}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition"
          >
            <Scissors className="w-3 h-3 text-cyan-400" />
            <span>PRUNE WEAK</span>
          </button>

          <button
            onClick={onInvertGradients}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-fuchsia-300 transition"
          >
            <RotateCw className="w-3 h-3 text-fuchsia-400" />
            <span>INVERT</span>
          </button>

          <button
            onClick={onTriggerOverdrive}
            disabled={!overdriveReady}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-bold transition ${
              overdriveReady
                ? 'bg-gradient-to-r from-amber-500 to-fuchsia-500 text-black animate-pulse cursor-pointer'
                : 'bg-slate-950 border border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>OVERDRIVE [F]</span>
          </button>
        </div>
      </div>
    </header>
  );
};
