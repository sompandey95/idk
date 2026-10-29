import React, { useEffect, useState } from 'react';
import { X, Trophy, Globe, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import {
  subscribeToLeaderboard,
  LeaderboardEntry
} from '../services/firebase.ts';
import { translations, SupportedLanguage } from '../services/i18n.ts';
import { PlayerState, flushOfflineQueue } from '../services/storage.ts';

interface LeaderboardModalProps {
  onClose: () => void;
  playerState: PlayerState;
  lang: SupportedLanguage;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  onClose,
  playerState,
  lang,
}) => {
  const t = translations[lang] || translations.en;
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [regionFilter, setRegionFilter] = useState<'GLOBAL' | 'NA' | 'EU' | 'ASIA'>('GLOBAL');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to Firebase real-time leaderboard
    const unsubscribe = subscribeToLeaderboard('SEASON_1', regionFilter, (data) => {
      setEntries(data);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [regionFilter]);

  const handleManualSync = async () => {
    setSyncing(true);
    await flushOfflineQueue();
    setTimeout(() => setSyncing(false), 800);
  };

  // Generate fallback demo/mock entries if cloud is fresh or offline so the table is never bare
  const displayEntries = entries.length > 0 ? entries : [
    { playerId: playerState.playerId, displayName: playerState.displayName, score: playerState.highScore, epoch: playerState.highestEpoch, accuracy: 88, region: playerState.region, season: 'SEASON_1', timestamp: new Date().toISOString() },
    { playerId: 'OP_NEXUS', displayName: 'CYBER_VIPER', score: 14850, epoch: 8, accuracy: 94, region: 'NA', season: 'SEASON_1', timestamp: new Date().toISOString() },
    { playerId: 'OP_TOKYO', displayName: 'NEURAL_KAMI', score: 13200, epoch: 7, accuracy: 91, region: 'ASIA', season: 'SEASON_1', timestamp: new Date().toISOString() },
    { playerId: 'OP_BERLIN', displayName: 'SYNAPSE_ZERO', score: 11950, epoch: 6, accuracy: 89, region: 'EU', season: 'SEASON_1', timestamp: new Date().toISOString() },
    { playerId: 'OP_PARIS', displayName: 'TENSOR_CHIEF', score: 9800, epoch: 5, accuracy: 86, region: 'EU', season: 'SEASON_1', timestamp: new Date().toISOString() },
  ].filter(e => regionFilter === 'GLOBAL' || e.region === regionFilter).sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 select-none overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-[#090e1d] border border-cyan-500/40 p-4 sm:p-6 text-white shadow-[0_0_35px_rgba(0,240,255,0.25)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-cyan-300">
                {t.leaderboard}
              </h2>
              <span className="text-[11px] font-mono text-cyan-400/80">
                SEASON 1: DEEP SYNAPTIC AWAKENING
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSync}
              title="Sync cached scores"
              className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 transition"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Region Tabs & Connection Status */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4 text-xs font-mono">
          <div className="flex items-center gap-1 bg-[#050811] p-1 rounded-lg border border-slate-800">
            {(['GLOBAL', 'NA', 'EU', 'ASIA'] as const).map((reg) => (
              <button
                key={reg}
                onClick={() => setRegionFilter(reg)}
                className={`px-3 py-1 rounded font-semibold transition ${
                  regionFilter === reg
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {reg}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3.5 h-3.5" />
                <span>CLOUD REALTIME ACTIVE</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span>OFFLINE (CACHED)</span>
              </span>
            )}
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="flex-1 overflow-y-auto pr-1">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] tracking-wider">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">{t.callsign}</th>
                <th className="py-2 px-2">{t.region}</th>
                <th className="py-2 px-2 text-right">{t.epoch}</th>
                <th className="py-2 px-2 text-right">{t.accuracy}</th>
                <th className="py-2 px-2 text-right">{t.score}</th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((item, idx) => {
                const isCurrentPlayer = item.playerId === playerState.playerId;
                const rankNum = idx + 1;
                return (
                  <tr
                    key={item.playerId + idx}
                    className={`border-b border-slate-800/60 transition ${
                      isCurrentPlayer
                        ? 'bg-cyan-950/40 text-cyan-300 font-bold'
                        : 'hover:bg-slate-900/40 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-2 font-display text-sm">
                      {rankNum === 1 ? (
                        <span className="text-amber-400 font-bold">🥇 1</span>
                      ) : rankNum === 2 ? (
                        <span className="text-slate-300 font-bold">🥈 2</span>
                      ) : rankNum === 3 ? (
                        <span className="text-amber-600 font-bold">🥉 3</span>
                      ) : (
                        rankNum
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{item.displayName}</span>
                        {isCurrentPlayer && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-slate-400">{item.region}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{item.epoch}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-emerald-400">
                      {item.accuracy}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-display text-sm font-bold tabular-nums text-white">
                      {item.score.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Synced with Firebase Firestore Enterprise</span>
          <span>Pending local queue: {playerState.pendingSyncQueue.length}</span>
        </div>
      </div>
    </div>
  );
};
