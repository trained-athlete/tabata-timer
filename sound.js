// Sound module extracted from script.js
// Provides a simple API for generating beeps and managing a wake lock.

const Sound = {
  enabled: true,
  audioCtx: null,
  AudioContextClass: (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null,

  init() {
    if (!this.AudioContextClass) return null;
    if (!this.audioCtx) {
      try {
        this.audioCtx = new this.AudioContextClass();
        // expose for tests
        if (typeof window !== 'undefined') window._TestAudioCtx = this.audioCtx;
      } catch (e) {
        console.warn('AudioContext init failed:', e);
        this.audioCtx = null;
      }
    }
    return this.audioCtx;
  },

  async ensureUnlocked() {
    const ctx = this.init();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        // resume may fail silently on some browsers if not a user gesture
      }
    }
    return ctx;
  },

  async beep(freq = 880, duration = 0.18, type = 'sine', volume = 0.08) {
    if (!this.enabled) return;
    const ctx = await this.ensureUnlocked();
    if (!ctx || ctx.state !== 'running') return; // nothing to do if still suspended
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gainNode.gain.value = volume;
    oscillator.connect(gainNode).connect(ctx.destination);
    // default: play immediately at audioContext time
    const startAt = ctx.currentTime;
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  },

  // schedule a beep at a specific AudioContext time (absolute). If `when` is null, plays immediately.
  async scheduleBeep({ freq = 880, duration = 0.18, type = 'sine', volume = 0.08, when = null } = {}) {
    if (!this.enabled) return;
    const ctx = await this.ensureUnlocked();
    if (!ctx || ctx.state !== 'running') return;
    const startAt = (typeof when === 'number') ? when : ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gainNode.gain.value = volume;
    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  },

  shortBeep() { this.scheduleBeep({ freq: 880, duration: 0.12, type: 'sine', volume: 0.09 }); },
  doubleBeep() {
    // two quick short beeps
    this.scheduleBeep({ freq: 880, duration: 0.12, type: 'sine', volume: 0.09 });
    // schedule second after 180ms
    const ctx = this.audioCtx;
    if (ctx) this.scheduleBeep({ freq: 880, duration: 0.12, type: 'sine', volume: 0.09, when: ctx.currentTime + 0.18 });
  },
  alarmBeep() { this.scheduleBeep({ freq: 660, duration: 0.5, type: 'sawtooth', volume: 0.14 }); },

  tripleCountdown() {
    [660, 660, 990].forEach((freq, index) => {
      setTimeout(() => this.beep(freq, 0.12), index * 200);
    });
  },

  bell() {
    this.beep(440, 0.25, 'triangle', 0.12);
    setTimeout(() => this.beep(880, 0.25, 'sine', 0.08), 50);
  },
  // Wake Lock helpers to keep screen on where supported
  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !this._wakeLock) {
        this._wakeLock = await navigator.wakeLock.request('screen');
        this._wakeLock.addEventListener('release', () => { this._wakeLock = null; });
      }
    } catch (e) {
      // ignore failures; not critical
    }
  },

  async releaseWakeLock() {
    try {
      if (this._wakeLock) {
        await this._wakeLock.release();
        this._wakeLock = null;
      }
    } catch (e) {
      // ignore
    }
  },

  // expose to global for testing/debugging
  _expose() { if (typeof window !== 'undefined') window.Sound = this; },

  warning() {
    // play three identical tones; each lasts 0.25s and they are spaced
    // 500ms apart so they do not overlap
    this.scheduleBeep({ freq: 770, duration: 0.25, type: 'sine', volume: 0.1 });
    const ctx = this.audioCtx;
    if (ctx) {
      this.scheduleBeep({ freq: 770, duration: 0.25, type: 'sine', volume: 0.1, when: ctx.currentTime + 0.5 });
      this.scheduleBeep({ freq: 770, duration: 0.25, type: 'sine', volume: 0.1, when: ctx.currentTime + 1.0 });
    } else {
      setTimeout(() => this.beep(770, 0.25, 'sine', 0.1), 500);
      setTimeout(() => this.beep(770, 0.25, 'sine', 0.1), 1000);
    }
  }
};

// make sound object available globally (used by automated tests)
Sound._expose && Sound._expose();

export { Sound };
