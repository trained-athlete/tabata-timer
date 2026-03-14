// ===== Constants =====
import { LS_KEY, PHASE_LABELS, MODES, SETTING_KEYS } from './constants.js';
let currentMode = 'tabata';

function modeLabel(mode) {
  switch (mode) {
    case 'tabata':
      return 'Tabata Timer';
    case 'emom':
      return 'EMOM Timer';
    default:
      return 'Timer';
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
  document
    .querySelectorAll('.mode-btn')
    .forEach((btn) => {
      function resetSession() {
        stopTimer();
        elements.btnStart.textContent = '▶ Start';  // Add this line
        const totals = getCurrentTotals();
        if (timer) timer.reset(totals);
        // ... rest of the function
      }      function resetSession() {
        stopTimer();
        elements.btnStart.textContent = '▶ Start';  // Add this line
        const totals = getCurrentTotals();
        if (timer) timer.reset(totals);
        // ... rest of the function
      }      const isSelected = btn.getAttribute('data-mode') === mode;
      if (isSelected) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  // class used by CSS and some JS
  document
    .querySelector('.app')
    .classList.toggle('emom', mode === 'emom');
  updateSettingsVisibility();
  updateModeLabels(elements, mode);
  adjustRoundsConstraints(elements, mode);
  resetSession();
}

function updateSettingsVisibility() {
  document.querySelectorAll('.field[data-modes]').forEach((el) => {
    const modes = el.getAttribute('data-modes').split(/\s+/);
    if (modes.includes(currentMode)) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

// Timer controller (refactored to separate file)
import { TimerController, computeSessionTotal } from './timer.js';
import { Sound } from './sound.js';
import {
  elements,
  formatTime,
  renderStats,
  setPhase,
  renderClock,
  updateModeLabels,
  adjustRoundsConstraints
} from './ui.js';

function resumeOnActivation() {
  Sound.ensureUnlocked();
}
window.addEventListener('focus', resumeOnActivation);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resumeOnActivation();
});

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
    SETTING_KEYS.forEach((key) => {
      if (typeof settings[key] === 'number') {
        elements.inputs[key].value = settings[key];
      }
    });
    elements.inputs.autoNext.checked = !!settings.autoNext;
    elements.inputs.sessionBeep.checked = !!settings.sessionBeep;
    Sound.enabled = settings.soundEnabled !== false;
    elements.btnMute.textContent = Sound.enabled
      ? '🔈 Sound: On'
      : '🔇 Sound: Off';
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
      rest: 0,
      rounds: Math.max(1, +inputs.rounds.value || 1),
      cycles: 1,
      longrest: 0
    };
  }
};

function getCurrentTotals() {
  const builder =
    TOTALS_BUILDERS[currentMode] || TOTALS_BUILDERS.tabata;
  return builder(elements.inputs);
}

function playPhaseSound() {
  if (!elements.inputs.sessionBeep.checked) return;
  if (currentMode === 'emom') {
    if (state.phase === 'work') Sound.shortBeep();
    else if (state.phase === 'done') Sound.bell();
  } else {
    if (state.phase === 'work') Sound.bell();
    else if (state.phase === 'rest') Sound.tripleCountdown();
    else if (state.phase === 'longrest') Sound.beep(520, 0.18);
    else if (state.phase === 'done') Sound.bell();
  }
}

function playWarningSound() {
  if (!elements.inputs.sessionBeep.checked) return;
  Sound.warning();
}

let timer = null;

function startTimer() {
  if (state.running) return;
  Sound.init();
  Sound.ensureUnlocked().then(() => {
    Sound.requestWakeLock();
  });
  if (timer) timer.start();
  state.running = true;
  elements.btnStart.textContent = 'Running';
}

function pauseTimer() {
  if (timer) timer.pause();
  state.running = false;
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
  elements.btnStart.textContent = '▶ Start';
  const totals = getCurrentTotals();
  if (timer) timer.reset(totals);
  Object.assign(
    state,
    timer ? timer.getState() : { phase: 'prepare', remaining: totals.prep, totals }
  );
  setPhase(elements, state.phase);
  renderStats(elements, getCurrentTotals(), currentMode);
  elements.summary.textContent = '';
}

function skipInterval() {
  if (timer) timer.skip();
}

// ===== Event Bindings =====
document.querySelectorAll('.mode-btn').forEach((btn) => {
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
  elements.btnMute.textContent = Sound.enabled
    ? '🔈 Sound: On'
    : '🔇 Sound: Off';
  saveSettings();
});

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
if (!MODES.includes(currentMode)) {
  setMode('tabata');
} else {
  updateSettingsVisibility();
  updateModeLabels(elements, currentMode);
  adjustRoundsConstraints(elements, currentMode);
}

function createTimer() {
  return new TimerController(getCurrentTotals(), {
    autoNext: elements.inputs.autoNext.checked,
    onTick: (s) => {
      Object.assign(state, s);
      renderClock(elements, state, currentMode);
    },
    onPhase: (s) => {
      Object.assign(state, s);
      playPhaseSound();
      setPhase(elements, s.phase);
      renderClock(elements, state, currentMode);
    },
    onWarning: (s) => {
      playWarningSound();
    },
    onDone: () => {
      setPhase(elements, 'done');
      renderClock(elements, state, currentMode);
    }
  });
}

timer = createTimer();
resetSession();