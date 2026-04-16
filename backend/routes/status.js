const express = require('express');
const config = require('../config/default');
const { TransferModel, EventModel, ApiLogModel, ConnectionModel } = require('../database/models');
const apiForwarder = require('../services/api-forwarder');
const dicomListener = require('../services/dicom-listener');

const router = express.Router();

/**
 * Helper: Convert SQLite UTC timestamp to ISO string for proper client-side conversion
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return null;
  // SQLite stores as "YYYY-MM-DD HH:MM:SS" in UTC
  // Add Z to indicate UTC so client can convert to local time
  return timestamp.replace(' ', 'T') + 'Z';
}

/**
 * Helper: Format transfer object timestamps
 */
function formatTransferTimestamps(transfer) {
  return {
    ...transfer,
    created_at: formatTimestamp(transfer.created_at),
    updated_at: formatTimestamp(transfer.updated_at),
    sent_at: formatTimestamp(transfer.sent_at)
  };
}

/**
 * Helper: Format event object timestamps
 */
function formatEventTimestamps(event) {
  return {
    ...event,
    timestamp: formatTimestamp(event.timestamp)
  };
}

/**
 * Helper: Format API log object timestamps
 */
function formatApiLogTimestamps(log) {
  return {
    ...log,
    timestamp: formatTimestamp(log.timestamp)
  };
}

/**
 * GET /api/config - Get frontend configuration (API URL)
 */
router.get('/config', (req, res) => {
  try {
    res.json({
      success: true,
      apiUrl: config.api.url || 'https://api-dicom-router.assist.id'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/status - Get overall system status
 */
router.get('/status', (req, res) => {
  try {
    const forwarderStatus = apiForwarder.getStatus();
    const dicomStatus = dicomListener.getStatus();
    const connections = ConnectionModel.getAll();
    const stats = TransferModel.getStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      forwarder: forwarderStatus,
      dicom: dicomStatus,
      connections: connections,
      stats: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/transfers - Get transfer logs
 */
router.get('/transfers', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const transfers = TransferModel.getRecent(limit);
    
    // Format timestamps for client-side local timezone conversion
    const formattedTransfers = transfers.map(formatTransferTimestamps);

    res.json({
      success: true,
      count: formattedTransfers.length,
      transfers: formattedTransfers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/transfers/:id - Get single transfer with API logs
 */
router.get('/transfers/:id', (req, res) => {
  try {
    const transfer = TransferModel.getById(req.params.id);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found'
      });
    }

    // Get API logs for this transfer
    const apiLogs = ApiLogModel.getByTransferId(req.params.id);
    
    // Format timestamps for client-side local timezone conversion
    const formattedTransfer = formatTransferTimestamps(transfer);
    const formattedApiLogs = (apiLogs || []).map(formatApiLogTimestamps);

    res.json({
      success: true,
      transfer: formattedTransfer,
      apiLogs: formattedApiLogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/events - Get recent events
 */
router.get('/events', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const events = EventModel.getRecent(limit);
    
    // Format timestamps for client-side local timezone conversion
    const formattedEvents = events.map(formatEventTimestamps);

    res.json({
      success: true,
      count: formattedEvents.length,
      events: formattedEvents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/logs - Get API logs
 */
router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = ApiLogModel.getRecent(limit);
    
    // Format timestamps for client-side local timezone conversion
    const formattedLogs = logs.map(formatApiLogTimestamps);

    res.json({
      success: true,
      count: formattedLogs.length,
      logs: formattedLogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/stats - Get statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = TransferModel.getStats();

    res.json({
      success: true,
      stats: {
        total: stats.total || 0,
        sent: stats.sent || 0,
        failed: stats.failed || 0,
        pending: stats.pending || 0,
        totalSize: stats.total_size || 0,
        successRate: stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
