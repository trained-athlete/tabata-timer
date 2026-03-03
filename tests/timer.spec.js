const { test, expect } = require('@playwright/test');
const { computeSessionTotal } = require('../timer.js');

// simple unit tests for computeSessionTotal

test('computeSessionTotal calculates correctly for simple totals', () => {
  const totals = { prep: 0, work: 30, rest: 30, rounds: 4, cycles: 1, longrest: 0 };
  // each round 60s, 4 rounds = 240
  expect(computeSessionTotal(totals)).toBe(240);
});

test('computeSessionTotal includes prep and long rest between cycles', () => {
  const totals = { prep: 10, work: 20, rest: 10, rounds: 2, cycles: 3, longrest: 60 };
  // one round = 30, per cycle = prep + round*2=10+60=70; session = 70*3 + longrest*2=210+120=330
  expect(computeSessionTotal(totals)).toBe(330);
});