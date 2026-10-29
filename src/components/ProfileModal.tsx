import React, { useState } from 'react';
import { X, User, Copy, Check, Download, Upload, Shield, CloudCheck, RefreshCw } from 'lucide-react';
import { translations, SupportedLanguage } from '../services/i18n.ts';
import {
  PlayerState,
  saveLocalPlayerState,
  exportSyncToken,
  importSyncToken
} from '../services/storage.ts';
import { syncPlayerProfileToCloud } from '../services/firebase.ts';

interface ProfileModalProps {
  onClose: () => void;
  playerState: PlayerState;
  onUpdateState: (newState: PlayerState) => void;
  lang: SupportedLanguage;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  onClose,
  playerState,
  onUpdateState,
  lang,
}) => {
  const t = translations[lang] || translations.en;
  const [callsign, setCallsign] = useState(playerState.displayName);
  const [region, setRegion] = useState(playerState.region);
  const [syncKeyInput, setSyncKeyInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    const updated = {
      ...playerState,
      displayName: callsign.trim().slice(0, 24) || playerState.displayName,
      region,
    };
    saveLocalPlayerState(updated);
    onUpdateState(updated);

    // Sync to cloud
    await syncPlayerProfileToCloud({
      playerId: updated.playerId,
      displayName: updated.displayName,
      avatar: updated.avatar,
      region: updated.region,
      highScore: updated.highScore,
      totalGames: updated.totalGames,
      ddaRating: updated.ddaRating,
      achievements: JSON.stringify(updated.achievements.filter(a => a.unlocked).map(a => a.id)),
      updatedAt: new Date().toISOString(),
    });

    setIsSaving(false);
    setSyncStatusMsg(t.syncSuccess);
    setTimeout(() => setSyncStatusMsg(''), 2500);
  };

  const handleExportKey = () => {
    const key = exportSyncToken();
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportKey = () => {
    if (!syncKeyInput.trim()) return;
    const success = importSyncToken(syncKeyInput);
    if (success) {
      setSyncStatusMsg('Profile imported successfully from cross-platform device!');
      // Reload updated state
      const updated = {
        ...playerState,
        ...JSON.parse(localStorage.getItem('synapse_player_state_v1') || '{}')
      };
      onUpdateState(updated);
      setCallsign(updated.displayName);
      setRegion(updated.region);
    } else {
      setSyncStatusMsg('Error: Invalid synchronization token.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 select-none overflow-y-auto">
      <div className="w-full max-w-xl rounded-xl bg-[#090e1d] border border-indigo-500/40 p-4 sm:p-6 text-white shadow-[0_0_35px_rgba(99,102,241,0.25)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-indigo-950/80 border border-indigo-500/40 text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-indigo-300">
                {t.playerProfile}
              </h2>
              <span className="text-[11px] font-mono text-indigo-400/80">
                OPERATOR ID: {playerState.playerId}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-indigo-500/50 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs font-mono">
          {/* Identity & Callsign */}
          <div className="p-4 rounded-lg bg-[#050811] border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1 w-full">
                <label className="block text-slate-400 text-[10px] mb-1">
                  OPERATOR CALLSIGN
                </label>
                <input
                  type="text"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  maxLength={20}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="w-full sm:w-auto">
                <label className="block text-slate-400 text-[10px] mb-1">
                  SERVER REGION
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as any)}
                  className="w-full sm:w-auto px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white font-bold outline-none"
                >
                  <option value="NA">North America (NA)</option>
                  <option value="EU">Europe (EU)</option>
                  <option value="ASIA">Asia-Pacific (ASIA)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="w-full py-2 rounded font-display font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              <span>SAVE & SYNC CLOUD PROFILE</span>
            </button>
          </div>

          {/* Career Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
              <span className="block text-[10px] text-slate-400">HIGH SCORE</span>
              <span className="text-xl font-display font-bold text-white tabular-nums">
                {playerState.highScore.toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
              <span className="block text-[10px] text-slate-400">HIGHEST EPOCH</span>
              <span className="text-xl font-display font-bold text-cyan-400 tabular-nums">
                {playerState.highestEpoch}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
              <span className="block text-[10px] text-slate-400">DDA SKILL RATING</span>
              <span className="text-xl font-display font-bold text-amber-400 tabular-nums">
                {playerState.ddaRating} MMR
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
              <span className="block text-[10px] text-slate-400">TOTAL SIMULATIONS</span>
              <span className="text-lg font-display font-bold text-slate-200 tabular-nums">
                {playerState.totalGames}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
              <span className="block text-[10px] text-slate-400">PACKETS CLASSIFIED</span>
              <span className="text-lg font-display font-bold text-emerald-400 tabular-nums">
                {playerState.totalPacketsClassified}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
              <span className="block text-[10px] text-slate-400">ANOMALIES PURGED</span>
              <span className="text-lg font-display font-bold text-red-400 tabular-nums">
                {playerState.totalAnomaliesQuarantined}
              </span>
            </div>
          </div>

          {/* Cross-Platform Device Cloud Sync */}
          <div className="p-4 rounded-lg bg-[#050811] border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-indigo-300 font-bold font-display block">
                  CROSS-PLATFORM DEVICE SYNCHRONIZATION
                </span>
                <p className="text-slate-400 text-[11px]">
                  Seamlessly transfer progress between desktop and mobile devices.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportKey}
                className="flex-1 py-2 px-3 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500 text-indigo-300 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'KEY COPIED TO CLIPBOARD' : t.exportSyncKey}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <label className="block text-slate-400 text-[10px] mb-1">
                {t.importSyncKey}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={t.enterKey}
                  value={syncKeyInput}
                  onChange={(e) => setSyncKeyInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs outline-none"
                />
                <button
                  onClick={handleImportKey}
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition cursor-pointer"
                >
                  IMPORT
                </button>
              </div>
            </div>

            {syncStatusMsg && (
              <div className="p-2 rounded bg-indigo-950/60 border border-indigo-500/40 text-emerald-300 text-[11px] text-center font-bold">
                {syncStatusMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
