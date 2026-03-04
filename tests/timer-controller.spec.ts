import { test, expect } from '@playwright/test';
import { computeSessionTotal, TimerController } from '../timer.js';

/**
 * Timer Controller Unit Tests
 * Tests the pure timing/state logic of computeSessionTotal and TimerController.
 * These tests do not require a browser (no page fixture).
 */

test.describe('computeSessionTotal', () => {
  test('calculates correctly for simple totals', () => {
    const totals = { prep: 0, work: 30, rest: 30, rounds: 4, cycles: 1, longrest: 0 };
    // each round 60s, 4 rounds = 240
    expect(computeSessionTotal(totals)).toBe(240);
  });

  test('includes prep and long rest between cycles', () => {
    const totals = { prep: 10, work: 20, rest: 10, rounds: 2, cycles: 3, longrest: 60 };
    // one round = 30, per cycle = prep + round*2=10+60=70; session = 70*3 + longrest*2=210+120=330
    expect(computeSessionTotal(totals)).toBe(330);
  });

  test('handles zero rest', () => {
    const totals = { prep: 5, work: 20, rest: 0, rounds: 3, cycles: 1, longrest: 0 };
    // prep + 3*work = 5 + 60 = 65
    expect(computeSessionTotal(totals)).toBe(65);
  });

  test('single cycle single round', () => {
    const totals = { prep: 10, work: 20, rest: 10, rounds: 1, cycles: 1, longrest: 0 };
    // prep + work + rest = 40
    expect(computeSessionTotal(totals)).toBe(40);
  });
});

test.describe('TimerController', () => {
  test('initialization', () => {
    const totals = { prep: 5, work: 10, rest: 5, rounds: 2, cycles: 1, longrest: 0 };
    const controller = new TimerController(totals);
    const state = controller.getState();
    expect(state.phase).toBe('prepare');
    expect(state.remaining).toBe(5);
    expect(state.currentRound).toBe(1);
    expect(state.currentCycle).toBe(1);
    expect(state.running).toBe(false);
  });

  test('phase progression', () => {
    const totals = { prep: 2, work: 3, rest: 2, rounds: 2, cycles: 1, longrest: 0 };
    const controller = new TimerController(totals);
    controller.start();
    // after 2 ticks, prep done, to work
    controller._tick(); // remaining 1
    controller._tick(); // remaining 0, advance to work
    let state = controller.getState();
    expect(state.phase).toBe('work');
    expect(state.remaining).toBe(3);
  });

  test('session completion', () => {
    const totals = { prep: 1, work: 1, rest: 0, rounds: 1, cycles: 1, longrest: 0 };
    const controller = new TimerController(totals);
    controller.start();
    controller._tick(); // prep 0, to work
    controller._tick(); // work 0, to done
    const state = controller.getState();
    expect(state.phase).toBe('done');
  });

  test('multiple rounds', () => {
    // Simpler test: 1 second work, 1 second rest, 2 rounds
    const totals = { prep: 0, work: 1, rest: 1, rounds: 2, cycles: 1, longrest: 0 };
    const controller = new TimerController(totals);
    controller.start();
    
    // Initial: prep=0 so we're in work immediately (actually after first tick)
    // Tick 1: prep 0→work (remaining set to 1)
    controller._tick();
    let state = controller.getState();
    expect(state.phase).toBe('work');
    expect(state.remaining).toBe(1);
    expect(state.currentRound).toBe(1);
    
    // Tick 2: work 1→0, move to rest
    controller._tick();
    state = controller.getState();
    expect(state.phase).toBe('rest');
    expect(state.remaining).toBe(1);
    expect(state.currentRound).toBe(1);
    
    // Tick 3: rest 1→0, round complete, move to work round 2
    controller._tick();
    state = controller.getState();
    expect(state.phase).toBe('work');
    expect(state.remaining).toBe(1);
    expect(state.currentRound).toBe(2);
  });

  test('multiple cycles', () => {
    // 1 work + 2 longrest + 2 cycles = prep 0 is default
    const totals = { prep: 0, work: 1, rest: 0, rounds: 1, cycles: 2, longrest: 1 };
    const controller = new TimerController(totals);
    controller.start();
    
    // Tick 1: prep 0→work
    controller._tick();
    let state = controller.getState();
    expect(state.phase).toBe('work');
    expect(state.remaining).toBe(1);
    expect(state.currentRound).toBe(1);
    expect(state.currentCycle).toBe(1);
    
    // Tick 2: work 1→0, rounds=1 so round complete, cycles 1<2 so to longrest
    controller._tick();
    state = controller.getState();
    expect(state.phase).toBe('longrest');
    expect(state.remaining).toBe(1);
    expect(state.currentRound).toBe(1);
    expect(state.currentCycle).toBe(2);
    
    // Tick 3: longrest 1→0, to work cycle 2
    controller._tick();
    state = controller.getState();
    expect(state.phase).toBe('work');
    expect(state.remaining).toBe(1);
    expect(state.currentRound).toBe(1);
    expect(state.currentCycle).toBe(2);
    
    // Tick 4: work 1→0, done
    controller._tick();
    state = controller.getState();
    expect(state.phase).toBe('done');
  });

  test('reset returns to initial state', () => {
    const totals = { prep: 1, work: 1, rest: 0, rounds: 1, cycles: 1, longrest: 0 };
    const controller = new TimerController(totals);
    controller.start();
    expect(controller.getState().running).toBe(true);
    
    controller._tick(); // prep 1→0, move to work
    // In the app, stopTimer() is called before reset
    controller.pause();
    controller.reset();
    const state = controller.getState();
    expect(state.phase).toBe('prepare');
    expect(state.remaining).toBe(1);
    expect(state.currentRound).toBe(1);
    expect(state.currentCycle).toBe(1);
    expect(state.running).toBe(false);
  });

  test('pause and resume', () => {
    const totals = { prep: 2, work: 2, rest: 0, rounds: 1, cycles: 1, longrest: 0 };
    const controller = new TimerController(totals);
    controller.start();
    controller._tick(); // remaining 1
    controller.pause();
    let state = controller.getState();
    expect(state.running).toBe(false);
    expect(state.remaining).toBe(1);
    controller.start(); // resume
    state = controller.getState();
    expect(state.running).toBe(true);
    controller._tick(); // remaining 0, to work
    state = controller.getState();
    expect(state.phase).toBe('work');
    expect(state.remaining).toBe(2);
  });
});
