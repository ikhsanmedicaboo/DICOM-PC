require('dotenv').config();

module.exports = {
  api: {
    url: process.env.API_URL || 'https://api-dicom-router.assist.id',
    key: process.env.API_KEY || '',
    hospitalId: process.env.HOSPITAL_ID || '',
    timeout: parseInt(process.env.API_TIMEOUT || '0', 10),
    endpoints: {
      authenticate: '/api/authenticate',
      receive: '/api/receive'
    }
  },
  dicom: {
    port: parseInt(process.env.DICOM_PORT || '11112', 10),
    aet: process.env.DICOM_AET || 'ASSIST_ROUTER',
    storagePath: process.env.DICOM_STORAGE_PATH || './storage/dicom'
  },
  storage: {
    dbPath: process.env.DB_PATH || './storage/lite-store.json'
  },
  logging: {
    file: process.env.LOG_FILE || './storage/logs/app.log',
    level: process.env.LOG_LEVEL || 'info'
  },
  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10)
  },
  performance: {
    concurrentUploads: parseInt(process.env.CONCURRENT_UPLOADS || '2', 10),
    queuePollInterval: parseInt(process.env.QUEUE_POLL_INTERVAL || '5000', 10)
  }
};
