const express = require('express');
const apiForwarder = require('../services/api-forwarder');
const config = require('../config/default');
const logger = require('../services/logger');

const router = express.Router();

/**
 * POST /api/validate/api - Test API connection
 */
router.post('/api', async (req, res) => {
  try {
    const result = await apiForwarder.testConnection();

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/validate/auth - Validate API authentication
 */
router.post('/auth', (req, res) => {
  try {
    const hasHospitalId = !!config.api.hospitalId;
    const hasKey = !!config.api.key;

    if (!hasHospitalId || !hasKey) {
      return res.json({
        success: false,
        message: 'Authentication not properly configured',
        details: {
          hospitalId: hasHospitalId,
          apiKey: hasKey
        }
      });
    }

    res.json({
      success: true,
      message: 'Authentication configured',
      details: {
        hospitalId: config.api.hospitalId,
        apiKey: hasKey,
        authType: 'Token-based (hospital_id + api_key)'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/forwarder/start - Start API forwarder
 */
router.post('/forwarder/start', (req, res) => {
  try {
    apiForwarder.start();
    
    res.json({
      success: true,
      message: 'API forwarder started'
    });
  } catch (error) {
    logger.error('Failed to start API forwarder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/forwarder/stop - Stop API forwarder
 */
router.post('/forwarder/stop', (req, res) => {
  try {
    apiForwarder.stop();
    
    res.json({
      success: true,
      message: 'API forwarder stopped'
    });
  } catch (error) {
    logger.error('Failed to stop API forwarder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
