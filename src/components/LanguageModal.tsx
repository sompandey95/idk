import React from 'react';
import { X, Globe, Check } from 'lucide-react';
import { SupportedLanguage, getLanguageName } from '../services/i18n.ts';

interface LanguageModalProps {
  onClose: () => void;
  currentLang: SupportedLanguage;
  onSelectLang: (lang: SupportedLanguage) => void;
}

const LANGUAGES: { code: SupportedLanguage; label: string; region: string }[] = [
  { code: 'en', label: 'English', region: 'North America / Global' },
  { code: 'es', label: 'Español', region: 'Europe / Latin America' },
  { code: 'de', label: 'Deutsch', region: 'Europe' },
  { code: 'fr', label: 'Français', region: 'Europe / North America' },
  { code: 'ja', label: '日本語', region: 'Asia (Japan)' },
  { code: 'zh', label: '简体中文', region: 'Asia (China)' },
  { code: 'ko', label: '한국어', region: 'Asia (Korea)' },
];

export const LanguageModal: React.FC<LanguageModalProps> = ({
  onClose,
  currentLang,
  onSelectLang,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md rounded-xl bg-[#090e1d] border border-cyan-500/40 p-6 text-white shadow-[0_0_35px_rgba(0,240,255,0.2)]">
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-display font-bold text-cyan-300">
              Select Language / Region
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  onSelectLang(lang.code);
                  onClose();
                }}
                className={`w-full p-3 rounded-lg border flex items-center justify-between text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-[#050811] border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div>
                  <span className="font-display font-semibold text-sm block">
                    {lang.label}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {lang.region}
                  </span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
