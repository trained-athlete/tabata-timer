// ===== Constants =====
const LS_KEY = 'tabata.settings.v1';
const PHASE_LABELS = {
  prepare: 'Prepare',
  work: 'Work',
  rest: 'Rest',
  longrest: 'Long Rest',
  done: 'Done'
};

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
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gainNode.gain.value = volume;
    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
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

  warning() {
    this.beep(770, 0.1, 'sine', 0.1);
    setTimeout(() => this.beep(770, 0.1, 'sine', 0.1), 150);
  }
};

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
  }
};

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
    ['prep', 'work', 'rest', 'rounds', 'cycles', 'longrest'].forEach(key => {
      if (typeof settings[key] === 'number') {
        elements.inputs[key].value = settings[key];
      }
    });
    elements.inputs.autoNext.checked = !!settings.autoNext;
    elements.inputs.sessionBeep.checked = !!settings.sessionBeep;
    Sound.enabled = settings.soundEnabled !== false;
    elements.btnMute.textContent = Sound.enabled ? '🔈 Sound: On' : '🔇 Sound: Off';
  } catch (error) {
    console.warn('Failed to load settings:', error);
  }
}

function saveSettings() {
  const settings = getCurrentTotals();
  settings.autoNext = elements.inputs.autoNext.checked;
  settings.sessionBeep = elements.inputs.sessionBeep.checked;
  settings.soundEnabled = Sound.enabled;
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}

// ===== Helpers =====
function getCurrentTotals() {
  return {
    prep: +elements.inputs.prep.value || 0,
    work: +elements.inputs.work.value || 1,
    rest: +elements.inputs.rest.value || 0,
    rounds: Math.max(1, +elements.inputs.rounds.value || 1),
    cycles: Math.max(1, +elements.inputs.cycles.value || 1),
    longrest: +elements.inputs.longrest.value || 0
  };
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
  elements.stats.textContent =
    `Total session time: ${formatTime(total)} • Work: ${totals.work}s • Rest: ${totals.rest}s • Rounds: ${totals.rounds} • Cycles: ${totals.cycles}`;
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
  elements.clock.textContent = formatTime(state.remaining);
  updateProgressBars();
  updateSubline();
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
  if (Sound.audioCtx && Sound.audioCtx.state === 'suspended') {
    Sound.audioCtx.resume();
  }
  if (timer) timer.start();
  state.running = true;
  elements.btnStart.textContent = '▶ Start';
}

function pauseTimer() {
  if (timer) timer.pause();
  state.running = false;
  elements.btnStart.textContent = '▶ Start';
}

function stopTimer() {
  if (timer) timer.stop();
  state.running = false;
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