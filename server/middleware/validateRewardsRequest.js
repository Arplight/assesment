const { ALLOWED_FREQUENCIES, ALLOWED_DURATION_UNITS } = require('../services/rewardsCalculator');

/**
 * Light HTTP-layer validation before the service runs deeper checks.
 * Coerces numeric strings so form clients and JSON both work.
 */
function validateRewardsRequest(req, res, next) {
  const body = req.body || {};
  const missing = [];

  ['principal', 'apy', 'duration', 'durationUnit', 'compoundingFrequency'].forEach((key) => {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      missing.push(key);
    }
  });

  if (missing.length) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missing.join(', ')}`,
    });
  }

  const principal = Number(body.principal);
  const apy = Number(body.apy);
  const duration = Number(body.duration);

  if (!Number.isFinite(principal) || !Number.isFinite(apy) || !Number.isFinite(duration)) {
    return res.status(400).json({
      success: false,
      message: 'principal, apy, and duration must be numeric',
    });
  }

  if (!ALLOWED_DURATION_UNITS.includes(body.durationUnit)) {
    return res.status(400).json({
      success: false,
      message: `durationUnit must be one of: ${ALLOWED_DURATION_UNITS.join(', ')}`,
    });
  }

  if (!ALLOWED_FREQUENCIES.includes(body.compoundingFrequency)) {
    return res.status(400).json({
      success: false,
      message: `compoundingFrequency must be one of: ${ALLOWED_FREQUENCIES.join(', ')}`,
    });
  }

  const normalized = {
    principal,
    apy,
    duration,
    durationUnit: body.durationUnit,
    compoundingFrequency: body.compoundingFrequency,
  };

  if (body.tokenPrice !== undefined && body.tokenPrice !== null && body.tokenPrice !== '') {
    const tokenPrice = Number(body.tokenPrice);
    if (!Number.isFinite(tokenPrice)) {
      return res.status(400).json({
        success: false,
        message: 'tokenPrice must be numeric when provided',
      });
    }
    normalized.tokenPrice = tokenPrice;
  }

  if (body.chartPoints !== undefined && body.chartPoints !== null && body.chartPoints !== '') {
    const chartPoints = Number(body.chartPoints);
    if (!Number.isFinite(chartPoints)) {
      return res.status(400).json({
        success: false,
        message: 'chartPoints must be numeric when provided',
      });
    }
    normalized.chartPoints = chartPoints;
  }

  req.body = normalized;
  return next();
}

module.exports = validateRewardsRequest;
