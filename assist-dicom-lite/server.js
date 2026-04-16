const logger = require('./services/logger');
const config = require('./config/default');
const dicomListener = require('./services/dicom-listener');
const apiForwarder = require('./services/api-forwarder');

function start() {
  dicomListener.on('started', (status) => {
    logger.info('Listener started', status);
  });

  dicomListener.on('file-received', (data) => {
    logger.info('File received and queued', data);
  });

  dicomListener.on('error', (error) => {
    logger.error('Listener error', error);
  });

  apiForwarder.on('transferred', (data) => {
    logger.info('File forwarded', data);
  });

  apiForwarder.on('error', (data) => {
    logger.error('Forwarder error', data);
  });

  dicomListener.start().catch((error) => {
    logger.error('Failed to start listener', error);
    process.exit(1);
  });

  apiForwarder.start();

  logger.info('assist-dicom-lite is running');
  logger.info(`DICOM Port: ${config.dicom.port}, AET: ${config.dicom.aet}`);
  logger.info(`Forward API: ${config.api.url}${config.api.endpoints.receive}`);

  setInterval(() => {
    logger.info('Status snapshot', {
      dicom: dicomListener.getStatus(),
      forwarder: apiForwarder.getStatus()
    });
  }, 15000);
}

async function shutdown() {
  logger.info('Shutdown requested');
  try {
    apiForwarder.stop();
    await dicomListener.stop();
  } catch (error) {
    logger.error('Shutdown error', error);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
