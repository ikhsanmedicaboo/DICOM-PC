#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const isExecutable = process.pkg !== undefined;
const baseDir = isExecutable ? path.dirname(process.execPath) : __dirname;

// Startup file logger — active once LOG_FILE path is known (set in initialize).
let _logFilePath = null;

function _writeStartupLog(level, message) {
  if (!_logFilePath) return;
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(_logFilePath, `${timestamp} [${level}] ${message}\n`, 'utf8');
  } catch (_) {}
}

function logInfo(message) {
  console.log(message);
  _writeStartupLog('INFO', message);
}

function logError(message) {
  console.error(message);
  _writeStartupLog('ERROR', message);
}

/**
 * Validate environment variables
 */
function validateEnvironment() {
  const errors = [];
  
  if (!process.env.HOSPITAL_ID || process.env.HOSPITAL_ID.trim() === '') {
    errors.push('HOSPITAL_ID is not set in .env file');
  }
  
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
    errors.push('API_KEY is not set in .env file');
  }
  
  if (!process.env.API_URL || process.env.API_URL.trim() === '') {
    errors.push('API_URL is not set in .env file');
  }
  
  if (errors.length > 0) {
    logError('\n╔═══════════════════════════════════════════════════════════════╗');
    logError('║          CONFIGURATION ERROR - Missing Credentials             ║');
    logError('╚═══════════════════════════════════════════════════════════════╝\n');
    logError('❌ Configuration errors detected:\n');
    errors.forEach((error, index) => {
      logError(`   ${index + 1}. ${error}`);
    });
    logError('\n📝 Required steps:\n');
    logError('   1. Ensure .env file exists in the same directory as the executable');
    logError('   2. Edit .env file and set the following values:');
    logError('      - HOSPITAL_ID=your_hospital_id');
    logError('      - API_KEY=your_api_key');
    logError('      - API_URL=https://api-dicom-router.assist.id');
    logError('\n   Example .env file:');
    logError('      HOSPITAL_ID=678484fe219a19629b962377');
    logError('      API_KEY=Njc4NDg0ZmUyMTlhMTk2MjliOTYyMzc3OkJpc21pbGxhaFJhZGlvbG9neTEyMyE');
    logError('      API_URL=https://api-dicom-router.assist.id');
    logError('      DICOM_PORT=11112');
    logError('\n📞 Support: https://assist.id | Phone: 082112222500\n');
    logError('════════════════════════════════════════════════════════════════\n');
    
    return false;
  }
  
  return true;
}

/**
 * Validate credentials with the API
 */
async function validateCredentials() {
  const hospitalId = process.env.HOSPITAL_ID;
  const apiKey = process.env.API_KEY;
  const apiUrl = process.env.API_URL;
  
  logInfo('\n╔═══════════════════════════════════════════════════════════════╗');
  logInfo('║          Validating Credentials with API                      ║');
  logInfo('╚═══════════════════════════════════════════════════════════════╝\n');
  logInfo(`Hospital ID: ${hospitalId}`);
  logInfo(`API URL: ${apiUrl}`);
  logInfo('\nTesting authentication...\n');
  
  try {
    const authUrl = `${apiUrl}/api/authenticate`;
    const response = await axios.post(authUrl, {}, {
      headers: {
        'hospital_id': hospitalId,
        'api_key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 0,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    
    if (response.status === 200 && response.data && response.data.success) {
      const hospitalName = (response.data && response.data.data && response.data.data.hospitalName) || 
                           (response.data && response.data.data && response.data.data.hospital_name) || 
                           (response.data && response.data.data && response.data.data.name) || 
                           'Unknown';
      
      logInfo('✅ Authentication successful!');
      logInfo(`   Hospital: ${hospitalName}`);
      logInfo(`   Status: ${(response.data && response.data.message) || 'Connected'}`);
      logInfo('\n════════════════════════════════════════════════════════════════\n');
      return true;
    } else {
      const errorMessage = (response.data && response.data.message) || 'Invalid credentials';
      logError('❌ Authentication failed!');
      logError(`   Error: ${errorMessage}`);
      logError(`   HTTP Status: ${response.status}`);
      logError('\n📝 Please check:\n');
      logError('   1. HOSPITAL_ID is correct');
      logError('   2. API_KEY is correct and not expired');
      logError('   3. Contact Assist.id support if issue persists');
      logError('\n📞 Support: https://assist.id | Phone: 082112222500\n');
      logError('════════════════════════════════════════════════════════════════\n');
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      logError('❌ Cannot connect to API server!');
      logError(`   Error: ${error.message}`);
      logError(`   Error Code: ${error.code}`);
      logError('\n📝 Possible reasons:\n');
      logError('   1. Internet connection is not active');
      logError('   2. API server is temporarily down');
      logError('   3. API URL is incorrect');
      logError('   4. Firewall is blocking the connection');
      logError('\n════════════════════════════════════════════════════════════════\n');
      return false;
    } else {
      logError('❌ Authentication error!');
      logError(`   Error: ${error.message}`);
      logError('\n📞 Support: https://assist.id | Phone: 082112222500\n');
      logError('════════════════════════════════════════════════════════════════\n');
      return false;
    }
  }
}

async function initialize() {
  const requiredDirs = [
    path.join(baseDir, 'storage'),
    path.join(baseDir, 'storage', 'dicom'),
    path.join(baseDir, 'storage', 'logs')
  ];

  for (const dir of requiredDirs) {
    await fs.ensureDir(dir);
  }

  // Load .env from exe directory (must be before any config require)
  require('dotenv').config({ path: path.join(baseDir, '.env') });

  process.env.DICOM_STORAGE_PATH = process.env.DICOM_STORAGE_PATH || path.join(baseDir, 'storage', 'dicom');
  process.env.DB_PATH = process.env.DB_PATH || path.join(baseDir, 'storage', 'lite-store.json');
  process.env.LOG_FILE = process.env.LOG_FILE || path.join(baseDir, 'storage', 'logs', 'app.log');

  // Activate file logging for startup messages
  _logFilePath = process.env.LOG_FILE;

  // Validate environment configuration
  if (!validateEnvironment()) {
    process.exit(1);
  }
  
  // Validate credentials with API - retry until successful
  let attempt = 0;
  let credentialsValid = false;
  
  while (!credentialsValid) {
    attempt++;
    
    if (attempt > 1) {
      const waitTime = Math.min(attempt * 5, 30); // Max 30 seconds between retries
      logInfo(`\n⏳ Retrying authentication in ${waitTime} seconds... (Attempt ${attempt})`);
      logInfo('   Press Ctrl+C to cancel\n');
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
    
    credentialsValid = await validateCredentials();
    
    if (!credentialsValid) {
      logInfo('⚠️  Authentication failed. Will retry automatically...');
    }
  }
  
  logInfo('✅ Authentication successful! Starting DICOM Router Lite...\n');

  require('./server');
}

initialize().catch((error) => {
  logError(`Startup failed: ${error.message}`);
  process.exit(1);
});
