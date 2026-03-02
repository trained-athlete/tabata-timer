// ===== Constants =====
const LS_KEY = 'tabata.settings.v1';
const PHASE_LABELS = {
  prepare: 'Prepare',
  work: 'Work',
  rest: 'Rest',
  longrest: 'Long Rest',
  done: 'Done'
};

// Training modes supported by the app
const MODES = ['tabata', 'emom', 'fortime', 'amrap'];
let currentMode = 'tabata';

// keys saved to localStorage
const SETTING_KEYS = ['prep','work','rest','rounds','cycles','longrest'];

function modeLabel(mode) {
  switch (mode) {
    case 'tabata': return 'Tabata Timer';
    case 'emom': return 'EMOM Timer';
    case 'fortime': return 'For Time';
    case 'amrap': return 'AMRAP';
    default: return 'Timer';
  }
}

function setMode(mode) {
  if (!MODES.includes(mode)) mode = 'tabata';
  currentMode = mode;
  document.title = modeLabel(mode);
  const appTitle = document.getElementById('appTitle');
  if (appTitle) appTitle.textContent = modeLabel(mode);
  const appEl = document.querySelector('.app');
  if (appEl) appEl.setAttribute('aria-label', modeLabel(mode));
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.getAttribute('data-mode') === mode);
  });
  updateSettingsVisibility();
  // adjust some field labels based on mode using cached label nodes
  const { work, workInfo, rest, restInfo, rounds, roundsInfo } = elements.labels;

  if (work) {
    if (mode === 'fortime' || mode === 'amrap') {
      work.textContent = 'Duration (sec)';
      if (workInfo) workInfo.textContent = '';
    } else {
      work.textContent = 'Work (sec)';
      if (workInfo) workInfo.textContent = 'High-intensity interval';
    }
  }

  if (rest) {
    if (mode === 'emom') {
      rest.textContent = 'Rest (auto)';
      if (restInfo) restInfo.textContent = 'Calculated as 60 - work';
    } else {
      rest.textContent = 'Rest (sec)';
      if (restInfo) restInfo.textContent = 'Recovery interval';
    }
  }

  if (rounds) {
    if (mode === 'emom') {
      rounds.textContent = 'Minutes';
      if (roundsInfo) roundsInfo.textContent = 'Number of minutes';
    } else {
      rounds.textContent = 'Rounds per cycle';
      if (roundsInfo) roundsInfo.textContent = 'Work+Rest repetitions';
    }
  }
  // adjust the input constraints for EMOM mode (minutes: 10-60)
  if (elements.inputs && elements.inputs.rounds) {
    if (mode === 'emom') {
      elements.inputs.rounds.min = 10;
      elements.inputs.rounds.max = 60;
      if (+elements.inputs.rounds.value < 10) elements.inputs.rounds.value = 10;
    } else {
      elements.inputs.rounds.min = 1;
      elements.inputs.rounds.max = 9999;
      if (+elements.inputs.rounds.value < 1) elements.inputs.rounds.value = 1;
    }
  }
  resetSession();
}

function updateSettingsVisibility() {
  document.querySelectorAll('.field[data-modes]').forEach(el => {
    const modes = el.getAttribute('data-modes').split(/\s+/);
    if (modes.includes(currentMode)) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}


// Timer controller (refactored to separate file)
import { TimerController } from './timer.js';

// ===== Utility Functions =====
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

// ===== Sound Module =====
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

  tripleCountdown() {
    [660, 660, 990].forEach((freq, index) => {
      setTimeout(() => this.beep(freq, 0.12), index * 200);
    });
  },

  bell() {
    this.beep(440, 0.25, 'triangle', 0.12);
    setTimeout(() => this.beep(880, 0.25, 'sine', 0.08), 50);
  },
  
  // expose to global for testing/debugging
  _expose() { if (typeof window !== 'undefined') window.Sound = this; },

  warning() {
    // play three identical tones; each lasts 0.25 s and they are spaced
    // 500 ms apart so they don’t overlap
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

// ===== DOM Elements =====
const elements = {
  clock: document.getElementById('clock'),
  phaseBadge: document.getElementById('phaseBadge'),
  subline: document.getElementById('subline'),
  intervalProgress: document.getElementById('intervalProgress'),
  sessionProgress: document.getElementById('sessionProgress'),
  stats: document.getElementById('stats'),
  summary: document.getElementById('summary'),
  btnStart: document.getElementById('btnStart'),
  btnPause: document.getElementById('btnPause'),
  btnReset: document.getElementById('btnReset'),
  btnSkip: document.getElementById('btnSkip'),
  btnMute: document.getElementById('btnMute'),
  inputs: {
    prep: document.getElementById('prep'),
    work: document.getElementById('work'),
    rest: document.getElementById('rest'),
    rounds: document.getElementById('rounds'),
    cycles: document.getElementById('cycles'),
    longrest: document.getElementById('longrest'),
    autoNext: document.getElementById('autoNext'),
    sessionBeep: document.getElementById('sessionBeep')
  },
  labels: {
    work: document.querySelector('label[for="work"]'),
    workInfo: null,
    rest: document.querySelector('label[for="rest"]'),
    restInfo: null,
    rounds: document.querySelector('label[for="rounds"]'),
    roundsInfo: null
  }
};
// populate info nodes after DOM ready

// resume audio context whenever the window becomes active/visible
function resumeOnActivation() {
  // ignore promise; we'll try again later if it fails
  Sound.ensureUnlocked();
}
window.addEventListener('focus', resumeOnActivation);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resumeOnActivation();
});

// populate info nodes after DOM ready
if (elements.labels.work) elements.labels.workInfo = elements.labels.work.nextElementSibling;
if (elements.labels.rest) elements.labels.restInfo = elements.labels.rest.nextElementSibling;
if (elements.labels.rounds) elements.labels.roundsInfo = elements.labels.rounds.nextElementSibling;

// ===== State =====
const state = {
  phase: 'prepare',
  remaining: 10,
  totals: {
    prep: 10,
    work: 20,
    rest: 10,
    rounds: 8,
    cycles: 1,
    longrest: 60
  },
  currentRound: 1,
  currentCycle: 1,
  running: false,
  sessionTotalSeconds: 0,
  sessionElapsedSeconds: 0
};

// ===== Persistence =====
function loadSettings() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;
  try {
    const settings = JSON.parse(raw);
    SETTING_KEYS.forEach(key => {
      if (typeof settings[key] === 'number') {
        elements.inputs[key].value = settings[key];
      }
    });
    elements.inputs.autoNext.checked = !!settings.autoNext;
    elements.inputs.sessionBeep.checked = !!settings.sessionBeep;
    Sound.enabled = settings.soundEnabled !== false;
    elements.btnMute.textContent = Sound.enabled ? '🔈 Sound: On' : '🔇 Sound: Off';
    if (settings.mode) {
      setMode(settings.mode);
    }
  } catch (error) {
    console.warn('Failed to load settings:', error);
  }
}

function saveSettings() {
  const settings = getCurrentTotals();
  settings.autoNext = elements.inputs.autoNext.checked;
  settings.sessionBeep = elements.inputs.sessionBeep.checked;
  settings.soundEnabled = Sound.enabled;
  settings.mode = currentMode;
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}

// ===== Helpers =====
const TOTALS_BUILDERS = {
  tabata: (inputs) => ({
    prep: +inputs.prep.value || 0,
    work: +inputs.work.value || 1,
    rest: +inputs.rest.value || 0,
    rounds: Math.max(1, +inputs.rounds.value || 1),
    cycles: Math.max(1, +inputs.cycles.value || 1),
    longrest: +inputs.longrest.value || 0
  }),
  emom: (inputs) => {
    const work = +inputs.work.value || 1;
    return {
      prep: 0,
      work,
      rest: Math.max(0, 60 - work),
      rounds: Math.max(1, +inputs.rounds.value || 1),
      cycles: 1,
      longrest: 0
    };
  },
  fortime: (inputs) => {
    const work = +inputs.work.value || 1;
    return { prep: 0, work, rest: 0, rounds: 1, cycles: 1, longrest: 0 };
  },
  amrap: (inputs) => {
    // same structure as fortime
    return TOTALS_BUILDERS.fortime(inputs);
  }
};

function getCurrentTotals() {
  const builder = TOTALS_BUILDERS[currentMode] || TOTALS_BUILDERS.tabata;
  return builder(elements.inputs);
}

function computeSessionTotal(totals) {
  const oneRound = totals.work + totals.rest;
  const perCycle = totals.prep + (oneRound * totals.rounds);
  const betweenCycles = (totals.cycles > 1) ? (totals.longrest * (totals.cycles - 1)) : 0;
  return (perCycle * totals.cycles) + betweenCycles;
}

function updateStats() {
  const totals = getCurrentTotals();
  const total = computeSessionTotal(totals);
  const parts = [`Total session time: ${formatTime(total)}`];
  parts.push(`Work: ${totals.work}s`);
  if (totals.rest) parts.push(`Rest: ${totals.rest}s`);

  if (currentMode === 'emom') {
    parts.push(`Minutes: ${totals.rounds}`);
  } else if (currentMode === 'tabata') {
    parts.push(`Rounds: ${totals.rounds}`);
    parts.push(`Cycles: ${totals.cycles}`);
  } else if (currentMode === 'fortime' || currentMode === 'amrap') {
    parts.push(`Duration: ${formatTime(totals.work)}`);
  }

  elements.stats.textContent = parts.join(' • ');
}

function setPhase(phase) {
  state.phase = phase;
  elements.phaseBadge.className = 'phase ' + (phase === 'done' ? 'done' : phase);
  elements.phaseBadge.textContent = PHASE_LABELS[phase] || phase;
}

function updateSubline() {
  elements.subline.textContent = (state.phase === 'longrest' || state.phase === 'done')
    ? `Cycle ${state.currentCycle} / ${state.totals.cycles}`
    : `Round ${state.currentRound} / ${state.totals.rounds} • Cycle ${state.currentCycle} / ${state.totals.cycles}`;
}

function updateProgressBars() {
  const totalInterval = getIntervalDuration(state.phase);
  const intervalPercent = totalInterval ? (1 - state.remaining / totalInterval) * 100 : 100;
  elements.intervalProgress.style.width = `${Math.min(100, Math.max(0, intervalPercent))}%`;

  const sessionPercent = state.sessionTotalSeconds ? (state.sessionElapsedSeconds / state.sessionTotalSeconds) * 100 : 0;
  elements.sessionProgress.style.width = `${Math.min(100, Math.max(0, sessionPercent))}%`;
}

function getIntervalDuration(phase) {
  switch (phase) {
    case 'prepare': return state.totals.prep;
    case 'work': return state.totals.work;
    case 'rest': return state.totals.rest;
    case 'longrest': return state.totals.longrest;
    default: return 1;
  }
}

function renderClock() {
  // For EMOM mode, display remaining time in the current minute (work+rest = 60s)
  let displayRemaining = state.remaining;
  if (currentMode === 'emom') {
    if (state.phase === 'work') {
      // time until minute end = remaining work + rest
      displayRemaining = state.remaining + (state.totals.rest || 0);
    } else {
      // during rest or other phases, minute remaining is the phase remaining
      displayRemaining = state.remaining;
    }
  }
  elements.clock.textContent = formatTime(displayRemaining);
  updateProgressBars();
  updateSubline();
  // show total remaining workout time in the footer summary
  const totalLeft = Math.max(0, (state.sessionTotalSeconds || 0) - (state.sessionElapsedSeconds || 0));
  if (currentMode === 'emom') {
    elements.summary.textContent = `Total remaining: ${formatTime(totalLeft)}`;
  } else {
    elements.summary.textContent = '';
  }
}

// TimerController now handles phase transitions and ticking. See `timer.js` for implementation.
function playPhaseSound() {
  if (!elements.inputs.sessionBeep.checked) return;
  if (state.phase === 'work') Sound.bell();
  else if (state.phase === 'rest') Sound.tripleCountdown();
  else if (state.phase === 'longrest') Sound.beep(520, 0.18);
  else if (state.phase === 'done') Sound.bell();
}

function playWarningSound() {
  if (!elements.inputs.sessionBeep.checked) return;
  Sound.warning();
}

let timer = null;

function startTimer() {
  if (state.running) return;
  Sound.init();
  // ensure audio unlocked (user gesture) and request wake lock where supported
  Sound.ensureUnlocked().then(() => {
    Sound.requestWakeLock();
  });
  if (timer) timer.start();
  state.running = true;
  // play initial beep for EMOM start
  if (currentMode === 'emom' && elements.inputs.sessionBeep.checked) {
    Sound.shortBeep();
  }
  elements.btnStart.textContent = 'Running';
}

function pauseTimer() {
  if (timer) timer.pause();
  state.running = false;
  // release wake lock to save battery while paused
  Sound.releaseWakeLock();
  elements.btnStart.textContent = '▶ Start';
}

function stopTimer() {
  if (timer) timer.stop();
  state.running = false;
  Sound.releaseWakeLock();
}

function resetSession() {
  stopTimer();
  const totals = getCurrentTotals();
  if (timer) timer.reset(totals);
  Object.assign(state, timer ? timer.getState() : { phase: 'prepare', remaining: totals.prep, totals });
  setPhase(state.phase);
  updateStats();
  elements.summary.textContent = '';
}

function skipInterval() {
  if (timer) timer.skip();
} 

// ===== Event Bindings =====
// mode selector buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const m = btn.getAttribute('data-mode');
    setMode(m);
    saveSettings();
  });
});

elements.btnStart.addEventListener('click', startTimer);
elements.btnPause.addEventListener('click', pauseTimer);
elements.btnReset.addEventListener('click', () => {
  resetSession();
  saveSettings();
});
elements.btnSkip.addEventListener('click', skipInterval);
elements.btnMute.addEventListener('click', () => {
  Sound.enabled = !Sound.enabled;
  elements.btnMute.textContent = Sound.enabled ? '🔈 Sound: On' : '🔇 Sound: Off';
  saveSettings();
});

// Input changes
Object.entries(elements.inputs).forEach(([key, input]) => {
  if (!input || !input.addEventListener) return;
  input.addEventListener('change', () => {
    if (key === 'autoNext' && timer) {
      timer.setAutoNext(input.checked);
    }
    saveSettings();
    resetSession();
  });
});

// Keyboard shortcuts
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    state.running ? pauseTimer() : startTimer();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    resetSession();
    saveSettings();
  } else if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    skipInterval();
  }
});

// ===== Initialization =====
/* Unlock audio on first user gesture (needed on Safari/iOS) */
function unlockAudioOnFirstGesture() {
  function unlock() {
    Sound.ensureUnlocked && Sound.ensureUnlocked();
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('mousedown', unlock);
  }
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('mousedown', unlock, { passive: true });
}
unlockAudioOnFirstGesture();

loadSettings();
// default mode if none set
if (!MODES.includes(currentMode)) {
  setMode('tabata');
} else {
  // make sure visibility is correct in case loadSettings didn't call it directly
  updateSettingsVisibility();
}

// create timer with callbacks that sync UI
function createTimer() {
  return new TimerController(getCurrentTotals(), {
    autoNext: elements.inputs.autoNext.checked,
    onTick: s => { Object.assign(state, s); renderClock(); },
    onPhase: s => { Object.assign(state, s); playPhaseSound(); setPhase(s.phase); renderClock(); },
    onWarning: s => { playWarningSound(); },
    onDone: () => { setPhase('done'); renderClock(); }
  });
}

timer = createTimer();
resetSession();