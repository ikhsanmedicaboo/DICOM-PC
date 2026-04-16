#!/usr/bin/env node
/**
 * Build Script for DICOM Router
 * Compiles the application into a standalone Windows executable
 *
 * Built by Assist.id - PT. Jaga Anugrah Giat Asa
 * https://assist.id
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');

console.log('='.repeat(60));
console.log('  DICOM Router - Build Script');
console.log('  Powered by Assist.id');
console.log('='.repeat(60));

async function build() {
  try {
    console.log('\n\u{1F4C1} Creating distribution directory...');
    await fs.ensureDir('dist');

    console.log('\n\u{1F4E6} Checking pkg installation...');
    try {
      execSync('pkg --version', { stdio: 'ignore' });
      console.log('\u2713 pkg is already installed');
    } catch (e) {
      console.log('Installing pkg...');
      execSync('npm install -g pkg@5.8.0', { stdio: 'inherit' });
    }

    console.log('\n\u{1F528} Building Windows executable...');
    console.log('   Target: Windows 7 (x64)');
    console.log('   Node: v12.22.12');
    execSync('npm run build:win7', { stdio: 'inherit' });

    console.log('\n\u{1F4CB} Copying required files...');
    await fs.ensureDir('dist/storage/logs');

    console.log('   - Frontend files...');
    await fs.copy('frontend', 'dist/frontend');

    console.log('   - Testing tools...');
    const testingFiles = [
      'test-auth-quick.bat',
      'test-all-endpoints.bat',
      'CURL_API_REFERENCE.md',
      'TESTING_GUIDE.md'
    ];
    for (const file of testingFiles) {
      if (await fs.pathExists(file)) {
        await fs.copy(file, `dist/${file}`);
      }
    }

    console.log('   - Creating .env template...');
    await fs.writeFile('dist/.env.example', [
      '# DICOM Router Configuration',
      '# Place .env in the same folder as the .exe file',
      '',
      'HOSPITAL_ID=YOUR_HOSPITAL_ID_HERE',
      'API_KEY=YOUR_API_KEY_HERE',
      'API_URL=https://api-dicom-router.assist.id',
      'WEB_PORT=3000',
      'HOST=0.0.0.0',
      'DICOM_PORT=11112',
      'DICOM_AET=ASSIST_ROUTER',
      'LOG_LEVEL=info',
    ].join('\n'));

    console.log('   - Creating README...');
    await fs.writeFile('dist/README.txt', [
      '╔═══════════════════════════════════════════════════════════════╗',
      '║     DICOM Router - Windows 7 Standalone Distribution         ║',
      '║     Powered by Assist.id - PT. Jaga Anugrah Giat Asa         ║',
      '╚═══════════════════════════════════════════════════════════════╝',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  QUICK START GUIDE',
      '═══════════════════════════════════════════════════════════════',
      '',
      '1. RECOMMENDED: Double-click START_DICOM_ROUTER.bat',
      '   - First run will create configuration file',
      '   - Follow prompts to enter Hospital ID and API Key',
      '   - Browser will open to http://localhost:3000',
      '',
      '2. ALTERNATIVE: Silent Mode (No Console Window)',
      '   - Double-click DICOM-Router.vbs',
      '   - Runs in background, browser opens automatically',
      '   - Best for production use',
      '',
      '3. DEBUG MODE: Troubleshooting',
      '   - Double-click START_DEBUG.bat',
      '   - Shows console output for diagnostics',
      '   - Use when you need to see logs',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  CONFIGURATION',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Edit .env file to configure:',
      '  - HOSPITAL_ID: Your hospital identifier',
      '  - API_KEY: Authentication key from Assist.id',
      '  - WEB_PORT: Web interface port (default: 3000)',
      '  - DICOM_PORT: DICOM listener port (default: 11112)',
      '  - DICOM_AET: Application Entity Title (default: ASSIST_ROUTER)',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  DICOM DEVICE CONFIGURATION',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Configure your DICOM device (e.g., Fuji FCR) to send to:',
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
      '  3. Extract and run START_DICOM_ROUTER.bat',
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
    await fs.writeFile('dist/DICOM-Router.vbs', [
      "' DICOM Router - Silent Launcher",
      "' Double-click to start without a console window",
      "' Browser opens automatically at http://localhost:3000",
      'Dim strDir',
      'strDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)',
      'Set WshShell = CreateObject("WScript.Shell")',
      'WshShell.Run Chr(34) & strDir & "\\DICOM-Router-Win7.exe" & Chr(34), 0, False',
      'Set WshShell = Nothing',
    ].join('\n'));

    console.log('   - Creating debug launcher (BAT)...');
    await fs.writeFile('dist/START_DEBUG.bat', [
      '@echo off',
      'title DICOM Router - DEBUG MODE',
      'echo ================================================',
      'echo   DICOM Router - Debug Mode  ^|  Assist.id',
      'echo ================================================',
      'echo.',
      'echo Web UI: http://localhost:3000',
      'echo.',
      'DICOM-Router-Win7.exe',
      'echo.',
      'echo DICOM Router has stopped.',
      'pause',
    ].join('\r\n'));

    console.log('   - Creating main launcher (BAT)...');
    await fs.writeFile('dist/START_DICOM_ROUTER.bat', [
      '@echo off',
      'title DICOM Router - Assist.id',
      'color 0A',
      '',
      'echo ================================================================',
      'echo   DICOM Router - Standalone Launcher',
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
      '        echo # DICOM Router Configuration > .env',
      '        echo HOSPITAL_ID=YOUR_HOSPITAL_ID_HERE >> .env',
      '        echo API_KEY=YOUR_API_KEY_HERE >> .env',
      '        echo API_URL=https://api-dicom-router.assist.id >> .env',
      '        echo WEB_PORT=3000 >> .env',
      '        echo HOST=0.0.0.0 >> .env',
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
      'if not exist storage\\uploads mkdir storage\\uploads',
      '',
      'echo.',
      'echo Starting DICOM Router...',
      'echo.',
      'echo ----------------------------------------------------------------',
      'echo   Web UI will be available at: http://localhost:3000',
      'echo   DICOM Port: 11112',
      'echo   DICOM AET: ASSIST_ROUTER',
      'echo ----------------------------------------------------------------',
      'echo.',
      'echo Press Ctrl+C to stop the server',
      'echo.',
      '',
      'REM Start the application',
      'DICOM-Router-Win7.exe',
      '',
      'echo.',
      'echo DICOM Router has stopped.',
      'echo.',
      'pause',
    ].join('\r\n'));

    const stats = await fs.stat('dist/DICOM-Router-Win7.exe');
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('\n\u2705 Build completed successfully!');
    console.log('\n\u{1F4CA} Build Information:');
    console.log('   Executable: DICOM-Router-Win7.exe  |  Size: ' + fileSizeMB + ' MB');
    console.log('\n\u{1F4E6} Distribution Contents:');
    console.log('   \u2713 DICOM-Router-Win7.exe   (Main executable)');
    console.log('   \u2713 START_DICOM_ROUTER.bat  (Main launcher - recommended)');
    console.log('   \u2713 DICOM-Router.vbs         (Silent launcher - no console window)');
    console.log('   \u2713 START_DEBUG.bat          (Debug launcher - console visible)');
    console.log('   \u2713 test-auth-quick.bat      (Authentication testing tool)');
    console.log('   \u2713 test-all-endpoints.bat   (Complete API test suite)');
    console.log('   \u2713 TESTING_GUIDE.md, CURL_API_REFERENCE.md (Documentation)');
    console.log('   \u2713 README.txt, .env.example, frontend/, storage/');
    console.log('\n\u{1F680} Quick Start:');
    console.log('   1. Zip the entire dist folder and extract on target Windows 7 machine');
    console.log('   2. Double-click START_DICOM_ROUTER.bat to configure and run');
    console.log('   3. Use test-auth-quick.bat to verify authentication');
    console.log('   4. Or use DICOM-Router.vbs to run silently (browser opens automatically)');
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n\u274C Build failed:', error.message);
    process.exit(1);
  }
}

build();
