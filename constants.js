// Shared constants used across modules

export const LS_KEY = 'tabata.settings.v1';

export const PHASE_LABELS = {
  prepare: 'Prepare',
  work: 'Work',
  rest: 'Rest',
  longrest: 'Long Rest',
  done: 'Done'
};

export const MODES = ['tabata', 'emom', 'fortime', 'amrap'];

// keys saved to localStorage (same ordering used when saving/loading)
export const SETTING_KEYS = ['prep','work','rest','rounds','cycles','longrest'];