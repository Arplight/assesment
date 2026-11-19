const express = require('express');
const validateRewardsRequest = require('../../middleware/validateRewardsRequest');
const { calculateRewardsHandler } = require('../../controllers/rewardsController');

const router = express.Router();

// @route   POST /api/calculate-rewards
// @desc    Project staking balance and rewards (compound interest)
// @access  Public
router.post('/calculate-rewards', validateRewardsRequest, calculateRewardsHandler);

module.exports = router;
