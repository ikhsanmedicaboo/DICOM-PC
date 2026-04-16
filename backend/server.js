const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const config = require('./config/default');
const logger = require('./services/logger');
const apiForwarder = require('./services/api-forwarder');
const dicomListener = require('./services/dicom-listener');

// Import routes
const statusRoutes = require('./routes/status');
const validationRoutes = require('./routes/validation');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const dicomRoutes = require('./routes/dicom');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for local development
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api', statusRoutes);
app.use('/api/validate', validationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api/dicom', dicomRoutes);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.emit('connected', {
    message: 'Connected to DICOM Router',
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  // Request status update
  socket.on('requestStatus', () => {
    emitStatus();
  });
});

// Emit status updates via Socket.IO
function emitStatus() {
  const forwarderStatus = apiForwarder.getStatus();
  const dicomStatus = dicomListener.getStatus();

  io.emit('statusUpdate', {
    forwarder: forwarderStatus,
    dicom: dicomStatus,
    timestamp: new Date().toISOString()
  });
}

// API forwarder events
apiForwarder.on('transferred', (data) => {
  logger.info('File transferred event:', data.transfer.id);
  io.emit('fileTransferred', {
    transferId: data.transfer.id,
    patientId: data.transfer.patient_id,
    timestamp: new Date().toISOString()
  });
  emitStatus();
});

apiForwarder.on('error', (data) => {
  logger.error('API forwarder error:', data.error.message);
  io.emit('transferError', {
    transferId: data.transfer.id,
    error: data.error.message,
    timestamp: new Date().toISOString()
  });
  emitStatus();
});

// DICOM listener events
dicomListener.on('started', () => {
  logger.info('DICOM listener started');
  io.emit('dicomStarted', {
    port: config.dicom.port,
    aet: config.dicom.aet,
    timestamp: new Date().toISOString()
  });
  emitStatus();
});

dicomListener.on('stopped', () => {
  logger.info('DICOM listener stopped');
  io.emit('dicomStopped', {
    timestamp: new Date().toISOString()
  });
  emitStatus();
});

dicomListener.on('file-received', (data) => {
  logger.info(`DICOM file received: Transfer ${data.transferId}`);
  io.emit('dicomFileReceived', {
    transferId: data.transferId,
    patientId: data.patientId,
    modality: data.modality,
    fileSize: data.fileSize,
    timestamp: new Date().toISOString()
  });
  emitStatus();
});

dicomListener.on('error', (error) => {
  logger.error('DICOM listener error:', error);
  io.emit('dicomError', {
    error: error.message,
    timestamp: new Date().toISOString()
  });
  emitStatus();
});

// Start services
function startServices() {
  try {
    // Start DICOM listener
    dicomListener.start().catch((error) => {
      logger.error('Failed to start DICOM listener:', error);
      logger.warn('Continuing without DICOM listener - manual upload only');
    });

    // Start API forwarder
    apiForwarder.start();

    logger.info('All services started successfully');
  } catch (error) {
    logger.error('Failed to start services:', error);
  }
}

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down gracefully...');

  // Stop DICOM listener
  dicomListener.stop().catch((error) => {
    logger.error('Error stopping DICOM listener:', error);
  });

  // Stop API forwarder
  apiForwarder.stop();

  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Handle process signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start server
server.listen(config.server.port, config.server.host, () => {
  logger.info('='.repeat(50));
  logger.info('╔════════════════════════════════════════════════╗');
  logger.info('║   DICOM Router - Powered by Assist.id         ║');
  logger.info('║  Healthcare Technology Leader in Indonesia     ║');
  logger.info('╚════════════════════════════════════════════════╝');
  logger.info('='.repeat(50));
  logger.info(`Environment: ${config.server.nodeEnv}`);
  logger.info(`Web UI: http://${config.server.host}:${config.server.port}`);
  logger.info(`API Base URL: ${config.api.url}`);
  logger.info(`API Receive Endpoint: ${config.api.url}${config.api.endpoints.receive}`);
  logger.info('='.repeat(50));
  logger.info('🏥 Assist.id - Sistem RME & Manajemen Klinik #1');
  logger.info('✓  6,000+ Fasilitas Kesehatan se-Indonesia');
  logger.info('✓  ISO 27001 Certified | PSE Kemkomdigi');
  logger.info('📞 Contact: info@assist.id | 082112222500');
  logger.info('🌐 Website: https://assist.id');
  logger.info('='.repeat(50));

  // Start services after server is ready
  startServices();

  // Emit status every 5 seconds
  setInterval(emitStatus, 5000);

    // Auto-open browser when running as packaged exe (terminal is hidden)
    if (process.pkg !== undefined && process.platform === 'win32') {
      var openBrowser = require('child_process').exec;
      setTimeout(function() {
        openBrowser('start http://localhost:' + config.server.port);
      }, 1500);
    }
  });

module.exports = { app, server, io };
