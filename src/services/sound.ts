/**
 * Procedural Web Audio API Sound Synthesizer & Haptic Feedback Manager
 * Zero external assets required, instantaneous neon feedback
 */

class SoundAndHapticEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private hapticsEnabled: boolean = true;

  constructor() {
    // Lazily create AudioContext on first user interaction
    if (typeof window !== 'undefined') {
      let savedSound: string | null = null;
      let savedHaptics: string | null = null;
      try {
        savedSound = localStorage.getItem('synapse_sound_enabled');
        savedHaptics = localStorage.getItem('synapse_haptics_enabled');
      } catch { /* Feedback still works when device storage is disabled. */ }
      if (savedSound !== null) this.soundEnabled = savedSound === 'true';

      if (savedHaptics !== null) this.hapticsEnabled = savedHaptics === 'true';
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    try { localStorage.setItem('synapse_sound_enabled', String(this.soundEnabled)); } catch { /* Session preference. */ }
    return this.soundEnabled;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public toggleHaptics(): boolean {
    this.hapticsEnabled = !this.hapticsEnabled;
    try { localStorage.setItem('synapse_haptics_enabled', String(this.hapticsEnabled)); } catch { /* Session preference. */ }
    if (this.hapticsEnabled) {
      this.triggerHaptic('medium');
    }
    return this.hapticsEnabled;
  }

  public isHapticsEnabled(): boolean {
    return this.hapticsEnabled;
  }

  // Haptic feedback with pattern support
  public triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'activation' | 'combo' | 'error') {
    if (!this.hapticsEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate(50);
          break;
        case 'activation':
          navigator.vibrate([20, 30, 35]);
          break;
        case 'combo':
          navigator.vibrate([15, 25, 15, 25, 40]);
          break;
        case 'error':
          navigator.vibrate([50, 40, 50]);
          break;
      }
    } catch {
      // Ignore vibration errors if restricted by device policy
    }
  }

  // Sound: Node Selected / Tapped
  public playTap() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Sound: Weight adjusted / dial
  public playDial(weight: number) {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    const freq = 400 + Math.max(0, weight + 2) * 200;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // Sound: Neuron Activated (Harmonic chime)
  public playActivation(layerIndex: number = 0) {
    this.triggerHaptic('activation');
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const baseFreq = freqs[layerIndex % freqs.length];

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Sound: Correct Classification / Success Score
  public playSuccess(streak: number = 0) {
    this.triggerHaptic(streak >= 3 ? 'combo' : 'medium');
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const baseFreq = 440 * Math.pow(1.05, Math.min(12, streak));

    [baseFreq, baseFreq * 1.25, baseFreq * 1.5].forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const startT = now + idx * 0.04;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, startT);

      gain.gain.setValueAtTime(0.1, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(startT);
      osc.stop(startT + 0.16);
    });

  }

  // Sound: Adversarial Quarantine / Absorbed
  public playQuarantine() {
    this.triggerHaptic('heavy');
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Sound: Misclassification / Core Damage Glitch
  public playError() {
    this.triggerHaptic('error');
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.2);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Sound: Epoch Completed (Fanfare)
  public playEpochAdvance() {
    this.triggerHaptic('combo');
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t);
      osc.stop(t + 0.25);
    });

  }
}

export const sound = new SoundAndHapticEngine();
