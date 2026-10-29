import { submitLeaderboardScore, syncPlayerProfileToCloud, LeaderboardEntry, PlayerProfileData } from './firebase.ts';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedAt?: string;
}

export interface DailyChallenge {
  date: string;
  title: string;
  requirement: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  rewardExp: number;
}

export interface PlayerState {
  playerId: string;
  displayName: string;
  avatar: string;
  region: 'NA' | 'EU' | 'ASIA';
  highScore: number;
  highestEpoch: number;
  totalGames: number;
  totalPacketsClassified: number;
  totalAnomaliesQuarantined: number;
  ddaRating: number; // MMR rating (starts 1200)
  seasonExp: number;
  seasonTier: number;
  achievements: Achievement[];
  dailyChallenge: DailyChallenge;
  pendingSyncQueue: LeaderboardEntry[];
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_synapse', name: 'First Pulse', description: 'Classify your first 10 data packets correctly', icon: 'zap', unlocked: false, progress: 0, maxProgress: 10 },
  { id: 'gradient_master', name: 'Gradient Descent', description: 'Reach a streak of 10 consecutive classifications', icon: 'trending-up', unlocked: false, progress: 0, maxProgress: 10 },
  { id: 'quarantine_hero', name: 'Adversarial Firewall', description: 'Quarantine 5 corrupted anomaly packets', icon: 'shield-alert', unlocked: false, progress: 0, maxProgress: 5 },
  { id: 'epoch_survivor', name: 'Deep Architecture', description: 'Survive and clear Epoch 5 in a single simulation', icon: 'cpu', unlocked: false, progress: 0, maxProgress: 5 },
  { id: 'zero_loss', name: 'Zero Loss Convergence', description: 'Achieve 95% or higher accuracy across an entire Epoch', icon: 'target', unlocked: false, progress: 0, maxProgress: 1 },
  { id: 'dda_overdrive', name: 'DDA Overdrive', description: 'Push Dynamic Difficulty Adjustment level above 2.0x', icon: 'flame', unlocked: false, progress: 0, maxProgress: 1 },
  { id: 'weight_tuner', name: 'Backprop Architect', description: 'Adjust synaptic weights 20 times during gameplay', icon: 'sliders', unlocked: false, progress: 0, maxProgress: 20 },
  { id: 'quantum_surge', name: 'Quantum Overclock', description: 'Trigger an Overdrive Combo Multiplier of 4x', icon: 'sparkles', unlocked: false, progress: 0, maxProgress: 1 },
];

function generateTodayChallenge(): DailyChallenge {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    title: 'Daily Protocol: Tensor Equilibrium',
    requirement: 'Classify 30 data packets with 80%+ accuracy',
    targetCount: 30,
    currentCount: 0,
    completed: false,
    rewardExp: 600,
  };
}

const STORAGE_KEY = 'synapse_player_state_v1';

export function loadLocalPlayerState(): PlayerState {
  if (typeof window === 'undefined') {
    return createDefaultState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure daily challenge is up to date
      const today = new Date().toISOString().slice(0, 10);
      if (!parsed.dailyChallenge || parsed.dailyChallenge.date !== today) {
        parsed.dailyChallenge = generateTodayChallenge();
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse saved state:', e);
  }
  return createDefaultState();
}

function createDefaultState(): PlayerState {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const state: PlayerState = {
    playerId: `OP_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    displayName: `CYBER_${randomSuffix}`,
    avatar: 'matrix_core',
    region: 'NA',
    highScore: 0,
    highestEpoch: 1,
    totalGames: 0,
    totalPacketsClassified: 0,
    totalAnomaliesQuarantined: 0,
    ddaRating: 1200,
    seasonExp: 150,
    seasonTier: 1,
    achievements: DEFAULT_ACHIEVEMENTS,
    dailyChallenge: generateTodayChallenge(),
    pendingSyncQueue: [],
  };
  saveLocalPlayerState(state);
  return state;
}

export function saveLocalPlayerState(state: PlayerState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to persist player state:', e);
  }
}

// Check and trigger achievements
export function recordRunStats(
  score: number,
  epoch: number,
  accuracy: number,
  packetsCount: number,
  quarantinedCount: number,
  maxStreak: number,
  maxDDA: number
): { state: PlayerState; newUnlocks: Achievement[] } {
  const state = loadLocalPlayerState();
  state.totalGames += 1;
  state.totalPacketsClassified += packetsCount;
  state.totalAnomaliesQuarantined += quarantinedCount;

  if (score > state.highScore) {
    state.highScore = score;
  }
  if (epoch > state.highestEpoch) {
    state.highestEpoch = epoch;
  }

  // Update MMR rating based on performance
  const scoreFactor = Math.floor(score / 500);
  const accuracyDelta = (accuracy - 70) * 0.5;
  state.ddaRating = Math.max(800, Math.round(state.ddaRating + scoreFactor + accuracyDelta));

  // Season Exp
  state.seasonExp += Math.round(score / 10) + (epoch * 50);
  state.seasonTier = 1 + Math.floor(state.seasonExp / 1000);

  // Daily Challenge progress
  if (!state.dailyChallenge.completed) {
    state.dailyChallenge.currentCount += packetsCount;
    if (state.dailyChallenge.currentCount >= state.dailyChallenge.targetCount) {
      state.dailyChallenge.completed = true;
      state.dailyChallenge.currentCount = state.dailyChallenge.targetCount;
      state.seasonExp += state.dailyChallenge.rewardExp;
    }
  }

  // Achievement Check
  const newUnlocks: Achievement[] = [];
  state.achievements = state.achievements.map((ach) => {
    if (ach.unlocked) return ach;
    let newProgress = ach.progress;

    if (ach.id === 'first_synapse') newProgress = Math.min(ach.maxProgress, ach.progress + packetsCount);
    if (ach.id === 'gradient_master') newProgress = Math.max(ach.progress, maxStreak);
    if (ach.id === 'quarantine_hero') newProgress = Math.min(ach.maxProgress, ach.progress + quarantinedCount);
    if (ach.id === 'epoch_survivor') newProgress = Math.max(ach.progress, epoch);
    if (ach.id === 'zero_loss' && accuracy >= 95 && epoch >= 2) newProgress = 1;
    if (ach.id === 'dda_overdrive' && maxDDA >= 2.0) newProgress = 1;
    if (ach.id === 'quantum_surge' && maxStreak >= 9) newProgress = 1;

    const shouldUnlock = newProgress >= ach.maxProgress;
    if (shouldUnlock && !ach.unlocked) {
      newUnlocks.push({ ...ach, progress: newProgress, unlocked: true });
      return { ...ach, progress: newProgress, unlocked: true, unlockedAt: new Date().toISOString() };
    }
    return { ...ach, progress: newProgress };
  });

  // Prepare leaderboard submission
  const leaderboardPayload: LeaderboardEntry = {
    playerId: state.playerId,
    displayName: state.displayName,
    score,
    epoch,
    accuracy,
    region: state.region,
    season: 'SEASON_1',
    timestamp: new Date().toISOString(),
  };

  // If online, sync to cloud, else queue
  if (navigator.onLine) {
    submitLeaderboardScore(leaderboardPayload);
    syncPlayerProfileToCloud({
      playerId: state.playerId,
      displayName: state.displayName,
      avatar: state.avatar,
      region: state.region,
      highScore: state.highScore,
      totalGames: state.totalGames,
      ddaRating: state.ddaRating,
      achievements: JSON.stringify(state.achievements.filter(a => a.unlocked).map(a => a.id)),
      updatedAt: new Date().toISOString(),
    });
  } else {
    state.pendingSyncQueue.push(leaderboardPayload);
  }

  saveLocalPlayerState(state);
  return { state, newUnlocks };
}

// Flush pending queue when back online
export async function flushOfflineQueue(): Promise<number> {
  const state = loadLocalPlayerState();
  if (state.pendingSyncQueue.length === 0) return 0;
  let flushed = 0;
  for (const item of [...state.pendingSyncQueue]) {
    const success = await submitLeaderboardScore(item);
    if (success) {
      flushed++;
      state.pendingSyncQueue = state.pendingSyncQueue.filter(q => q.timestamp !== item.timestamp);
    }
  }
  saveLocalPlayerState(state);
  return flushed;
}

// Export cross-platform device sync token
export function exportSyncToken(): string {
  const state = loadLocalPlayerState();
  const minimalData = {
    id: state.playerId,
    name: state.displayName,
    reg: state.region,
    hs: state.highScore,
    ep: state.highestEpoch,
    mmr: state.ddaRating,
    exp: state.seasonExp,
  };
  return btoa(JSON.stringify(minimalData));
}

// Import cross-platform device sync token
export function importSyncToken(token: string): boolean {
  try {
    const json = atob(token.trim());
    const parsed = JSON.parse(json);
    if (!parsed.id || !parsed.name) return false;
    const current = loadLocalPlayerState();
    current.playerId = parsed.id;
    current.displayName = parsed.name;
    current.region = parsed.reg || current.region;
    current.highScore = Math.max(current.highScore, parsed.hs || 0);
    current.highestEpoch = Math.max(current.highestEpoch, parsed.ep || 1);
    current.ddaRating = Math.max(current.ddaRating, parsed.mmr || 1200);
    current.seasonExp = Math.max(current.seasonExp, parsed.exp || 0);
    current.seasonTier = 1 + Math.floor(current.seasonExp / 1000);
    saveLocalPlayerState(current);

    // Sync to cloud immediately
    syncPlayerProfileToCloud({
      playerId: current.playerId,
      displayName: current.displayName,
      avatar: current.avatar,
      region: current.region,
      highScore: current.highScore,
      totalGames: current.totalGames,
      ddaRating: current.ddaRating,
      achievements: JSON.stringify(current.achievements.filter(a => a.unlocked).map(a => a.id)),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    console.error('Invalid sync token:', e);
    return false;
  }
}
