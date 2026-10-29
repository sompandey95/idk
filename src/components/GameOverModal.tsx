import React from 'react';
import { RotateCcw, Trophy, Home, Award, AlertTriangle } from 'lucide-react';
import { translations, SupportedLanguage } from '../services/i18n.ts';
import { Achievement } from '../services/storage.ts';

interface GameOverModalProps {
  score: number;
  bestScore: number;
  epoch: number;
  accuracy: number;
  ddaPeak: number;
  newUnlocks: Achievement[];
  onRestart: () => void;
  onLeaderboard: () => void;
  onMainMenu: () => void;
  lang: SupportedLanguage;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  bestScore,
  epoch,
  accuracy,
  ddaPeak,
  newUnlocks,
  onRestart,
  onLeaderboard,
  onMainMenu,
  lang,
}) => {
  const t = translations[lang] || translations.en;
  const isNewRecord = score >= bestScore && score > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none overflow-y-auto">
      <div className="w-full max-w-md rounded-xl bg-[#090e1d] border border-red-500/40 p-6 sm:p-8 text-center shadow-[0_0_40px_rgba(255,0,85,0.25)] my-auto">
        <div className="inline-flex p-3 rounded-full bg-red-950/50 border border-red-500/40 text-red-400 mb-3 animate-pulse">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-wider text-red-400 mb-1">
          {t.gameOver}
        </h2>
        <p className="text-xs font-mono text-red-300/80 mb-6">
          {t.networkMeltdown}
        </p>

        {/* Primary Stat Tiles */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-[#050811] border border-cyan-500/30">
            <span className="block text-[10px] font-mono text-cyan-400/80 tracking-widest">
              {t.finalScore}
            </span>
            <span className="text-2xl font-display font-bold tabular-nums text-white">
              {score.toLocaleString()}
            </span>
            {isNewRecord && (
              <span className="block text-[10px] font-mono font-bold text-amber-400 mt-0.5">
                ★ NEW HIGH SCORE ★
              </span>
            )}
          </div>

          <div className="p-3 rounded-lg bg-[#050811] border border-slate-700/60">
            <span className="block text-[10px] font-mono text-slate-400 tracking-widest">
              {t.bestScore}
            </span>
            <span className="text-2xl font-display font-bold tabular-nums text-slate-200">
              {bestScore.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#050811] border border-slate-700/60">
            <span className="block text-[10px] font-mono text-slate-400 tracking-widest">
              {t.epochsCleared}
            </span>
            <span className="text-xl font-display font-semibold tabular-nums text-slate-200">
              {epoch}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#050811] border border-slate-700/60">
            <span className="block text-[10px] font-mono text-slate-400 tracking-widest">
              {t.classificationRate}
            </span>
            <span className="text-xl font-display font-semibold tabular-nums text-emerald-400">
              {accuracy}%
            </span>
          </div>
        </div>

        {/* New Unlocked Achievements Notification */}
        {newUnlocks.length > 0 && (
          <div className="mb-6 p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-left">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold mb-1">
              <Award className="w-4 h-4" />
              <span>ACHIEVEMENT UNLOCKED!</span>
            </div>
            {newUnlocks.map(u => (
              <div key={u.id} className="text-xs text-amber-200/90 font-mono">
                • {u.name}: {u.description}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            data-start="true"
            onClick={onRestart}
            className="w-full py-3.5 rounded-lg font-display font-bold text-base bg-cyan-400 hover:bg-cyan-300 text-black flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          >
            <RotateCcw className="w-4 h-4 text-black" />
            <span>{t.playAgain}</span>
          </button>

          <button
            onClick={onLeaderboard}
            className="w-full py-3 rounded-lg font-display font-semibold text-sm bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-cyan-400" />
            <span>{t.leaderboard}</span>
          </button>

          <button
            onClick={onMainMenu}
            className="w-full py-2.5 rounded-lg font-mono text-xs text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t.mainMenu}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
