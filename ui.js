// UI helpers: DOM element caching and rendering logic
// All functions are pure wrt. state; they take parameters rather than relying on globals.

// helper used by multiple renderers
export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

// grab references to the nodes we care about once
export const elements = {
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

// some info labels are siblings; populate after DOM ready
if (elements.labels.work) elements.labels.workInfo = elements.labels.work.nextElementSibling;
if (elements.labels.rest) elements.labels.restInfo = elements.labels.rest.nextElementSibling;
if (elements.labels.rounds) elements.labels.roundsInfo = elements.labels.rounds.nextElementSibling;

import { PHASE_LABELS } from './constants.js';

export function setPhase(elementsObj, phase, totals = {}) {
  const el = elementsObj.phaseBadge;
  if (!el) return;
  el.className = 'phase ' + (phase === 'done' ? 'done' : phase);
  el.textContent = PHASE_LABELS[phase] || phase;
}

export function updateSubline(elementsObj, state) {
  if (!elementsObj.subline) return;
  elementsObj.subline.textContent = (state.phase === 'longrest' || state.phase === 'done')
    ? `Cycle ${state.currentCycle} / ${state.totals.cycles}`
    : `Round ${state.currentRound} / ${state.totals.rounds} • Cycle ${state.currentCycle} / ${state.totals.cycles}`;
}

function getIntervalDuration(state, phase) {
  switch (phase) {
    case 'prepare': return state.totals.prep;
    case 'work': return state.totals.work;
    case 'rest': return state.totals.rest;
    case 'longrest': return state.totals.longrest;
    default: return 1;
  }
}

export function updateProgressBars(elementsObj, state) {
  if (elementsObj.intervalProgress) {
    const totalInterval = getIntervalDuration(state, state.phase);
    const intervalPercent = totalInterval ? (1 - state.remaining / totalInterval) * 100 : 100;
    elementsObj.intervalProgress.style.width = `${Math.min(100, Math.max(0, intervalPercent))}%`;
  }
  if (elementsObj.sessionProgress) {
    const sessionPercent = state.sessionTotalSeconds ? (state.sessionElapsedSeconds / state.sessionTotalSeconds) * 100 : 0;
    elementsObj.sessionProgress.style.width = `${Math.min(100, Math.max(0, sessionPercent))}%`;
  }
}

export function renderClock(elementsObj, state, currentMode) {
  // For EMOM mode, display remaining time in the current minute (work+rest = 60s)
  let displayRemaining = state.remaining;
  if (currentMode === 'emom') {
    if (state.phase === 'work') {
      displayRemaining = state.remaining + (state.totals.rest || 0);
    } else {
      displayRemaining = state.remaining;
    }
  }
  if (elementsObj.clock) {
    elementsObj.clock.textContent = formatTime(displayRemaining);
  }
  updateProgressBars(elementsObj, state);
  updateSubline(elementsObj, state);
  // show total remaining workout time in the footer summary
  if (elementsObj.summary) {
    const totalLeft = Math.max(0, (state.sessionTotalSeconds || 0) - (state.sessionElapsedSeconds || 0));
    elementsObj.summary.textContent = (currentMode === 'emom') ? `Total remaining: ${formatTime(totalLeft)}` : '';
  }
}

// update visible labels based on mode; caller should call when mode changes
import { computeSessionTotal } from './timer.js';

export function renderStats(elementsObj, totals, currentMode) {
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
  if (elementsObj.stats) elementsObj.stats.textContent = parts.join(' • ');
}

export function updateModeLabels(elementsObj, currentMode) {
  const { work, workInfo, rest, restInfo, rounds, roundsInfo } = elementsObj.labels;
  if (work) {
    if (currentMode === 'fortime' || currentMode === 'amrap') {
      work.textContent = 'Duration (sec)';
      if (workInfo) workInfo.textContent = '';
    } else {
      work.textContent = 'Work (sec)';
      if (workInfo) workInfo.textContent = 'High-intensity interval';
    }
  }
  if (rest) {
    if (currentMode === 'emom') {
      rest.textContent = 'Rest (auto)';
      if (restInfo) restInfo.textContent = 'Calculated as 60 - work';
    } else {
      rest.textContent = 'Rest (sec)';
      if (restInfo) restInfo.textContent = 'Recovery interval';
    }
  }
  if (rounds) {
    if (currentMode === 'emom') {
      rounds.textContent = 'Minutes';
      if (roundsInfo) roundsInfo.textContent = 'Number of minutes';
    } else {
      rounds.textContent = 'Rounds per cycle';
      if (roundsInfo) roundsInfo.textContent = 'Work+Rest repetitions';
    }
  }
}

// helpers for adjusting numeric input constraints, appropriate for EMOM vs others
// helpers for adjusting numeric input constraints, appropriate for EMOM vs others
export function adjustRoundsConstraints(elementsObj, currentMode) {
  const input = elementsObj.inputs && elementsObj.inputs.rounds;
  if (!input) return;
  if (currentMode === 'emom') {
    input.setAttribute('min', '10');
    input.setAttribute('max', '60');
    if (+input.value < 10) input.value = 10;
  } else {
    input.setAttribute('min', '1');
    input.setAttribute('max', '9999');
    if (+input.value < 1) input.value = 1;
  }
}
