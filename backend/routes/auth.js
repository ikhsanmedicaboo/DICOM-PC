const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/default');
const logger = require('../services/logger');

const router = express.Router();

const credentialStorePath = process.env.AUTH_STORE_PATH || path.join(path.dirname(config.storage.dbPath), 'auth.json');

async function loadPersistedCredentials() {
  try {
    if (!await fs.pathExists(credentialStorePath)) {
      return;
    }

    const stored = await fs.readJson(credentialStorePath);
    if (!stored || !stored.hospitalId || !stored.apiKey) {
      return;
    }

    config.api.runtimeHospitalId = stored.hospitalId;
    config.api.runtimeKey = stored.apiKey;
    config.api.runtimeHospitalName = stored.hospitalName || '';
    logger.info(`Loaded persisted credentials for Hospital ID: ${stored.hospitalId}`);
  } catch (error) {
    logger.warn(`Unable to load persisted credentials: ${error.message}`);
  }
}

async function persistCredentials(hospitalId, apiKey, hospitalName) {
  try {
    await fs.ensureDir(path.dirname(credentialStorePath));
    await fs.writeJson(credentialStorePath, {
      hospitalId,
      apiKey,
      hospitalName: hospitalName || '',
      updatedAt: new Date().toISOString()
    }, { spaces: 2 });
  } catch (error) {
    logger.warn(`Unable to persist credentials: ${error.message}`);
  }
}

// Load once during route initialization so restart can restore login state.
loadPersistedCredentials();

function getHospitalName(authResponse) {
  if (!authResponse || !authResponse.data) {
    return '';
  }

  return authResponse.data.hospitalName || authResponse.data.hospital_name || authResponse.data.name || '';
}

async function authenticateAgainstApi(hospitalId, apiKey) {
  const authUrl = `${config.api.url}${config.api.endpoints.authenticate}`;
  console.log(`Authenticating against API at ${authUrl} with Hospital ID: ${hospitalId}`);
  console.log({
    headers: {
      hospital_id: hospitalId,
      api_key: apiKey,
      'Content-Type': 'application/json'
    },
    timeout: 0,
    validateStatus: function (status) {
      // Return true for status < 500 to handle 401/403 as response
      return status < 500;
    }
  })
  return axios.post(authUrl, {}, {
    headers: {
      hospital_id: hospitalId,
      api_key: apiKey,
      'Content-Type': 'application/json'
    },
    timeout: 0,
    validateStatus: function (status) {
      // Return true for status < 500 to handle 401/403 as response
      return status < 500;
    }
  });
}

/**
 * POST /api/auth/validate - Validate hospital credentials
 */
router.post('/validate', async (req, res) => {
  try {
    const { hospital_id, api_key } = req.body;

    // Validate input
    if (!hospital_id || !api_key) {
      return res.status(400).json({
        success: false,
        message: 'Hospital ID and API Key are required'
      });
    }

    logger.info(`Validating credentials for Hospital ID: ${hospital_id}`);

    // Test authentication with the external API
    try {
      const response = await authenticateAgainstApi(hospital_id, api_key);

      if (response.status === 200 && response.data && response.data.success) {
        const hospitalName = getHospitalName(response.data);

        // Credentials are valid - store them in runtime config
        config.api.runtimeHospitalId = hospital_id;
        config.api.runtimeKey = api_key;
        config.api.runtimeHospitalName = hospitalName;
        await persistCredentials(hospital_id, api_key, hospitalName);

        logger.info(`✓ Credentials validated successfully for Hospital ID: ${hospital_id}`);
        logger.info(`Token received: ${response.data.data && response.data.data.token ? 'Yes' : 'No'}`);

        return res.json({
          success: true,
          message: 'Credentials validated successfully',
          data: {
            hospital_id: hospital_id,
            hospital_name: hospitalName,
            authenticated: true
          }
        });
      } else {
        // Authentication failed
        const errorMessage = (response.data && response.data.message) || 'Invalid credentials';
        logger.warn(`✗ Credential validation failed for Hospital ID: ${hospital_id} - ${errorMessage}`);

        return res.status(401).json({
          success: false,
          message: errorMessage
        });
      }

    } catch (apiError) {
      // Handle API connection errors
      logger.error(`API validation error for Hospital ID ${hospital_id}:`, apiError.message);

      if (apiError.response) {
        // The server responded with an error status
        return res.status(401).json({
          success: false,
          message: (apiError.response.data && apiError.response.data.message) || 'Invalid credentials'
        });
      } else if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ETIMEDOUT') {
        // Connection failed
        return res.status(503).json({
          success: false,
          message: 'Unable to connect to authentication server. Please check your network connection.'
        });
      } else {
        // Other errors
        return res.status(500).json({
          success: false,
          message: 'Authentication service error: ' + apiError.message
        });
      }
    }

  } catch (error) {
    logger.error('Validation endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during validation'
    });
  }
});

/**
 * POST /api/auth/auto-login - Auto authenticate using configured credentials
 */
router.post('/auto-login', async (req, res) => {
  try {
    const hospitalId = config.api.runtimeHospitalId || config.api.hospitalId;
    const apiKey = config.api.runtimeKey || config.api.key;

    if (!hospitalId || !apiKey) {
      return res.json({
        success: true,
        authenticated: false,
        message: 'Auto login skipped: missing configured credentials'
      });
    }

    logger.info(`Attempting auto-login for Hospital ID: ${hospitalId}`);

    const response = await authenticateAgainstApi(hospitalId, apiKey);

    if (response.status === 200 && response.data && response.data.success) {
      const hospitalName = getHospitalName(response.data);

      config.api.runtimeHospitalId = hospitalId;
      config.api.runtimeKey = apiKey;
      config.api.runtimeHospitalName = hospitalName;
      await persistCredentials(hospitalId, apiKey, hospitalName);

      logger.info(`✓ Auto-login successful for Hospital ID: ${hospitalId}`);

      return res.json({
        success: true,
        authenticated: true,
        message: 'Auto login successful',
        data: {
          hospital_id: hospitalId,
          hospital_name: hospitalName
        }
      });
    }

    const errorMessage = (response.data && response.data.message) || 'Invalid configured credentials';
    logger.warn(`✗ Auto-login failed for Hospital ID: ${hospitalId} - ${errorMessage}`);

    return res.status(401).json({
      success: false,
      authenticated: false,
      message: errorMessage
    });
  } catch (error) {
    logger.error('Auto-login error:', error.message);

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        authenticated: false,
        message: 'Unable to connect to authentication server for auto login.'
      });
    }

    return res.status(500).json({
      success: false,
      authenticated: false,
      message: 'Auto login failed: ' + error.message
    });
  }
});

/**
 * GET /api/auth/status - Get current authentication status
 */
router.get('/status', (req, res) => {
  const runtimeHospitalId = config.api.runtimeHospitalId || null;
  const runtimeHospitalName = config.api.runtimeHospitalName || null;
  const isAuthenticated = !!(config.api.runtimeHospitalId && config.api.runtimeKey);

  res.json({
    success: true,
    authenticated: isAuthenticated,
    hospital_id: runtimeHospitalId,
    hospital_name: runtimeHospitalName
  });
});

module.exports = router;
