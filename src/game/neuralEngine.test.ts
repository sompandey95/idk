import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeActivation,
  calculateSynapseSignal,
  calculateLoss,
  updateDDA,
  computeScoreIncrement,
  createInitialTopology,
  generatePacket,
  DDAState
} from './neuralEngine.ts';

test('computeActivation evaluates mathematical activation curves correctly', () => {
  // ReLU
  assert.equal(computeActivation(2.5, 'relu'), 2.5);
  assert.equal(computeActivation(-1.5, 'relu'), 0);

  // LeakyReLU
  assert.equal(computeActivation(2, 'leaky_relu'), 2);
  assert.equal(computeActivation(-2, 'leaky_relu'), -0.2);

  // Sigmoid
  const sig0 = computeActivation(0, 'sigmoid');
  assert.ok(Math.abs(sig0 - 0.5) < 0.001);

  // Tanh
  const tanh0 = computeActivation(0, 'tanh');
  assert.equal(tanh0, 0);
});

test('calculateSynapseSignal applies weights, biases, and activation', () => {
  const signal = calculateSynapseSignal(1.0, 1.5, 0.5, 'relu');
  assert.equal(signal, 2.0);

  const zeroSignal = calculateSynapseSignal(1.0, -2.0, 0.5, 'relu');
  assert.equal(zeroSignal, 0);
});

test('calculateLoss computes mean squared error accurately', () => {
  const loss1 = calculateLoss([1, 0, 0], [1, 0, 0]);
  assert.equal(loss1, 0);

  const loss2 = calculateLoss([0, 1, 0], [1, 0, 0]);
  assert.ok(loss2 > 0);
});

test('updateDDA increases challenge on high accuracy streak and relaxes on failure', () => {
  const initialDDA: DDAState = {
    level: 1.0,
    packetSpeedMultiplier: 1.0,
    spawnIntervalMs: 2500,
    adversarialProbability: 0.1,
    accuracyRate: 90,
    recentLatencies: [600, 700],
    avgLatencyMs: 650,
    streak: 4,
    totalPackets: 10,
    correctPackets: 9,
    statusMessage: 'INIT',
  };

  // High performance update
  const boostedDDA = updateDDA(initialDDA, { correct: true, latencyMs: 500, isAdversarialHit: false });
  assert.ok(boostedDDA.level > initialDDA.level, 'DDA level should increase on good performance');
  assert.ok(boostedDDA.packetSpeedMultiplier >= initialDDA.packetSpeedMultiplier);
  assert.equal(boostedDDA.streak, 5);

  // Failure update
  const relaxedDDA = updateDDA(boostedDDA, { correct: false, latencyMs: 2000, isAdversarialHit: true });
  assert.ok(relaxedDDA.level < boostedDDA.level, 'DDA level should drop on misclassification');
  assert.equal(relaxedDDA.streak, 0);
});

test('computeScoreIncrement scales points with combo streak, accuracy and DDA multiplier', () => {
  const baseScore = computeScoreIncrement(100, 0, 1.0, 80);
  const comboScore = computeScoreIncrement(100, 6, 1.5, 95);
  assert.ok(comboScore > baseScore, 'Score with combo, high accuracy, and high DDA level must be significantly higher');
});

test('createInitialTopology constructs valid nodes and synapses', () => {
  const { nodes, synapses } = createInitialTopology();
  assert.ok(nodes.length >= 10);
  assert.ok(synapses.length >= 10);
  assert.ok(nodes.some(n => n.layer === 'input'));
  assert.ok(nodes.some(n => n.layer === 'hidden'));
  assert.ok(nodes.some(n => n.layer === 'output'));
  assert.ok(nodes.some(n => n.isQuarantine));
});

test('generatePacket creates valid payload matching DDA specs', () => {
  const dda: DDAState = {
    level: 1.5,
    packetSpeedMultiplier: 1.2,
    spawnIntervalMs: 2000,
    adversarialProbability: 0.2,
    accuracyRate: 85,
    recentLatencies: [600],
    avgLatencyMs: 600,
    streak: 2,
    totalPackets: 5,
    correctPackets: 4,
    statusMessage: '',
  };
  const packet = generatePacket('pkt_1', dda);
  assert.equal(packet.id, 'pkt_1');
  assert.equal(packet.values.length, 3);
  assert.ok(packet.speed > 0);
});
