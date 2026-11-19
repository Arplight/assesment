/**
 * Staking rewards calculation engine (pure functions — no HTTP / UI).
 *
 * Mathematical assumption (APY):
 *   The `apy` input is treated as a NOMINAL annual rate in percent
 *   (e.g. 5 → r = 0.05), applied with the closed-form compound interest
 *   formula given in the assignment:
 *
 *     A = P * (1 + r/n)^(n*t)
 *
 *   This is NOT effective APY conversion. If product semantics required
 *   effective APY, the nominal rate would first be derived as:
 *     r = n * ((1 + APY)^(1/n) - 1)
 *
 * Complexity:
 *   - Final balance / rewards: O(1) time, O(1) space
 *   - Chart series of k points: O(k) time, O(k) space
 */

const COMPOUNDING = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  annually: 1,
};

const ALLOWED_FREQUENCIES = Object.keys(COMPOUNDING);
const ALLOWED_DURATION_UNITS = ['days', 'years'];

const DEFAULT_CHART_POINTS = 60;
const MAX_CHART_POINTS = 120;
/** Practical upper bound to avoid non-finite IEEE results (documented in README). */
const MAX_PRINCIPAL = 1e15;
const MAX_DURATION_YEARS = 100;

function periodsPerYear(frequency) {
  const n = COMPOUNDING[frequency];
  if (!n) {
    throw createValidationError(
      `Invalid compoundingFrequency. Allowed: ${ALLOWED_FREQUENCIES.join(', ')}`
    );
  }
  return n;
}

function toYears(duration, durationUnit) {
  if (!ALLOWED_DURATION_UNITS.includes(durationUnit)) {
    throw createValidationError(
      `Invalid durationUnit. Allowed: ${ALLOWED_DURATION_UNITS.join(', ')}`
    );
  }
  return durationUnit === 'days' ? duration / 365 : duration;
}

function createValidationError(message) {
  const err = new Error(message);
  err.status = 400;
  err.name = 'ValidationError';
  return err;
}

/**
 * Validate and normalize request-like input.
 * @returns {object} normalized fields
 */
function validateInput(input = {}) {
  const {
    principal,
    apy,
    duration,
    durationUnit,
    compoundingFrequency,
    tokenPrice,
    chartPoints,
  } = input;

  if (typeof principal !== 'number' || !Number.isFinite(principal) || principal <= 0) {
    throw createValidationError('principal must be a finite number greater than 0');
  }
  if (principal > MAX_PRINCIPAL) {
    throw createValidationError(`principal must be <= ${MAX_PRINCIPAL}`);
  }
  if (typeof apy !== 'number' || !Number.isFinite(apy) || apy < 0 || apy > 1000) {
    throw createValidationError('apy must be a finite number between 0 and 1000 (percent)');
  }
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    throw createValidationError('duration must be a finite number greater than 0');
  }
  if (durationUnit == null || typeof durationUnit !== 'string') {
    throw createValidationError('durationUnit is required (days | years)');
  }
  if (compoundingFrequency == null || typeof compoundingFrequency !== 'string') {
    throw createValidationError(
      `compoundingFrequency is required (${ALLOWED_FREQUENCIES.join(' | ')})`
    );
  }

  const n = periodsPerYear(compoundingFrequency);
  const t = toYears(duration, durationUnit);

  if (t <= 0 || t > MAX_DURATION_YEARS) {
    throw createValidationError(
      `duration must resolve to a period between 0 and ${MAX_DURATION_YEARS} years`
    );
  }

  let price = null;
  if (tokenPrice !== undefined && tokenPrice !== null && tokenPrice !== '') {
    if (typeof tokenPrice !== 'number' || !Number.isFinite(tokenPrice) || tokenPrice < 0) {
      throw createValidationError('tokenPrice must be a finite number >= 0 when provided');
    }
    price = tokenPrice;
  }

  let points = DEFAULT_CHART_POINTS;
  if (chartPoints !== undefined && chartPoints !== null) {
    if (
      typeof chartPoints !== 'number' ||
      !Number.isFinite(chartPoints) ||
      chartPoints < 2 ||
      chartPoints > MAX_CHART_POINTS
    ) {
      throw createValidationError(
        `chartPoints must be an integer between 2 and ${MAX_CHART_POINTS}`
      );
    }
    points = Math.floor(chartPoints);
  }

  return {
    principal,
    apy,
    duration,
    durationUnit,
    compoundingFrequency,
    tokenPrice: price,
    chartPoints: points,
    n,
    t,
    r: apy / 100,
  };
}

/**
 * Closed-form compound balance at time tYears. O(1).
 */
function compoundBalance(principal, r, n, tYears) {
  if (r === 0) return principal;
  return principal * Math.pow(1 + r / n, n * tYears);
}

/**
 * Build evenly spaced growth series from t=0..tYears. O(k).
 */
function buildChartData(principal, r, n, tYears, k) {
  const data = [];
  for (let i = 0; i < k; i += 1) {
    const fraction = i / (k - 1);
    const t = tYears * fraction;
    const balance = compoundBalance(principal, r, n, t);
    data.push({
      index: i,
      yearFraction: round(t, 6),
      day: round(t * 365, 4),
      balance: round(balance, 8),
    });
  }
  return data;
}

function round(value, digits) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Main entry: validate + calculate rewards + chart.
 */
function calculateRewards(input) {
  const v = validateInput(input);
  const finalBalance = compoundBalance(v.principal, v.r, v.n, v.t);
  const totalRewards = finalBalance - v.principal;

  if (!Number.isFinite(finalBalance) || !Number.isFinite(totalRewards)) {
    throw createValidationError(
      'Calculation overflow: result is not a finite number for the given inputs'
    );
  }

  const projectedBalance = round(finalBalance, 8);
  const roundedRewards = round(totalRewards, 8);
  const chartData = buildChartData(v.principal, v.r, v.n, v.t, v.chartPoints);

  // Guarantee last chart point matches the reported final balance (same rounding).
  if (chartData.length > 0) {
    chartData[chartData.length - 1].balance = projectedBalance;
    chartData[chartData.length - 1].yearFraction = round(v.t, 6);
    chartData[chartData.length - 1].day = round(v.t * 365, 4);
  }

  const result = {
    principal: v.principal,
    apy: v.apy,
    duration: v.duration,
    durationUnit: v.durationUnit,
    durationYears: round(v.t, 8),
    compoundingFrequency: v.compoundingFrequency,
    compoundingPeriodsPerYear: v.n,
    projectedBalance,
    totalRewards: roundedRewards,
    chartData,
    assumptions: {
      rateModel: 'nominal',
      formula: 'A = P * (1 + r/n)^(n*t)',
      note:
        'apy is interpreted as a nominal annual rate in percent, not effective APY.',
    },
  };

  if (v.tokenPrice !== null) {
    const balanceUsd = finalBalance * v.tokenPrice;
    const rewardsUsd = totalRewards * v.tokenPrice;
    if (!Number.isFinite(balanceUsd) || !Number.isFinite(rewardsUsd)) {
      throw createValidationError(
        'Calculation overflow: USD projection is not a finite number for the given inputs'
      );
    }
    result.tokenPrice = v.tokenPrice;
    result.projectedBalanceUsd = round(balanceUsd, 8);
    result.totalRewardsUsd = round(rewardsUsd, 8);
  }

  return result;
}

module.exports = {
  calculateRewards,
  validateInput,
  compoundBalance,
  buildChartData,
  periodsPerYear,
  toYears,
  COMPOUNDING,
  ALLOWED_FREQUENCIES,
  ALLOWED_DURATION_UNITS,
  MAX_PRINCIPAL,
  MAX_DURATION_YEARS,
};
