import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  NeuralNode,
  Synapse,
  DataPacket,
  DDAState,
  createInitialTopology,
  generatePacket,
  updateDDA,
  computeScoreIncrement,
  calculateLoss
} from './game/neuralEngine.ts';
import {
  loadLocalPlayerState,
  saveLocalPlayerState,
  recordRunStats,
  flushOfflineQueue,
  PlayerState,
  Achievement
} from './services/storage.ts';
import { sound } from './services/sound.ts';
import { translations, SupportedLanguage } from './services/i18n.ts';
import { testConnection, updateMatchScore, MultiplayerMatchData } from './services/firebase.ts';

// Components
import { TitleScreen } from './components/TitleScreen.tsx';
import { HUD } from './components/HUD.tsx';
import { NeuralCanvas } from './components/NeuralCanvas.tsx';
import { PauseModal } from './components/PauseModal.tsx';
import { GameOverModal } from './components/GameOverModal.tsx';
import { LeaderboardModal } from './components/LeaderboardModal.tsx';
import { AchievementsModal } from './components/AchievementsModal.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { MultiplayerModal } from './components/MultiplayerModal.tsx';
import { LanguageModal } from './components/LanguageModal.tsx';

type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('title');
  const [playerState, setPlayerState] = useState<PlayerState>(loadLocalPlayerState);
  const [lang, setLang] = useState<SupportedLanguage>('en');

  // Modals state
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);

  // Sound and Haptics state
  const [soundEnabled, setSoundEnabled] = useState(sound.isSoundEnabled());
  const [hapticsEnabled, setHapticsEnabled] = useState(sound.isHapticsEnabled());

  // In-Game State
  const [score, setScore] = useState(0);
  const [epoch, setEpoch] = useState(1);
  const [combo, setCombo] = useState(0);
  const [coreIntegrity, setCoreIntegrity] = useState(100);
  const [loss, setLoss] = useState(0.12);
  const [overdriveReady, setOverdriveReady] = useState(false);

  // Neural Graph Entities
  const [nodes, setNodes] = useState<NeuralNode[]>([]);
  const [synapses, setSynapses] = useState<Synapse[]>([]);
  const [packets, setPackets] = useState<DataPacket[]>([]);
  const [selectedNode, setSelectedNode] = useState<NeuralNode | null>(null);

  // DDA State
  const [dda, setDDA] = useState<DDAState>({
    level: 1.0,
    packetSpeedMultiplier: 1.0,
    spawnIntervalMs: 2500,
    adversarialProbability: 0.1,
    accuracyRate: 100,
    recentLatencies: [],
    avgLatencyMs: 600,
    streak: 0,
    totalPackets: 0,
    correctPackets: 0,
    statusMessage: 'INITIALIZED',
  });

  // End of run stats snapshot
  const [lastRunSnapshot, setLastRunSnapshot] = useState({
    score: 0,
    epoch: 1,
    accuracy: 100,
    ddaPeak: 1.0,
  });
  const [newAchievementsUnlocked, setNewAchievementsUnlocked] = useState<Achievement[]>([]);

  // Competitive Duel State
  const [duelMode, setDuelMode] = useState<'none' | 'ghost' | 'online'>('none');
  const [duelTimeLeft, setDuelTimeLeft] = useState(60);
  const [opponentScore, setOpponentScore] = useState(0);
  const [activeMatchData, setActiveMatchData] = useState<MultiplayerMatchData | null>(null);

  // Timers and counters
  const packetIdCounter = useRef(0);
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const duelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPacketTimeRef = useRef<number>(Date.now());
  const epochPacketsCleared = useRef(0);
  const sessionPacketsCount = useRef(0);
  const sessionAnomaliesQuarantined = useRef(0);
  const maxSessionStreak = useRef(0);
  const peakDDA = useRef(1.0);

  // Sync state to body dataset per game shell standard
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Test Firebase on boot & check autostart
  useEffect(() => {
    testConnection();
    flushOfflineQueue();

    // Check query param for autostart
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1') {
      startNewGame();
    }
  }, []);

  // Initialize or Reset Neural Graph Topology
  const initGameTopology = () => {
    const { nodes: initialNodes, synapses: initialSynapses } = createInitialTopology();
    setNodes(initialNodes);
    setSynapses(initialSynapses);
    setPackets([]);
    epochPacketsCleared.current = 0;
    sessionPacketsCount.current = 0;
    sessionAnomaliesQuarantined.current = 0;
    maxSessionStreak.current = 0;
    peakDDA.current = 1.0;
  };

  // Start New Game
  const startNewGame = useCallback(() => {
    initGameTopology();
    setScore(0);
    setEpoch(1);
    setCombo(0);
    setCoreIntegrity(100);
    setLoss(0.12);
    setOverdriveReady(false);
    setDDA({
      level: 1.0,
      packetSpeedMultiplier: 1.0,
      spawnIntervalMs: 2500,
      adversarialProbability: 0.1,
      accuracyRate: 100,
      recentLatencies: [600],
      avgLatencyMs: 600,
      streak: 0,
      totalPackets: 0,
      correctPackets: 0,
      statusMessage: 'FLOW BALANCED',
    });
    setGameState('playing');
    sound.playTap();
  }, []);

  // Handle Game Over
  const handleGameOver = useCallback(() => {
    sound.playError();
    const finalAccuracy = dda.accuracyRate;
    setLastRunSnapshot({
      score,
      epoch,
      accuracy: finalAccuracy,
      ddaPeak: peakDDA.current,
    });

    // Record stats and check achievements
    const { state: updatedState, newUnlocks } = recordRunStats(
      score,
      epoch,
      finalAccuracy,
      sessionPacketsCount.current,
      sessionAnomaliesQuarantined.current,
      maxSessionStreak.current,
      peakDDA.current
    );

    setPlayerState(updatedState);
    setNewAchievementsUnlocked(newUnlocks);
    setGameState('gameover');

    if (activeMatchData) {
      updateMatchScore(activeMatchData.matchId, true, score, true);
    }
  }, [score, epoch, dda.accuracyRate, activeMatchData]);

  // Dynamic Packet Spawner
  useEffect(() => {
    if (gameState !== 'playing') {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      return;
    }

    const spawn = () => {
      packetIdCounter.current += 1;
      const newPacket = generatePacket(`pkt_${packetIdCounter.current}`, dda);

      // Find available synapse starting from the packet's startNodeId
      const candidateSynapses = synapses.filter(s => s.fromNodeId === newPacket.fromNodeId);
      if (candidateSynapses.length > 0) {
        // Pick one synapse randomly or weighted
        const chosen = candidateSynapses[Math.floor(Math.random() * candidateSynapses.length)];
        newPacket.currentSynapseId = chosen.id;
        newPacket.toNodeId = chosen.toNodeId;
        setPackets(prev => [...prev.slice(-15), newPacket]);
        lastPacketTimeRef.current = Date.now();
      }
    };

    // First spawn immediately
    spawn();

    spawnTimerRef.current = setInterval(spawn, dda.spawnIntervalMs);

    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    };
  }, [gameState, dda.spawnIntervalMs, dda.packetSpeedMultiplier, synapses]);

  // Competitive Duel Ghost Loop
  useEffect(() => {
    if (gameState !== 'playing' || duelMode === 'none') {
      if (duelTimerRef.current) clearInterval(duelTimerRef.current);
      return;
    }

    setDuelTimeLeft(60);
    setOpponentScore(0);

    duelTimerRef.current = setInterval(() => {
      setDuelTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(duelTimerRef.current!);
          handleGameOver();
          return 0;
        }
        return prev - 1;
      });

      // Ghost AI incrementally scores points scaled with player MMR
      const ghostStep = Math.round(150 + Math.random() * 220);
      setOpponentScore(prev => prev + ghostStep);
    }, 1000);

    return () => {
      if (duelTimerRef.current) clearInterval(duelTimerRef.current);
    };
  }, [gameState, duelMode, handleGameOver]);

  // Packet Arrival Handler (Classification & Quarantine evaluation)
  const handlePacketArrived = useCallback(
    (packet: DataPacket, arrivedNode: NeuralNode) => {
      // Remove arrived packet from transit
      setPackets(prev => prev.filter(p => p.id !== packet.id));

      // If arrived at Hidden Node: forward onto next layer synapse if available
      if (arrivedNode.layer === 'hidden') {
        sound.playActivation(nodes.findIndex(n => n.id === arrivedNode.id));
        const nextSynapses = synapses.filter(s => s.fromNodeId === arrivedNode.id);
        if (nextSynapses.length > 0) {
          const nextChosen = nextSynapses[Math.floor(Math.random() * nextSynapses.length)];
          const forwarded: DataPacket = {
            ...packet,
            id: `${packet.id}_fwd`,
            progress: 0,
            currentSynapseId: nextChosen.id,
            fromNodeId: arrivedNode.id,
            toNodeId: nextChosen.toNodeId,
          };
          setPackets(prev => [...prev, forwarded]);
        }
        return;
      }

      // If arrived at Output Node:
      if (arrivedNode.layer === 'output') {
        const latency = Date.now() - lastPacketTimeRef.current;
        sessionPacketsCount.current += 1;

        if (arrivedNode.isQuarantine) {
          // Quarantine node evaluation
          if (packet.isAdversarial) {
            // Success! Adversarial payload neutralized
            sessionAnomaliesQuarantined.current += 1;
            sound.playQuarantine();
            const points = computeScoreIncrement(300, combo, dda.level, dda.accuracyRate);
            setScore(s => s + points);
            setCoreIntegrity(hp => Math.min(100, hp + 6));
            const newStreak = combo + 1;
            setCombo(newStreak);
            if (newStreak > maxSessionStreak.current) maxSessionStreak.current = newStreak;
            if (newStreak >= 4) setOverdriveReady(true);

            // Update DDA
            setDDA(d => {
              const updated = updateDDA(d, { correct: true, latencyMs: latency, isAdversarialHit: true });
              if (updated.level > peakDDA.current) peakDDA.current = updated.level;
              return updated;
            });
          } else {
            // Misrouted clean packet to quarantine
            sound.playError();
            setCombo(0);
            setCoreIntegrity(hp => Math.max(0, hp - 5));
            setDDA(d => updateDDA(d, { correct: false, latencyMs: latency, isAdversarialHit: false }));
          }
        } else {
          // Regular output classification node (out_0 -> Alpha, out_1 -> Beta, out_2 -> Gamma)
          const targetIndex = packet.targetClass;
          const arrivedIndex = arrivedNode.id === 'out_0' ? 0 : arrivedNode.id === 'out_1' ? 1 : 2;

          if (packet.isAdversarial) {
            // Adversarial attack breached output layer!
            sound.playError();
            setCombo(0);
            setLoss(l => Number((l + 0.08).toFixed(3)));
            const newHp = Math.max(0, coreIntegrity - 14);
            setCoreIntegrity(newHp);
            setDDA(d => updateDDA(d, { correct: false, latencyMs: latency, isAdversarialHit: true }));

            if (newHp <= 0) {
              handleGameOver();
              return;
            }
          } else if (arrivedIndex === targetIndex) {
            // Correct classification!
            sound.playSuccess(combo);
            const points = computeScoreIncrement(150, combo, dda.level, dda.accuracyRate);
            setScore(s => s + points);
            setCoreIntegrity(hp => Math.min(100, hp + 2));
            setLoss(l => Number(Math.max(0.01, l - 0.02).toFixed(3)));

            const newStreak = combo + 1;
            setCombo(newStreak);
            if (newStreak > maxSessionStreak.current) maxSessionStreak.current = newStreak;
            if (newStreak >= 4) setOverdriveReady(true);

            // Update DDA
            setDDA(d => {
              const updated = updateDDA(d, { correct: true, latencyMs: latency, isAdversarialHit: false });
              if (updated.level > peakDDA.current) peakDDA.current = updated.level;
              return updated;
            });

            // Epoch Progress
            epochPacketsCleared.current += 1;
            if (epochPacketsCleared.current >= 15) {
              epochPacketsCleared.current = 0;
              setEpoch(ep => ep + 1);
              sound.playEpochAdvance();
              setCoreIntegrity(hp => Math.min(100, hp + 20));
              confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#00f0ff', '#ff007f', '#00ff9d'],
              });
            }
          } else {
            // Classification mismatch
            sound.playError();
            setCombo(0);
            setLoss(l => Number((l + 0.04).toFixed(3)));
            const newHp = Math.max(0, coreIntegrity - 8);
            setCoreIntegrity(newHp);
            setDDA(d => updateDDA(d, { correct: false, latencyMs: latency, isAdversarialHit: false }));

            if (newHp <= 0) {
              handleGameOver();
              return;
            }
          }
        }
      }
    },
    [combo, coreIntegrity, dda, handleGameOver, nodes, synapses]
  );

  // Tactile Synapse Weight Adjustment
  const handleWeightAdjusted = (synapseId: string, nextWeight: number) => {
    setSynapses(prev =>
      prev.map(s => (s.id === synapseId ? { ...s, weight: nextWeight } : s))
    );
  };

  // Tactile Axon Creation
  const handleSynapseCreated = (fromId: string, toId: string) => {
    const existing = synapses.find(s => s.fromNodeId === fromId && s.toNodeId === toId);
    if (!existing) {
      const newSyn: Synapse = {
        id: `syn_${fromId}_${toId}_${Date.now()}`,
        fromNodeId: fromId,
        toNodeId: toId,
        weight: 1.0,
        activeCharge: 0,
      };
      setSynapses(prev => [...prev, newSyn]);
    }
  };

  // Tactical Controls
  const handlePruneSynapses = () => {
    sound.playTap();
    sound.triggerHaptic('medium');
    setSynapses(prev => prev.filter(s => Math.abs(s.weight) >= 0.4));
  };

  const handleInvertGradients = () => {
    sound.playTap();
    sound.triggerHaptic('medium');
    setSynapses(prev => prev.map(s => ({ ...s, weight: Number((-s.weight).toFixed(1)) })));
  };

  const handleTriggerOverdrive = () => {
    if (!overdriveReady) return;
    sound.playEpochAdvance();
    sound.triggerHaptic('combo');
    setOverdriveReady(false);
    // Purge all adversarial packets on screen
    setPackets(prev => prev.filter(p => !p.isAdversarial));
    // Boost points
    setScore(s => s + 500);
    setCoreIntegrity(100);
    confetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#a855f7', '#ff007f', '#00f0ff'],
    });
  };

  // Start Duel Mode
  const handleStartDuel = (mode: 'online' | 'ghost', matchData?: MultiplayerMatchData) => {
    setDuelMode(mode);
    if (matchData) setActiveMatchData(matchData);
    setShowMultiplayer(false);
    startNewGame();
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        if (gameState === 'title' || gameState === 'gameover') {
          e.preventDefault();
          startNewGame();
        }
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
      } else if (e.code === 'KeyM') {
        const next = sound.toggleSound();
        setSoundEnabled(next);
      } else if (e.code === 'KeyF') {
        handleTriggerOverdrive();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startNewGame, overdriveReady]);

  return (
    <main className="relative w-screen h-screen bg-[#050811] text-slate-100 flex flex-col overflow-hidden cyber-grid">
      {/* Title Screen View */}
      {gameState === 'title' && (
        <TitleScreen
          onStart={startNewGame}
          playerState={playerState}
          lang={lang}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onOpenAchievements={() => setShowAchievements(true)}
          onOpenProfile={() => setShowProfile(true)}
          onOpenMultiplayer={() => setShowMultiplayer(true)}
          onOpenLanguage={() => setShowLanguage(true)}
        />
      )}

      {/* Active Game Layout */}
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameover') && (
        <>
          <HUD
            score={score}
            epoch={epoch}
            combo={combo}
            coreIntegrity={coreIntegrity}
            dda={dda}
            loss={loss}
            soundEnabled={soundEnabled}
            hapticsEnabled={hapticsEnabled}
            lang={lang}
            onToggleSound={() => setSoundEnabled(sound.toggleSound())}
            onToggleHaptics={() => setHapticsEnabled(sound.toggleHaptics())}
            onOpenLanguage={() => setShowLanguage(true)}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
            onOpenAchievements={() => setShowAchievements(true)}
            onOpenProfile={() => setShowProfile(true)}
            onOpenMultiplayer={() => setShowMultiplayer(true)}
            onPause={() => setGameState('paused')}
            onPruneSynapses={handlePruneSynapses}
            onInvertGradients={handleInvertGradients}
            onTriggerOverdrive={handleTriggerOverdrive}
            overdriveReady={overdriveReady}
          />

          {/* Duel Header if in Multiplayer Match */}
          {duelMode !== 'none' && (
            <div className="w-full bg-[#180a2b] border-b border-fuchsia-500/30 px-4 py-1.5 flex items-center justify-between text-xs font-mono text-fuchsia-300 z-20">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-300">{playerState.displayName}: {score.toLocaleString()}</span>
                <span>VS</span>
                <span className="font-bold text-red-400">OPPONENT: {opponentScore.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>TIME REMAINING:</span>
                <span className="text-base font-display font-bold text-amber-400 tabular-nums">
                  {duelTimeLeft}s
                </span>
              </div>
            </div>
          )}

          {/* Main 60fps Interactive Neural Viewport */}
          <div className="flex-1 relative w-full h-full overflow-hidden">
            <NeuralCanvas
              nodes={nodes}
              synapses={synapses}
              packets={packets}
              dda={dda}
              onPacketArrived={handlePacketArrived}
              onWeightAdjusted={handleWeightAdjusted}
              onSynapseCreated={handleSynapseCreated}
              onNodeSelected={setSelectedNode}
              isPaused={gameState !== 'playing'}
            />

            {/* Critical Low Integrity screen pulse overlay */}
            {coreIntegrity <= 25 && (
              <div className="absolute inset-0 border-4 border-red-500/60 pointer-events-none animate-pulse" />
            )}
          </div>
        </>
      )}

      {/* Status Modals */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={() => setGameState('playing')}
          onRestart={startNewGame}
          onMainMenu={() => setGameState('title')}
          lang={lang}
        />
      )}

      {gameState === 'gameover' && (
        <GameOverModal
          score={lastRunSnapshot.score}
          bestScore={playerState.highScore}
          epoch={lastRunSnapshot.epoch}
          accuracy={lastRunSnapshot.accuracy}
          ddaPeak={lastRunSnapshot.ddaPeak}
          newUnlocks={newAchievementsUnlocked}
          onRestart={startNewGame}
          onLeaderboard={() => setShowLeaderboard(true)}
          onMainMenu={() => setGameState('title')}
          lang={lang}
        />
      )}

      {/* Feature Modals */}
      {showLeaderboard && (
        <LeaderboardModal
          onClose={() => setShowLeaderboard(false)}
          playerState={playerState}
          lang={lang}
        />
      )}

      {showAchievements && (
        <AchievementsModal
          onClose={() => setShowAchievements(false)}
          playerState={playerState}
          lang={lang}
        />
      )}

      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          playerState={playerState}
          onUpdateState={setPlayerState}
          lang={lang}
        />
      )}

      {showMultiplayer && (
        <MultiplayerModal
          onClose={() => setShowMultiplayer(false)}
          playerState={playerState}
          onStartDuel={handleStartDuel}
          lang={lang}
        />
      )}

      {showLanguage && (
        <LanguageModal
          onClose={() => setShowLanguage(false)}
          currentLang={lang}
          onSelectLang={setLang}
        />
      )}
    </main>
  );
}
