/**
 * Pure logic and mathematical calculations for SYNAPSE: Overdrive
 * Decoupled from React for high testability and deterministic 60fps simulation
 */

export type ActivationType = 'relu' | 'sigmoid' | 'tanh' | 'leaky_relu';

export interface Synapse {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number; // -2.0 to 2.0
  activeCharge: number; // visual pulse effect 0..1
}

export interface NeuralNode {
  id: string;
  layer: 'input' | 'hidden' | 'output';
  label: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  activation: ActivationType;
  bias: number;
  value: number; // current calculated output
  chargeLevel: number; // visual glow intensity 0..1
  isQuarantine?: boolean;
}

export interface DataPacket {
  id: string;
  values: number[]; // 3-dimensional feature vector [x0, x1, x2]
  targetClass: number; // 0: Alpha, 1: Beta, 2: Gamma, -1: Adversarial/Noise
  isAdversarial: boolean;
  currentSynapseId: string | null;
  progress: number; // 0 to 1 along synapse
  speed: number;
  fromNodeId: string;
  toNodeId: string;
}

export interface DDAState {
  level: number; // 0.8x to 3.5x
  packetSpeedMultiplier: number;
  spawnIntervalMs: number;
  adversarialProbability: number;
  accuracyRate: number; // 0 to 100
  recentLatencies: number[]; // ms
  avgLatencyMs: number;
  streak: number;
  totalPackets: number;
  correctPackets: number;
  statusMessage: string;
}

// Activation Functions
export function computeActivation(x: number, type: ActivationType): number {
  switch (type) {
    case 'relu':
      return Math.max(0, x);
    case 'sigmoid':
      return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
    case 'tanh':
      return Math.tanh(x);
    case 'leaky_relu':
      return x > 0 ? x : 0.1 * x;
    default:
      return Math.max(0, x);
  }
}

// Compute forward signal across a synapse
export function calculateSynapseSignal(inputValue: number, weight: number, bias: number, activation: ActivationType): number {
  const weightedSum = (inputValue * weight) + bias;
  return computeActivation(weightedSum, activation);
}

// Calculate Mean Squared Error Loss
export function calculateLoss(predictions: number[], targets: number[]): number {
  if (predictions.length === 0 || targets.length === 0) return 0;
  let sumSq = 0;
  const len = Math.min(predictions.length, targets.length);
  for (let i = 0; i < len; i++) {
    const diff = predictions[i] - targets[i];
    sumSq += diff * diff;
  }
  return Number((sumSq / (2 * len)).toFixed(4));
}

// Dynamic Difficulty Adjustment (DDA) update logic
export function updateDDA(
  currentState: DDAState,
  outcome: { correct: boolean; latencyMs: number; isAdversarialHit: boolean }
): DDAState {
  const newTotal = currentState.totalPackets + 1;
  const newCorrect = currentState.correctPackets + (outcome.correct ? 1 : 0);
  const newAccuracy = Number(((newCorrect / newTotal) * 100).toFixed(1));

  const updatedLatencies = [...currentState.recentLatencies, outcome.latencyMs].slice(-10);
  const avgLatency = Math.round(
    updatedLatencies.reduce((sum, v) => sum + v, 0) / updatedLatencies.length
  );

  let newStreak = outcome.correct ? currentState.streak + 1 : 0;
  let newLevel = currentState.level;
  let status = 'BALANCED FLOW';

  if (outcome.correct) {
    // If player is performing with high accuracy and fast reactions
    if (newAccuracy >= 80 && avgLatency < 1200) {
      newLevel = Math.min(3.5, Number((newLevel + 0.08).toFixed(2)));
      status = 'DDA: ACCELERATING (+)';
    } else if (newAccuracy >= 65) {
      newLevel = Math.min(3.0, Number((newLevel + 0.04).toFixed(2)));
      status = 'DDA: GRADIENT STABLE';
    }
  } else {
    // If player struggled, reduce pressure
    newLevel = Math.max(0.75, Number((newLevel - 0.12).toFixed(2)));
    status = 'DDA: STABILIZING (-)';
  }

  // Derive runtime parameters based on DDA level
  const packetSpeed = Number((1.0 + (newLevel - 1) * 0.45).toFixed(2));
  const spawnInterval = Math.max(1200, Math.round(3400 / newLevel));
  const adversarialProb = Math.min(0.35, Number((0.08 + (newLevel - 1) * 0.1).toFixed(3)));

  return {
    level: newLevel,
    packetSpeedMultiplier: packetSpeed,
    spawnIntervalMs: spawnInterval,
    adversarialProbability: adversarialProb,
    accuracyRate: newAccuracy,
    recentLatencies: updatedLatencies,
    avgLatencyMs: avgLatency,
    streak: newStreak,
    totalPackets: newTotal,
    correctPackets: newCorrect,
    statusMessage: status,
  };
}

// Score Calculation with DDA multiplier and combo bonuses
export function computeScoreIncrement(basePoints: number, streak: number, ddaLevel: number, accuracy: number): number {
  const comboMultiplier = Math.min(5, 1 + Math.floor(streak / 3) * 0.5);
  const accuracyBonus = accuracy >= 90 ? 1.5 : accuracy >= 75 ? 1.2 : 1.0;
  const ddaBonus = Math.max(0.8, ddaLevel);
  return Math.round(basePoints * comboMultiplier * accuracyBonus * ddaBonus);
}

// Create initial balanced neural network topology
export function createInitialTopology(): { nodes: NeuralNode[]; synapses: Synapse[] } {
  const nodes: NeuralNode[] = [
    // Input layer
    { id: 'in_0', layer: 'input', label: 'FREQ λ', x: 0.12, y: 0.22, activation: 'relu', bias: 0, value: 0.5, chargeLevel: 0 },
    { id: 'in_1', layer: 'input', label: 'TENSOR τ', x: 0.12, y: 0.50, activation: 'relu', bias: 0, value: 0.5, chargeLevel: 0 },
    { id: 'in_2', layer: 'input', label: 'CHARGE ψ', x: 0.12, y: 0.78, activation: 'relu', bias: 0, value: 0.5, chargeLevel: 0 },

    // Hidden layer
    { id: 'hid_0', layer: 'hidden', label: 'H-01 (ReLU)', x: 0.50, y: 0.18, activation: 'relu', bias: 0.1, value: 0, chargeLevel: 0 },
    { id: 'hid_1', layer: 'hidden', label: 'H-02 (Tanh)', x: 0.50, y: 0.39, activation: 'tanh', bias: 0.0, value: 0, chargeLevel: 0 },
    { id: 'hid_2', layer: 'hidden', label: 'H-03 (Sigmoid)', x: 0.50, y: 0.61, activation: 'sigmoid', bias: -0.1, value: 0, chargeLevel: 0 },
    { id: 'hid_3', layer: 'hidden', label: 'H-04 (LeakyReLU)', x: 0.50, y: 0.82, activation: 'leaky_relu', bias: 0.05, value: 0, chargeLevel: 0 },

    // Output layer
    { id: 'out_0', layer: 'output', label: 'CLASS α', x: 0.88, y: 0.22, activation: 'sigmoid', bias: 0, value: 0, chargeLevel: 0 },
    { id: 'out_1', layer: 'output', label: 'CLASS β', x: 0.88, y: 0.45, activation: 'sigmoid', bias: 0, value: 0, chargeLevel: 0 },
    { id: 'out_2', layer: 'output', label: 'CLASS γ', x: 0.88, y: 0.68, activation: 'sigmoid', bias: 0, value: 0, chargeLevel: 0 },
    { id: 'out_q', layer: 'output', label: 'QUARANTINE ⊘', x: 0.88, y: 0.88, activation: 'relu', bias: 0, value: 0, chargeLevel: 0, isQuarantine: true },
  ];

  // Default balanced synapses
  const synapses: Synapse[] = [
    // Inputs to hidden
    { id: 'syn_in0_h0', fromNodeId: 'in_0', toNodeId: 'hid_0', weight: 1.2, activeCharge: 0 },
    { id: 'syn_in0_h1', fromNodeId: 'in_0', toNodeId: 'hid_1', weight: 0.6, activeCharge: 0 },
    { id: 'syn_in1_h1', fromNodeId: 'in_1', toNodeId: 'hid_1', weight: 1.4, activeCharge: 0 },
    { id: 'syn_in1_h2', fromNodeId: 'in_1', toNodeId: 'hid_2', weight: 0.9, activeCharge: 0 },
    { id: 'syn_in2_h2', fromNodeId: 'in_2', toNodeId: 'hid_2', weight: 1.1, activeCharge: 0 },
    { id: 'syn_in2_h3', fromNodeId: 'in_2', toNodeId: 'hid_3', weight: 1.5, activeCharge: 0 },

    // Hidden to output
    { id: 'syn_h0_out0', fromNodeId: 'hid_0', toNodeId: 'out_0', weight: 1.5, activeCharge: 0 },
    { id: 'syn_h1_out0', fromNodeId: 'hid_1', toNodeId: 'out_0', weight: 0.5, activeCharge: 0 },
    { id: 'syn_h1_out1', fromNodeId: 'hid_1', toNodeId: 'out_1', weight: 1.3, activeCharge: 0 },
    { id: 'syn_h2_out1', fromNodeId: 'hid_2', toNodeId: 'out_1', weight: 0.7, activeCharge: 0 },
    { id: 'syn_h2_out2', fromNodeId: 'hid_2', toNodeId: 'out_2', weight: 1.4, activeCharge: 0 },
    { id: 'syn_h3_out2', fromNodeId: 'hid_3', toNodeId: 'out_2', weight: 1.2, activeCharge: 0 },
    { id: 'syn_h3_outq', fromNodeId: 'hid_3', toNodeId: 'out_q', weight: 1.0, activeCharge: 0 },
  ];

  return { nodes, synapses };
}

// Generate new data packet with feature vector
export function generatePacket(id: string, dda: DDAState): DataPacket {
  const isAdversarial = Math.random() < dda.adversarialProbability;
  const targetClass = isAdversarial ? -1 : Math.floor(Math.random() * 3); // 0, 1, or 2

  // Generate vector values correlated with target class
  let values = [0.2, 0.2, 0.2];
  if (isAdversarial) {
    // Chaotic values
    values = [Math.random(), Math.random(), Math.random()];
  } else if (targetClass === 0) {
    // Alpha: High Frequency
    values = [0.8 + Math.random() * 0.2, 0.2 + Math.random() * 0.2, 0.3 + Math.random() * 0.2];
  } else if (targetClass === 1) {
    // Beta: High Tensor
    values = [0.2 + Math.random() * 0.2, 0.8 + Math.random() * 0.2, 0.3 + Math.random() * 0.2];
  } else {
    // Gamma: High Charge
    values = [0.3 + Math.random() * 0.2, 0.2 + Math.random() * 0.2, 0.8 + Math.random() * 0.2];
  }

  // Initial node: input node matching highest feature
  const maxIdx = values.indexOf(Math.max(...values));
  const startNodeId = `in_${maxIdx}`;

  return {
    id,
    values,
    targetClass,
    isAdversarial,
    currentSynapseId: null,
    progress: 0,
    speed: 0.8 * dda.packetSpeedMultiplier,
    fromNodeId: startNodeId,
    toNodeId: '',
  };
}
