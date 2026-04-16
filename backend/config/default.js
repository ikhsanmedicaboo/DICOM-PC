// Load environment variables (optional - won't fail if .env doesn't exist)
require('dotenv').config({ silent: true });

const config = {
  // API Settings
  api: {
    url: process.env.API_URL || 'https://api-dicom-router.assist.id',
    key: process.env.API_KEY || '',
    bearerToken: process.env.API_BEARER_TOKEN || '',
    timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
    hospitalId: process.env.HOSPITAL_ID || '',
    // Runtime credentials (can be updated via API)
    runtimeKey: '',
    runtimeHospitalId: '',
    runtimeHospitalName: '',
    // API Endpoints
    endpoints: {
      receive: '/api/receive',
      authenticate: '/api/authenticate',
      validate: '/api/validate'
    }
  },

  // DICOM Listener Settings
  dicom: {
    port: parseInt(process.env.DICOM_PORT || '11112', 10),
    aet: process.env.DICOM_AET || 'ASSIST_ROUTER',
    peerAet: process.env.DICOM_PEER_AET || 'ANY',
    storagePath: process.env.DICOM_STORAGE_PATH || './storage/dicom'
  },

  // Web Server Settings
  server: {
    port: parseInt(process.env.WEB_PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'production'
  },

  // Storage Settings
  storage: {
    maxSizeGB: parseInt(process.env.MAX_STORAGE_GB || '10', 10),
    retentionDays: parseInt(process.env.RETENTION_DAYS || '30', 10),
    dbPath: process.env.DB_PATH || './storage/logs.db'
  },

  // Logging Settings
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './storage/logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '7', 10)
  },

  // Retry Settings
  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10)
  },

  // Security Settings
  security: {
    enableAuth: process.env.ENABLE_AUTH === 'true',
    dashboardPassword: process.env.DASHBOARD_PASSWORD || ''
  },

  // Performance Settings
  performance: {
    concurrentUploads: parseInt(process.env.CONCURRENT_UPLOADS || '3', 10),
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '3600000', 10)
  }
};

module.exports = config;
