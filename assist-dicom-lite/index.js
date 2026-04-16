#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const isExecutable = process.pkg !== undefined;
const baseDir = isExecutable ? path.dirname(process.execPath) : __dirname;

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
    console.error('\n╔═══════════════════════════════════════════════════════════════╗');
    console.error('║          CONFIGURATION ERROR - Missing Credentials             ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝\n');
    console.error('❌ Configuration errors detected:\n');
    errors.forEach((error, index) => {
      console.error(`   ${index + 1}. ${error}`);
    });
    console.error('\n📝 Required steps:\n');
    console.error('   1. Ensure .env file exists in the same directory as the executable');
    console.error('   2. Edit .env file and set the following values:');
    console.error('      - HOSPITAL_ID=your_hospital_id');
    console.error('      - API_KEY=your_api_key');
    console.error('      - API_URL=https://api-dicom-router.assist.id');
    console.error('\n   Example .env file:');
    console.error('      HOSPITAL_ID=678484fe219a19629b962377');
    console.error('      API_KEY=Njc4NDg0ZmUyMTlhMTk2MjliOTYyMzc3OkJpc21pbGxhaFJhZGlvbG9neTEyMyE');
    console.error('      API_URL=https://api-dicom-router.assist.id');
    console.error('      DICOM_PORT=11112');
    console.error('\n📞 Support: https://assist.id | Phone: 082112222500\n');
    console.error('════════════════════════════════════════════════════════════════\n');
    
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
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          Validating Credentials with API                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`Hospital ID: ${hospitalId}`);
  console.log(`API URL: ${apiUrl}`);
  console.log('\nTesting authentication...\n');
  
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
      
      console.log('✅ Authentication successful!');
      console.log(`   Hospital: ${hospitalName}`);
      console.log(`   Status: ${(response.data && response.data.message) || 'Connected'}`);
      console.log('\n════════════════════════════════════════════════════════════════\n');
      return true;
    } else {
      const errorMessage = (response.data && response.data.message) || 'Invalid credentials';
      console.error('❌ Authentication failed!');
      console.error(`   Error: ${errorMessage}`);
      console.error(`   HTTP Status: ${response.status}`);
      console.error('\n📝 Please check:\n');
      console.error('   1. HOSPITAL_ID is correct');
      console.error('   2. API_KEY is correct and not expired');
      console.error('   3. Contact Assist.id support if issue persists');
      console.error('\n📞 Support: https://assist.id | Phone: 082112222500\n');
      console.error('════════════════════════════════════════════════════════════════\n');
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      console.error('❌ Cannot connect to API server!');
      console.error(`   Error: ${error.message}`);
      console.error(`   Error Code: ${error.code}`);
      console.error('\n📝 Possible reasons:\n');
      console.error('   1. Internet connection is not active');
      console.error('   2. API server is temporarily down');
      console.error('   3. API URL is incorrect');
      console.error('   4. Firewall is blocking the connection');
      console.error('\n════════════════════════════════════════════════════════════════\n');
      return false;
    } else {
      console.error('❌ Authentication error!');
      console.error(`   Error: ${error.message}`);
      console.error('\n📞 Support: https://assist.id | Phone: 082112222500\n');
      console.error('════════════════════════════════════════════════════════════════\n');
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
      console.log(`\n⏳ Retrying authentication in ${waitTime} seconds... (Attempt ${attempt})`);
      console.log('   Press Ctrl+C to cancel\n');
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
    
    credentialsValid = await validateCredentials();
    
    if (!credentialsValid) {
      console.log('⚠️  Authentication failed. Will retry automatically...');
    }
  }
  
  console.log('✅ Authentication successful! Starting DICOM Router Lite...\n');

  require('./server');
}

initialize().catch((error) => {
  console.error('Startup failed:', error.message);
  process.exit(1);
});
