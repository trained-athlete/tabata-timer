// ===== Constants =====
const LS_KEY = 'tabata.settings.v1';
const PHASE_LABELS = {
  prepare: 'Prepare',
  work: 'Work',
  rest: 'Rest',
  longrest: 'Long Rest',
  done: 'Done'
};

// ===== Utility Functions =====
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

// ===== Sound Module =====
const Sound = {
  enabled: true,
  audioCtx: typeof AudioContext !== 'undefined' ? new AudioContext() : null,

  beep(freq = 880, duration = 0.18, type = 'sine', volume = 0.08) {
    if (!this.audioCtx || !this.enabled) return;
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gainNode.gain.value = volume;
    oscillator.connect(gainNode).connect(this.audioCtx.destination);
    oscillator.start();
    oscillator.stop(this.audioCtx.currentTime + duration);
  },

  tripleCountdown() {
    [660, 660, 990].forEach((freq, index) => {
      setTimeout(() => this.beep(freq, 0.12), index * 200);
    });
  },

  bell() {
    this.beep(440, 0.25, 'triangle', 0.12);
    this.beep(880, 0.25, 'sine', 0.08);
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
  timerId: null,
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

function advanceToNextPhase() {
  const totals = state.totals;
  if (state.phase === 'prepare') {
    state.phase = 'work';
    state.remaining = totals.work;
  } else if (state.phase === 'work') {
    if (state.currentRound < totals.rounds && totals.rest > 0) {
      state.phase = 'rest';
      state.remaining = totals.rest;
    } else {
      handleRoundCompletion();
    }
  } else if (state.phase === 'rest') {
    handleRoundCompletion();
  } else if (state.phase === 'longrest') {
    state.currentRound = 1;
    state.phase = 'work';
    state.remaining = totals.work;
  }

  playPhaseSound();
  setPhase(state.phase);
  renderClock();
}

function handleRoundCompletion() {
  const totals = state.totals;
  if (state.currentRound < totals.rounds) {
    state.currentRound++;
    state.phase = 'work';
    state.remaining = totals.work;
  } else {
    handleCycleCompletion();
  }
}

function handleCycleCompletion() {
  const totals = state.totals;
  if (state.currentCycle < totals.cycles) {
    state.currentCycle++;
    if (totals.longrest > 0) {
      state.phase = 'longrest';
      state.remaining = totals.longrest;
    } else {
      state.phase = 'work';
      state.remaining = totals.work;
      state.currentRound = 1;
    }
  } else {
    state.phase = 'done';
    state.remaining = 0;
    stopTimer();
  }
}

function playPhaseSound() {
  if (!elements.inputs.sessionBeep.checked) return;
  if (state.phase === 'work') Sound.bell();
  else if (state.phase === 'rest') Sound.tripleCountdown();
  else if (state.phase === 'longrest') Sound.beep(520, 0.18);
  else if (state.phase === 'done') Sound.bell();
}

function tick() {
  if (!state.running) return;
  state.remaining = Math.max(0, state.remaining - 1);
  state.sessionElapsedSeconds = Math.min(state.sessionTotalSeconds, state.sessionElapsedSeconds + 1);
  renderClock();
  if (state.remaining <= 0 && state.phase !== 'done' && elements.inputs.autoNext.checked) {
    advanceToNextPhase();
  }
}

function startTimer() {
  if (state.running) return;
  if (Sound.audioCtx && Sound.audioCtx.state === 'suspended') {
    Sound.audioCtx.resume();
  }
  state.running = true;
  elements.btnStart.textContent = '▶ Start';
  if (!state.timerId) {
    state.timerId = setInterval(tick, 1000);
  }
}

function pauseTimer() {
  state.running = false;
  elements.btnStart.textContent = '▶ Start';
}

function stopTimer() {
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function resetSession() {
  stopTimer();
  state.totals = getCurrentTotals();
  state.currentRound = 1;
  state.currentCycle = 1;
  state.phase = 'prepare';
  state.remaining = state.totals.prep;
  state.sessionTotalSeconds = computeSessionTotal(state.totals);
  state.sessionElapsedSeconds = 0;
  setPhase('prepare');
  renderClock();
  updateStats();
  elements.summary.textContent = '';
}

function skipInterval() {
  if (state.phase === 'done') return;
  advanceToNextPhase();
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
Object.values(elements.inputs).forEach(input => {
  if (input.addEventListener) {
    input.addEventListener('change', () => {
      saveSettings();
      resetSession();
    });
  }
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
loadSettings();
resetSession();