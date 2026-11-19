const { calculateRewards } = require('../services/rewardsCalculator');

/**
 * POST /api/calculate-rewards
 */
function calculateRewardsHandler(req, res, next) {
  try {
    const result = calculateRewards(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.name === 'ValidationError' || err.status === 400) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

module.exports = { calculateRewardsHandler };
