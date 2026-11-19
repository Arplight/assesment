/**
 * Unit tests for the rewards calculation engine.
 * Run: npm run test:server
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateRewards,
  compoundBalance,
  validateInput,
  periodsPerYear,
  toYears,
  MAX_PRINCIPAL,
} = require('./rewardsCalculator');

test('periodsPerYear maps frequencies', () => {
  assert.equal(periodsPerYear('daily'), 365);
  assert.equal(periodsPerYear('weekly'), 52);
  assert.equal(periodsPerYear('monthly'), 12);
  assert.equal(periodsPerYear('annually'), 1);
});

test('toYears converts days and years including fractions', () => {
  assert.equal(toYears(365, 'days'), 1);
  assert.equal(toYears(1.5, 'years'), 1.5);
  assert.equal(toYears(182.5, 'days'), 0.5);
});

test('standard daily compound: P=1000, APY=5%, 365 days', () => {
  const result = calculateRewards({
    principal: 1000,
    apy: 5,
    duration: 365,
    durationUnit: 'days',
    compoundingFrequency: 'daily',
  });

  const expected = 1000 * Math.pow(1 + 0.05 / 365, 365);
  assert.ok(Math.abs(result.projectedBalance - expected) < 1e-6);
  assert.ok(Math.abs(result.totalRewards - (expected - 1000)) < 1e-6);
  assert.equal(result.durationYears, 1);
  assert.equal(result.compoundingPeriodsPerYear, 365);
  assert.ok(result.chartData.length >= 2);
  assert.equal(result.chartData[0].balance, 1000);
  assert.equal(
    result.chartData[result.chartData.length - 1].balance,
    result.projectedBalance
  );
});

test('all compounding frequencies produce finite increasing balances for positive APY', () => {
  for (const frequency of ['daily', 'weekly', 'monthly', 'annually']) {
    const result = calculateRewards({
      principal: 1000,
      apy: 5,
      duration: 1,
      durationUnit: 'years',
      compoundingFrequency: frequency,
    });
    assert.ok(Number.isFinite(result.projectedBalance), frequency);
    assert.ok(result.projectedBalance > 1000, frequency);
    assert.equal(
      result.chartData[result.chartData.length - 1].balance,
      result.projectedBalance,
      frequency
    );
  }
});

test('supports 1.5 year fractional duration', () => {
  const result = calculateRewards({
    principal: 1000,
    apy: 8,
    duration: 1.5,
    durationUnit: 'years',
    compoundingFrequency: 'monthly',
  });
  const expected = 1000 * Math.pow(1 + 0.08 / 12, 12 * 1.5);
  assert.ok(Math.abs(result.projectedBalance - expected) < 1e-6);
  assert.equal(result.durationYears, 1.5);
});

test('zero APY returns principal with zero rewards', () => {
  const result = calculateRewards({
    principal: 2500,
    apy: 0,
    duration: 2,
    durationUnit: 'years',
    compoundingFrequency: 'annually',
  });
  assert.equal(result.projectedBalance, 2500);
  assert.equal(result.totalRewards, 0);
});

test('optional tokenPrice adds USD projections including zero price', () => {
  const priced = calculateRewards({
    principal: 100,
    apy: 10,
    duration: 1,
    durationUnit: 'years',
    compoundingFrequency: 'annually',
    tokenPrice: 2,
  });
  assert.equal(priced.projectedBalanceUsd, priced.projectedBalance * 2);
  assert.equal(priced.totalRewardsUsd, priced.totalRewards * 2);

  const zeroPrice = calculateRewards({
    principal: 100,
    apy: 10,
    duration: 1,
    durationUnit: 'years',
    compoundingFrequency: 'annually',
    tokenPrice: 0,
  });
  assert.equal(zeroPrice.projectedBalanceUsd, 0);
  assert.equal(zeroPrice.totalRewardsUsd, 0);
});

test('compoundBalance O(1) closed form matches known annual case', () => {
  assert.ok(Math.abs(compoundBalance(1000, 0.1, 1, 2) - 1210) < 1e-9);
});

test('chart points are chronologically ordered', () => {
  const result = calculateRewards({
    principal: 1000,
    apy: 5,
    duration: 2,
    durationUnit: 'years',
    compoundingFrequency: 'monthly',
    chartPoints: 20,
  });
  for (let i = 1; i < result.chartData.length; i += 1) {
    assert.ok(result.chartData[i].yearFraction >= result.chartData[i - 1].yearFraction);
    assert.ok(result.chartData[i].day >= result.chartData[i - 1].day);
  }
});

test('rejects invalid principal', () => {
  assert.throws(
    () =>
      validateInput({
        principal: 0,
        apy: 5,
        duration: 1,
        durationUnit: 'years',
        compoundingFrequency: 'daily',
      }),
    /principal/
  );
});

test('rejects principal above MAX_PRINCIPAL', () => {
  assert.throws(
    () =>
      calculateRewards({
        principal: MAX_PRINCIPAL + 1,
        apy: 5,
        duration: 1,
        durationUnit: 'years',
        compoundingFrequency: 'daily',
      }),
    /principal/
  );
});

test('rejects negative APY', () => {
  assert.throws(
    () =>
      calculateRewards({
        principal: 100,
        apy: -1,
        duration: 1,
        durationUnit: 'years',
        compoundingFrequency: 'daily',
      }),
    /apy/
  );
});

test('rejects invalid compounding frequency', () => {
  assert.throws(
    () =>
      calculateRewards({
        principal: 100,
        apy: 5,
        duration: 1,
        durationUnit: 'years',
        compoundingFrequency: 'hourly',
      }),
    /compoundingFrequency/
  );
});

test('rejects invalid durationUnit', () => {
  assert.throws(
    () =>
      calculateRewards({
        principal: 100,
        apy: 5,
        duration: 1,
        durationUnit: 'months',
        compoundingFrequency: 'daily',
      }),
    /durationUnit/
  );
});

test('rejects overflow / non-finite results', () => {
  assert.throws(
    () =>
      calculateRewards({
        principal: 1e15,
        apy: 1000,
        duration: 100,
        durationUnit: 'years',
        compoundingFrequency: 'daily',
      }),
    /overflow|finite/i
  );
});

test('rejects NaN-like non-finite inputs', () => {
  assert.throws(
    () =>
      validateInput({
        principal: Number.NaN,
        apy: 5,
        duration: 1,
        durationUnit: 'years',
        compoundingFrequency: 'daily',
      }),
    /principal/
  );
  assert.throws(
    () =>
      validateInput({
        principal: 100,
        apy: Number.POSITIVE_INFINITY,
        duration: 1,
        durationUnit: 'years',
        compoundingFrequency: 'daily',
      }),
    /apy/
  );
});

test('chart data length equals requested chartPoints', () => {
  const result = calculateRewards({
    principal: 1000,
    apy: 5,
    duration: 1,
    durationUnit: 'years',
    compoundingFrequency: 'weekly',
    chartPoints: 10,
  });
  assert.equal(result.chartData.length, 10);
});

test('documents nominal rate model (not effective APY conversion)', () => {
  const result = calculateRewards({
    principal: 1000,
    apy: 5,
    duration: 1,
    durationUnit: 'years',
    compoundingFrequency: 'monthly',
  });
  assert.equal(result.assumptions.rateModel, 'nominal');
  // Effective APY conversion would yield a different balance for monthly n=12.
  const effectiveStyle = 1000 * Math.pow(1.05, 1);
  assert.notEqual(result.projectedBalance, effectiveStyle);
});
