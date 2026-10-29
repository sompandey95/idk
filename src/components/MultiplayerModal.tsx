import React, { useState, useEffect } from 'react';
import { X, Users, Swords, Copy, Check, Play, ShieldAlert, Cpu } from 'lucide-react';
import { translations, SupportedLanguage } from '../services/i18n.ts';
import { PlayerState } from '../services/storage.ts';
import {
  hostMultiplayerMatch,
  joinMultiplayerMatch,
  listenToMatch,
  MultiplayerMatchData
} from '../services/firebase.ts';

interface MultiplayerModalProps {
  onClose: () => void;
  playerState: PlayerState;
  onStartDuel: (mode: 'online' | 'ghost', matchData?: MultiplayerMatchData) => void;
  lang: SupportedLanguage;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  onClose,
  playerState,
  onStartDuel,
  lang,
}) => {
  const t = translations[lang] || translations.en;
  const [activeTab, setActiveTab] = useState<'matchmaking' | 'host' | 'join'>('matchmaking');
  const [createdRoomCode, setCreatedRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isHosting, setIsHosting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [matchStatus, setMatchStatus] = useState<string>('');

  const handleHostRoom = async () => {
    const code = `DUEL-${Math.floor(1000 + Math.random() * 9000)}`;
    setCreatedRoomCode(code);
    setIsHosting(true);
    setMatchStatus(t.waitingForGuest);

    const matchPayload: MultiplayerMatchData = {
      matchId: code,
      hostId: playerState.playerId,
      hostName: playerState.displayName,
      hostScore: 0,
      guestScore: 0,
      status: 'waiting',
      seed: Date.now(),
      createdAt: new Date().toISOString()
    };

    await hostMultiplayerMatch(matchPayload);

    // Listen for guest join
    listenToMatch(code, (updated) => {
      if (updated && updated.status === 'active' && updated.guestName) {
        setMatchStatus(`Opponent ${updated.guestName} joined! Commencing duel...`);
        setTimeout(() => {
          onStartDuel('online', updated);
        }, 1200);
      }
    });
  };

  const handleJoinRoom = async () => {
    if (!joinCodeInput.trim()) return;
    const code = joinCodeInput.trim().toUpperCase();
    setMatchStatus('Establishing neural link to host...');
    const success = await joinMultiplayerMatch(code, playerState.playerId, playerState.displayName);
    if (success) {
      setMatchStatus('Joined successfully! Preparing neural arena...');
      setTimeout(() => {
        onStartDuel('online', {
          matchId: code,
          hostId: 'HOST',
          hostName: 'HOST',
          guestId: playerState.playerId,
          guestName: playerState.displayName,
          hostScore: 0,
          guestScore: 0,
          status: 'active',
          seed: 12345,
          createdAt: new Date().toISOString()
        });
      }, 1000);
    } else {
      setMatchStatus('Error: Match room not found or already full.');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(createdRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 select-none overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-[#090e1d] border border-fuchsia-500/40 p-4 sm:p-6 text-white shadow-[0_0_35px_rgba(217,70,239,0.25)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-fuchsia-500/20 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-fuchsia-950/80 border border-fuchsia-500/40 text-fuchsia-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-fuchsia-300">
                {t.multiplayer}
              </h2>
              <span className="text-[11px] font-mono text-fuchsia-400/80">
                COMPETITIVE 60S SYNAPTIC CLASH
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-fuchsia-500/50 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs font-mono">
          <button
            onClick={() => setActiveTab('matchmaking')}
            className={`py-2 px-1 rounded-lg border font-semibold text-center transition ${
              activeTab === 'matchmaking'
                ? 'bg-fuchsia-600 text-white border-fuchsia-500 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            AI GHOST DUEL
          </button>

          <button
            onClick={() => setActiveTab('host')}
            className={`py-2 px-1 rounded-lg border font-semibold text-center transition ${
              activeTab === 'host'
                ? 'bg-fuchsia-600 text-white border-fuchsia-500 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {t.hostMatch}
          </button>

          <button
            onClick={() => setActiveTab('join')}
            className={`py-2 px-1 rounded-lg border font-semibold text-center transition ${
              activeTab === 'join'
                ? 'bg-fuchsia-600 text-white border-fuchsia-500 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {t.joinMatch}
          </button>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 overflow-y-auto pr-1 text-xs font-mono">
          {activeTab === 'matchmaking' && (
            <div className="p-4 rounded-lg bg-[#050811] border border-fuchsia-500/30 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-fuchsia-950/80 border border-fuchsia-500/40 text-fuchsia-400 flex items-center justify-center mx-auto">
                <Cpu className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-fuchsia-300">
                  INSTANT RANKED NEURAL GHOST
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Duel against a neural ghost trained on player data calibrated to your current MMR ({playerState.ddaRating}). Combos launch adversarial noise attacks to disrupt the opponent!
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900 border border-slate-800 flex items-center justify-around font-mono text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">YOUR CALLSIGN</span>
                  <span className="text-cyan-300 font-bold">{playerState.displayName}</span>
                </div>
                <span className="text-fuchsia-400 font-bold text-lg font-display">VS</span>
                <div>
                  <span className="text-slate-400 block text-[10px]">CHALLENGER GHOST</span>
                  <span className="text-red-400 font-bold">SYNAPSE_AI_{playerState.region}</span>
                </div>
              </div>

              <button
                onClick={() => onStartDuel('ghost')}
                className="w-full py-3 rounded-lg font-display font-bold text-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-black flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(217,70,239,0.4)]"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>COMMENCE RANKED GHOST DUEL</span>
              </button>
            </div>
          )}

          {activeTab === 'host' && (
            <div className="p-4 rounded-lg bg-[#050811] border border-fuchsia-500/30 text-center space-y-4">
              {!isHosting ? (
                <>
                  <p className="text-slate-300">
                    Host a private match and share the unique room code with a friend on mobile or desktop.
                  </p>
                  <button
                    onClick={handleHostRoom}
                    className="w-full py-3 rounded-lg font-display font-bold text-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-black transition cursor-pointer"
                  >
                    GENERATE DUEL ROOM
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <span className="text-xs text-slate-400 block">SHARE THIS ROOM CODE:</span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-display font-extrabold text-cyan-300 tracking-wider p-2 rounded bg-slate-900 border border-cyan-500/40">
                      {createdRoomCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-2.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 text-cyan-400 transition"
                    >
                      {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-amber-300 text-xs animate-pulse font-bold">
                    {matchStatus}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'join' && (
            <div className="p-4 rounded-lg bg-[#050811] border border-fuchsia-500/30 space-y-4">
              <div>
                <label className="block text-slate-400 text-[10px] mb-1">
                  ENTER ROOM CODE (e.g. DUEL-1042)
                </label>
                <input
                  type="text"
                  placeholder="DUEL-XXXX"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold uppercase tracking-wider outline-none"
                />
              </div>

              {matchStatus && (
                <div className="text-xs font-mono text-cyan-400 text-center font-bold">
                  {matchStatus}
                </div>
              )}

              <button
                onClick={handleJoinRoom}
                className="w-full py-3 rounded-lg font-display font-bold text-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-black transition cursor-pointer"
              >
                CONNECT TO DUEL
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
