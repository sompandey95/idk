import React from 'react';
import { Play, RotateCcw, Home } from 'lucide-react';
import { translations, SupportedLanguage } from '../services/i18n.ts';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  lang: SupportedLanguage;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onMainMenu,
  lang,
}) => {
  const t = translations[lang] || translations.en;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-sm rounded-xl bg-[#090e1d] border border-cyan-500/40 p-6 text-center shadow-[0_0_30px_rgba(0,240,255,0.2)]">
        <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-wider text-cyan-300 neon-glow-cyan mb-2">
          {t.pause}
        </h2>
        <p className="text-xs font-mono text-slate-400 mb-6">
          SYNAPSE SIMULATION SUSPENDED
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onResume}
            className="w-full py-3 rounded-lg font-display font-bold text-sm bg-cyan-400 hover:bg-cyan-300 text-black flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>{t.resume}</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-3 rounded-lg font-display font-semibold text-sm bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            <span>{t.restart}</span>
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
