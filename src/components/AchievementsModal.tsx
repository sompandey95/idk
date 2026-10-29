import React, { useState } from 'react';
import { X, Award, Calendar, Zap, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { translations, SupportedLanguage } from '../services/i18n.ts';
import { PlayerState } from '../services/storage.ts';

interface AchievementsModalProps {
  onClose: () => void;
  playerState: PlayerState;
  lang: SupportedLanguage;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  onClose,
  playerState,
  lang,
}) => {
  const t = translations[lang] || translations.en;
  const [tab, setTab] = useState<'achievements' | 'daily' | 'season'>('achievements');

  const unlockedCount = playerState.achievements.filter(a => a.unlocked).length;
  const totalCount = playerState.achievements.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 select-none overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-[#090e1d] border border-amber-500/40 p-4 sm:p-6 text-white shadow-[0_0_35px_rgba(245,158,11,0.2)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-amber-300">
                {t.achievements} & {t.seasonalEvent}
              </h2>
              <span className="text-[11px] font-mono text-amber-400/80">
                UNLOCKED: {unlockedCount} / {totalCount} ({Math.round((unlockedCount / totalCount) * 100)}%)
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-4 text-xs font-mono">
          <button
            onClick={() => setTab('achievements')}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
              tab === 'achievements'
                ? 'bg-amber-400 text-black border-amber-400 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.achievements} ({unlockedCount}/{totalCount})
          </button>

          <button
            onClick={() => setTab('daily')}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
              tab === 'daily'
                ? 'bg-amber-400 text-black border-amber-400 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.dailyChallenge}
          </button>

          <button
            onClick={() => setTab('season')}
            className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
              tab === 'season'
                ? 'bg-amber-400 text-black border-amber-400 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.seasonalEvent} [TIER {playerState.seasonTier}]
          </button>
        </div>

        {/* Tab 1: Achievements List */}
        {tab === 'achievements' && (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {playerState.achievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition ${
                  ach.unlocked
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-[#050811] border-slate-800/80 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      ach.unlocked ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`font-display font-bold text-sm ${ach.unlocked ? 'text-amber-300' : 'text-slate-300'}`}>
                      {ach.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-400">{ach.description}</p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  {ach.unlocked ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>UNLOCKED</span>
                    </span>
                  ) : (
                    <div>
                      <span className="text-slate-400">
                        {ach.progress} / {ach.maxProgress}
                      </span>
                      <div className="w-20 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${Math.min(100, (ach.progress / ach.maxProgress) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Daily Challenge */}
        {tab === 'daily' && (
          <div className="flex-1 flex flex-col justify-center p-6 rounded-lg bg-[#050811] border border-cyan-500/20 text-center font-mono">
            <div className="inline-flex p-3 mx-auto rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 mb-3">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-display font-bold text-cyan-300 mb-1">
              {playerState.dailyChallenge.title}
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              {playerState.dailyChallenge.requirement}
            </p>

            <div className="max-w-md mx-auto w-full p-4 rounded bg-[#090e1d] border border-slate-800 mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">PROGRESS:</span>
                <span className="font-bold text-cyan-400">
                  {playerState.dailyChallenge.currentCount} / {playerState.dailyChallenge.targetCount}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (playerState.dailyChallenge.currentCount / playerState.dailyChallenge.targetCount) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="text-xs text-amber-400 font-bold">
              REWARD: +{playerState.dailyChallenge.rewardExp} SEASON EXP
            </div>
          </div>
        )}

        {/* Tab 3: Season 1 Progression */}
        {tab === 'season' && (
          <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-1">
            <div className="p-4 rounded-lg bg-[#050811] border border-fuchsia-500/30 flex items-center justify-between">
              <div>
                <span className="text-fuchsia-400 font-bold text-base font-display">
                  SEASON 1 BATTLE MATRIX
                </span>
                <p className="text-slate-400 text-xs">Unlock cyberpunk skins and exclusive neural badges</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-display font-bold text-white">
                  TIER {playerState.seasonTier}
                </span>
                <div className="text-[11px] text-fuchsia-300">
                  {playerState.seasonExp} TOTAL EXP
                </div>
              </div>
            </div>

            {/* Tier list */}
            {[1, 2, 3, 4, 5, 6].map((tier) => {
              const reached = playerState.seasonTier >= tier;
              return (
                <div
                  key={tier}
                  className={`p-3 rounded-lg border flex items-center justify-between ${
                    reached ? 'bg-fuchsia-950/20 border-fuchsia-500/40 text-fuchsia-300' : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-sm">TIER {tier}</span>
                    <span>
                      {tier === 1 && 'Neon Cyan Axon Skin'}
                      {tier === 2 && 'Hyper-Threading DDA Audio Pack'}
                      {tier === 3 && 'Quantum Singularity Avatar'}
                      {tier === 4 && 'Violet Plasma Core'}
                      {tier === 5 && 'Overclocked Matrix Frame'}
                      {tier === 6 && 'Neural Overlord Title & Golden Badge'}
                    </span>
                  </div>
                  <span className="font-bold">
                    {reached ? 'CLAIMED' : `${tier * 1000} EXP`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
