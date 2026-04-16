#!/usr/bin/env node
/**
 * DICOM Router - Startup Wrapper
 * Ensures all necessary directories and files exist before starting
 * 
 * Built by Assist.id - PT. Jaga Anugrah Giat Asa
 * https://assist.id
 */

const fs = require('fs-extra');
const path = require('path');

// Determine if running as executable
const isExecutable = process.pkg !== undefined;

// Set base directory
const baseDir = isExecutable ? path.dirname(process.execPath) : path.join(__dirname);

console.log('='.repeat(60));
console.log('  DICOM Router - Starting...');
console.log('  Powered by Assist.id');
console.log('='.repeat(60));

async function initialize() {
  try {
    // Create required directories
    const dirs = [
      path.join(baseDir, 'storage'),
      path.join(baseDir, 'storage', 'dicom'),
      path.join(baseDir, 'storage', 'logs'),
      path.join(baseDir, 'frontend'),
      path.join(baseDir, 'frontend', 'css'),
      path.join(baseDir, 'frontend', 'js')
    ];

    console.log('\n📁 Checking directories...');
    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }
    console.log('✓ All directories ready');

    // Check if frontend files exist when running as executable
    if (isExecutable) {
      console.log('\n📋 Checking frontend files...');
      const frontendFiles = [
        'frontend/index.html',
        'frontend/css/style.css',
        'frontend/js/app.js',
        'frontend/js/socket-handler.js'
      ];

      for (const file of frontendFiles) {
        const filePath = path.join(baseDir, file);
        if (!await fs.pathExists(filePath)) {
          console.warn(`⚠ Warning: ${file} not found`);
        }
      }
    }

    // Load .env from exe directory (must be before any config require)
    require('dotenv').config({ path: path.join(baseDir, '.env'), silent: true });

    // Set environment variables for runtime
    if (isExecutable) {
      process.env.DICOM_STORAGE_PATH = process.env.DICOM_STORAGE_PATH || path.join(baseDir, 'storage', 'dicom');
      process.env.DB_PATH = process.env.DB_PATH || path.join(baseDir, 'storage', 'logs.db');
      process.env.LOG_FILE = process.env.LOG_FILE || path.join(baseDir, 'storage', 'logs', 'app.log');
    }

    console.log('\n✓ Initialization complete');
    console.log('='.repeat(60));
    console.log('');

    // Start the main server
    require('./backend/server.js');

  } catch (error) {
    console.error('\n❌ Initialization failed:', error.message);
    console.error('\nPlease contact Assist.id support if this error persists');
    console.error('Phone: 082112222500 | Email: info@assist.id');
    
    // Keep console open on error
    if (process.platform === 'win32') {
      require('child_process').execSync('pause', { stdio: 'inherit' });
    }
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  
  if (process.platform === 'win32') {
    require('child_process').execSync('pause', { stdio: 'inherit' });
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled rejection:', reason);
  
  if (process.platform === 'win32') {
    require('child_process').execSync('pause', { stdio: 'inherit' });
  }
  process.exit(1);
});

// Start initialization
initialize();
