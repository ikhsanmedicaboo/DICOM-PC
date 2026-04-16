const express = require('express');
const dicomListener = require('../services/dicom-listener');
const logger = require('../services/logger');

const router = express.Router();

/**
 * POST /api/dicom/start - Start DICOM listener
 */
router.post('/start', async (req, res) => {
  try {
    if (dicomListener.isRunning) {
      return res.json({
        success: true,
        message: 'DICOM listener is already running',
        status: dicomListener.getStatus()
      });
    }

    await dicomListener.start();
    
    res.json({
      success: true,
      message: `DICOM listener started on port ${dicomListener.getStatus().port}`,
      status: dicomListener.getStatus()
    });
  } catch (error) {
    logger.error('Error starting DICOM listener:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/dicom/stop - Stop DICOM listener
 */
router.post('/stop', async (req, res) => {
  try {
    if (!dicomListener.isRunning) {
      return res.json({
        success: true,
        message: 'DICOM listener is already stopped',
        status: dicomListener.getStatus()
      });
    }

    await dicomListener.stop();
    
    res.json({
      success: true,
      message: 'DICOM listener stopped',
      status: dicomListener.getStatus()
    });
  } catch (error) {
    logger.error('Error stopping DICOM listener:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/dicom/toggle - Toggle DICOM listener
 */
router.post('/toggle', async (req, res) => {
  try {
    if (dicomListener.isRunning) {
      await dicomListener.stop();
      res.json({
        success: true,
        message: 'DICOM listener stopped',
        status: dicomListener.getStatus()
      });
    } else {
      await dicomListener.start();
      res.json({
        success: true,
        message: `DICOM listener started on port ${dicomListener.getStatus().port}`,
        status: dicomListener.getStatus()
      });
    }
  } catch (error) {
    logger.error('Error toggling DICOM listener:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/dicom/status - Get DICOM listener status
 */
router.get('/status', (req, res) => {
  try {
    res.json({
      success: true,
      status: dicomListener.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
