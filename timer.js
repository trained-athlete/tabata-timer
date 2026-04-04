// TimerController: pure timing/state logic with callbacks
export class TimerController {
  constructor(totals, { autoNext = true, onTick = () => {}, onPhase = () => {}, onDone = () => {}, onWarning = () => {} } = {}) {
    this.totals = { ...totals };
    this.autoNext = !!autoNext;
    this.onTick = onTick;
    this.onPhase = onPhase;
    this.onDone = onDone;
    this.onWarning = onWarning;

    this.timerId = null;
    this.running = false;
    this.warningTriggered = false;
    this.reset(this.totals);
  }

  computeSessionTotal(totals) {
    const oneRound = totals.work + totals.rest;
    const perCycle = totals.prep + (oneRound * totals.rounds);
    const betweenCycles = (totals.cycles > 1) ? (totals.longrest * (totals.cycles - 1)) : 0;
    return (perCycle * totals.cycles) + betweenCycles;
  }

  getState() {
    return {
      phase: this.phase,
      remaining: this.remaining,
      currentRound: this.currentRound,
      currentCycle: this.currentCycle,
      sessionTotalSeconds: this.sessionTotalSeconds,
      sessionElapsedSeconds: this.sessionElapsedSeconds,
      totals: { ...this.totals },
      running: this.running
    };
  }

  setAutoNext(val) {
    this.autoNext = !!val;
  }

  reset(totals = this.totals) {
    this.totals = { ...totals };
    this.currentRound = 1;
    this.currentCycle = 1;
    this.phase = 'prepare';
    this.remaining = this.totals.prep;
    this.sessionTotalSeconds = this.computeSessionTotal(this.totals);
    this.sessionElapsedSeconds = 0;
    this.warningTriggered = false;
    this.onPhase(this.getState());
    this.onTick(this.getState());
  }

  start() {
    if (this.running) return;
    this.running = true;
    if (!this.timerId) {
      this.timerId = setInterval(() => this._tick(), 1000);
    }
  }

  pause() {
    this.running = false;
  }

  stop() {
    this.running = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  skip() {
    if (this.phase === 'done') return;
    this._advanceToNextPhase();
  }

  _tick() {
    if (!this.running) return;
    this.remaining = Math.max(0, this.remaining - 1);
    this.sessionElapsedSeconds = Math.min(this.sessionTotalSeconds, this.sessionElapsedSeconds + 1);
    
    // Trigger warning sound 3 seconds before work or rest begins
    if ((this.phase === 'work' || this.phase === 'rest') && this.remaining === 3 && !this.warningTriggered) {
      this.warningTriggered = true;
      this.onWarning(this.getState());
    }
    
    this.onTick(this.getState());

    if (this.remaining <= 0 && this.phase !== 'done' && this.autoNext) {
      this._advanceToNextPhase();
    }
  }

  _advanceToNextPhase() {
    const totals = this.totals;
    if (this.phase === 'prepare') {
      this.phase = 'work';
      this.remaining = totals.work;
    } else if (this.phase === 'work') {
      if (this.currentRound < totals.rounds && totals.rest > 0) {
        this.phase = 'rest';
        this.remaining = totals.rest;
      } else {
        this._handleRoundCompletion();
      }
    } else if (this.phase === 'rest') {
      this._handleRoundCompletion();
    } else if (this.phase === 'longrest') {
      this.currentRound = 1;
      this.phase = 'work';
      this.remaining = totals.work;
    }

    this.warningTriggered = false;
    this.onPhase(this.getState());
    this.onTick(this.getState());
    if (this.phase === 'done') this.onDone();
  }

  _handleRoundCompletion() {
    const totals = this.totals;
    if (this.currentRound < totals.rounds) {
      this.currentRound++;
      this.phase = 'work';
      this.remaining = totals.work;
    } else {
      this._handleCycleCompletion();
    }
  }

  _handleCycleCompletion() {
    const totals = this.totals;
    if (this.currentCycle < totals.cycles) {
      this.currentCycle++;
      if (totals.longrest > 0) {
        this.phase = 'longrest';
        this.remaining = totals.longrest;
      } else {
        this.phase = 'work';
        this.remaining = totals.work;
        this.currentRound = 1;
      }
    } else {
      this.phase = 'done';
      this.remaining = 0;
      this.stop();
    }
  }
}
