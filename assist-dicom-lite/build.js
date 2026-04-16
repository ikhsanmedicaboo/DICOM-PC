#!/usr/bin/env node
/**
 * Build Script for DICOM Router Lite  
 * Compiles the application into a standalone Windows executable
 *
 * Built by Assist.id - PT. Jaga Anugrah Giat Asa
 * https://assist.id
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');

console.log('='.repeat(60));
console.log('  DICOM Router Lite - Build Script');
console.log('  Powered by Assist.id');
console.log('='.repeat(60));

async function build() {
  try {
    console.log('\n📁 Creating distribution directory...');
    await fs.ensureDir('dist');

    console.log('\n📦 Checking pkg installation...');
    try {
      execSync('pkg --version', { stdio: 'ignore' });
      console.log('✓ pkg is already installed');
    } catch (e) {
      console.log('Installing pkg...');
      execSync('npm install -g pkg@5.8.0', { stdio: 'inherit' });
    }

    console.log('\n🔨 Building Windows executable (single-file)...');
    console.log('   Target: Windows 7 (x64)');
    console.log('   Node: v12.22.12');
    console.log('   Mode: Single-file compilation');
    execSync('pkg . --targets node12-win-x64 --output dist/DICOM-Router-Lite-Win7.exe --compress GZip', { stdio: 'inherit' });

    console.log('\n📋 Copying required files...');
    await fs.ensureDir('dist/storage/logs');
    await fs.ensureDir('dist/storage/dicom');

    console.log('   - Creating .env template...');
    await fs.writeFile('dist/.env.example', [
      '# DICOM Router Lite Configuration',
      '# -------------------------------------------------------',
      '# REQUIRED: Copy this file to .env and fill in your values',
      '# Place .env in the same folder as the .exe file',
      '# -------------------------------------------------------',
      '',
      '# Hospital credentials (REQUIRED)',
      'HOSPITAL_ID=YOUR_HOSPITAL_ID_HERE',
      'API_KEY=YOUR_API_KEY_HERE',
      '',
      '# API endpoint (do not change unless instructed)',
      'API_URL=https://api-dicom-router.assist.id',
      'API_TIMEOUT=0',
      '',
      '# DICOM listener settings',
      'DICOM_PORT=11112',
      'DICOM_AET=ASSIST_ROUTER',
      'DICOM_STORAGE_PATH=./storage/dicom',
      '',
      '# Storage and logs',
      'DB_PATH=./storage/lite-store.json',
      'LOG_FILE=./storage/logs/app.log',
      'LOG_LEVEL=info',
      '',
      '# Forwarder behavior',
      'MAX_RETRIES=3',
    ].join('\n'));

    console.log('   - Creating README...');
    await fs.writeFile('dist/README.txt', [
      '╔═══════════════════════════════════════════════════════════════╗',
      '║     DICOM Router Lite - Windows 7 Distribution               ║',
      '║     Powered by Assist.id - PT. Jaga Anugrah Giat Asa         ║',
      '╚═══════════════════════════════════════════════════════════════╝',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  QUICK START GUIDE',
      '═══════════════════════════════════════════════════════════════',
      '',
      '1. RECOMMENDED: Double-click START_LITE.bat',
      '   - First run will create configuration file',
      '   - Follow prompts to enter Hospital ID and API Key',
      '   - Validates credentials before starting',
      '',
      '2. SILENT MODE: Double-click DICOM-Router-Lite.vbs',
      '   - Runs in background (no console window)',
      '   - Best for production use',
      '',
      '3. DEBUG MODE: Double-click START_DEBUG.bat',
      '   - Shows console output for diagnostics',
      '',
      '4. AUTO-STARTUP: Double-click INSTALL_AUTO_STARTUP.bat',
      '   - Starts automatically when Windows boots',
      '   - Runs silently in background',
      '   - Perfect for production servers',
      '   - To disable: run UNINSTALL_AUTO_STARTUP.bat',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  AUTO-STARTUP SETUP',
      '═══════════════════════════════════════════════════════════════',
      '',
      'To make DICOM Router Lite start automatically on Windows boot:',
      '',
      '1. Configure .env file with your credentials (one-time setup)',
      '2. Double-click INSTALL_AUTO_STARTUP.bat',
      '3. Confirm installation when prompted',
      '4. Done! Application will auto-start on next login',
      '',
      'Benefits:',
      '  ✓ No manual startup needed after computer restarts',
      '  ✓ Runs silently in background (no console window)',
      '  ✓ DICOM listener always available on port 11112',
      '  ✓ Automatic credential validation on startup',
      '',
      'To disable auto-startup:',
      '  - Double-click UNINSTALL_AUTO_STARTUP.bat',
      '  - Or manually delete from: Start Menu > Startup folder',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  CONFIGURATION',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Edit .env file to configure:',
      '  - HOSPITAL_ID: Your hospital identifier',
      '  - API_KEY: Authentication key from Assist.id',
      '  - API_URL: API endpoint (default: https://api-dicom-router.assist.id)',
      '  - DICOM_PORT: DICOM listener port (default: 11112)',
      '  - DICOM_AET: Application Entity Title (default: ASSIST_ROUTER)',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  FEATURES',
      '═══════════════════════════════════════════════════════════════',
      '',
      '✓ Built-in credential validation on startup',
      '✓ Duplicate API call prevention',
      '✓ Lightweight JSON-based storage',
      '✓ Automatic retry on failures',
      '✓ No web interface (minimal footprint)',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  DICOM DEVICE CONFIGURATION',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Configure your DICOM device to send to:',
      '  - IP Address: [This computer\'s IP address]',
      '  - Port: 11112',
      '  - AE Title: ASSIST_ROUTER',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  DISTRIBUTION',
      '═══════════════════════════════════════════════════════════════',
      '',
      'This entire folder is portable. You can:',
      '  1. Zip the entire dist folder',
      '  2. Copy to target Windows 7 machine',
      '  3. Extract and run START_LITE.bat',
      '  4. No Node.js or npm installation required!',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  SUPPORT & CONTACT',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Website: https://assist.id',
      'Phone: 082112222500',
      'Email: info@assist.id',
      '',
      'Built with ❤️ by Assist.id',
      'PT. Jaga Anugrah Giat Asa',
      '',
    ].join('\n'));

    console.log('   - Creating silent launcher (VBS)...');
    await fs.writeFile('dist/DICOM-Router-Lite.vbs', [
      "' DICOM Router Lite - Silent Launcher",
      "' Double-click to start without a console window",
      'Dim strDir',
      'strDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)',
      'Set WshShell = CreateObject("WScript.Shell")',
      'WshShell.Run Chr(34) & strDir & "\\DICOM-Router-Lite-Win7.exe" & Chr(34), 0, False',
      'Set WshShell = Nothing',
    ].join('\n'));

    console.log('   - Creating main launcher (BAT)...');
    await fs.writeFile('dist/START_LITE.bat', [
      '@echo off',
      'title DICOM Router Lite - Assist.id',
      'color 0A',
      '',
      'echo ================================================================',
      'echo   DICOM Router Lite - Standalone Launcher',
      'echo   Powered by Assist.id - PT. Jaga Anugrah Giat Asa',
      'echo ================================================================',
      'echo.',
      '',
      'REM Check if .env file exists',
      'if not exist .env (',
      '    echo WARNING: Configuration file not found!',
      '    echo.',
      '    echo Creating .env from template...',
      '    if exist .env.example (',
      '        copy .env.example .env',
      '    ) else (',
      '        echo # DICOM Router Lite Configuration > .env',
      '        echo HOSPITAL_ID=YOUR_HOSPITAL_ID_HERE >> .env',
      '        echo API_KEY=YOUR_API_KEY_HERE >> .env',
      '        echo API_URL=https://api-dicom-router.assist.id >> .env',
      '        echo DICOM_PORT=11112 >> .env',
      '        echo DICOM_AET=ASSIST_ROUTER >> .env',
      '        echo LOG_LEVEL=info >> .env',
      '    )',
      '    echo.',
      '    echo IMPORTANT: Please edit .env file with your credentials!',
      '    echo.',
      '    echo Opening .env in Notepad...',
      '    notepad .env',
      '    echo.',
      '    echo Press any key after you have saved your configuration...',
      '    pause >nul',
      ')',
      '',
      'REM Ensure storage directories exist',
      'if not exist storage\\logs mkdir storage\\logs',
      'if not exist storage\\dicom mkdir storage\\dicom',
      '',
      'echo.',
      'echo Starting DICOM Router Lite...',
      'echo.',
      'echo ----------------------------------------------------------------',
      'echo   DICOM Port: 11112',
      'echo   DICOM AET: ASSIST_ROUTER',
      'echo   Mode: Lightweight (No Web UI)',
      'echo ----------------------------------------------------------------',
      'echo.',
      'echo Validating credentials...',
      'echo.',
      'echo Press Ctrl+C to stop the listener',
      'echo.',
      '',
      'REM Start the application',
      'DICOM-Router-Lite-Win7.exe',
      '',
      'echo.',
      'echo DICOM Router Lite has stopped.',
      'echo.',
      'pause',
    ].join('\r\n'));

    console.log('   - Creating debug launcher (BAT)...');
    await fs.writeFile('dist/START_DEBUG.bat', [
      '@echo off',
      'title DICOM Router Lite - DEBUG MODE',
      'echo ================================================',
      'echo   DICOM Router Lite - Debug Mode  ^|  Assist.id',
      'echo ================================================',
      'echo.',
      'DICOM-Router-Lite-Win7.exe',
      'echo.',
      'echo DICOM Router Lite has stopped.',
      'pause',
    ].join('\r\n'));

    console.log('   - Copying auto-startup scripts...');
    const autoStartupFiles = ['INSTALL_AUTO_STARTUP.bat', 'UNINSTALL_AUTO_STARTUP.bat'];
    for (const file of autoStartupFiles) {
      if (await fs.pathExists(file)) {
        await fs.copy(file, `dist/${file}`);
      }
    }

    console.log('   - Copying documentation...');
    const docsFiles = ['UPDATES.md', 'TESTING_LITE.md'];
    for (const file of docsFiles) {
      if (await fs.pathExists(file)) {
        await fs.copy(file, `dist/${file}`);
      }
    }

    const stats = await fs.stat('dist/DICOM-Router-Lite-Win7.exe');
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('\n✅ Build completed successfully!');
    console.log('\n📊 Build Information:');
    console.log('   Executable: DICOM-Router-Lite-Win7.exe  |  Size: ' + fileSizeMB + ' MB');
    console.log('   Compression: GZip (Single-file)');
    console.log('\n📦 Distribution Contents:');
    console.log('   ✓ DICOM-Router-Lite-Win7.exe  (Main executable - single file)');
    console.log('   ✓ START_LITE.bat              (Main launcher - recommended)');
    console.log('   ✓ DICOM-Router-Lite.vbs       (Silent launcher - no console)');
    console.log('   ✓ START_DEBUG.bat             (Debug launcher - console visible)');
    console.log('   ✓ INSTALL_AUTO_STARTUP.bat    (Enable auto-start on Windows boot)');
    console.log('   ✓ UNINSTALL_AUTO_STARTUP.bat  (Disable auto-start)');
    console.log('   ✓ README.txt, .env.example');
    console.log('   ✓ UPDATES.md, TESTING_LITE.md (Documentation)');
    console.log('   ✓ storage/ (Data directories)');
    console.log('\n🚀 Quick Start:');
    console.log('   1. Zip the entire dist folder and extract on target Windows 7 machine');
    console.log('   2. Double-click START_LITE.bat to configure and run');
    console.log('   3. Or use DICOM-Router-Lite.vbs to run silently in background');
    console.log('   4. Run INSTALL_AUTO_STARTUP.bat to auto-start on computer boot');
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

build();
