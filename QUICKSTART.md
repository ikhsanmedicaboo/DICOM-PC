# Quick Start Guide for Windows 7

## Overview
This guide will help you quickly set up and run the DICOM Router on Windows 7.

## Prerequisites Checklist

Before you begin, make sure you have:

- [ ] Windows 7 SP1 installed
- [ ] Administrator access
- [ ] Internet connection
- [ ] Fuji FCR machine on same network

## Step-by-Step Installation

### Step 1: Install Node.js (10 minutes)

1. Download Node.js v12.22.12:
   - Go to: https://nodejs.org/download/release/v12.22.12/
   - Download: `node-v12.22.12-x64.msi` (for 64-bit Windows)
   
2. Run the installer
   - Double-click the downloaded file
   - Click "Next" through the wizard
   - Accept the license agreement
   - Use default installation location: `C:\Program Files\nodejs\`
   - Click "Install"
   - Click "Finish"

3. Verify installation
   - Open Command Prompt (Start → Run → cmd)
   - Type: `node --version`
   - Should show: `v12.22.12`
   - Type: `npm --version`
   - Should show: `6.14.16`

### Step 2: Install Visual C++ Redistributable (5 minutes)

1. Download from: https://aka.ms/vs/16/release/vc_redist.x64.exe
2. Run the installer
3. Click "Install"
4. Restart computer if prompted

### Step 3: Extract Project (2 minutes)

1. Copy the `assist-dicom` folder to: `C:\assist-dicom`
2. Make sure the path is simple (no spaces or special characters)

### Step 4: Install Dependencies (5-10 minutes)

1. Open Command Prompt
2. Navigate to project:
   ```cmd
   cd C:\assist-dicom
   ```

3. Install packages:
   ```cmd
   npm install
   ```
   
4. Wait for installation to complete (may take 5-10 minutes)

**If you see errors:**
- Close and reopen Command Prompt as Administrator
- Run: `npm install --build-from-source`

### Step 5: Configure Application (5 minutes)

1. Copy environment file:
   ```cmd
   copy .env.example .env
   ```

2. Edit configuration:
   ```cmd
   notepad .env
   ```

3. Update these settings:
   ```env
   DICOM_PORT=11112
   DICOM_AET=ASSIST_DICOM
   FUJI_AET=FUJI_FCR
   
   # For localhost testing:
   API_URL=http://localhost:5000/api/receive
   HOSPITAL_ID=TEST_HOSPITAL
   API_KEY=test-key-123
   
   # For production (get credentials from admin):
   # API_URL=https://api-dicom-router.assist.id/api/receive
   # HOSPITAL_ID=your-hospital-id
   # API_KEY=your-api-key
   
   WEB_PORT=3000
   ```
   
   **Important**: You must obtain valid `HOSPITAL_ID` and `API_KEY` credentials from the API administrator before the router can forward files.

4. Save and close Notepad

### Step 6: Configure Firewall (5 minutes)

1. Open Command Prompt as Administrator:
   - Right-click Command Prompt
   - Select "Run as Administrator"

2. Run these commands:
   ```cmd
   netsh advfirewall firewall add rule name="DICOM Router" dir=in action=allow protocol=TCP localport=11112
   
   netsh advfirewall firewall add rule name="DICOM Web UI" dir=in action=allow protocol=TCP localport=3000
   ```

3. You should see: "Ok." after each command

### Step 7: Start the Application (1 minute)

1. Double-click `start.bat` in the project folder

   OR

   In Command Prompt:
   ```cmd
   cd C:\assist-dicom
   npm start
   ```

2. Wait for the application to start (about 10 seconds)

3. You should see:
   ```
   DICOM Router Server Started
   Web UI: http://0.0.0.0:3000
   DICOM Port: 11112
   ```

### Step 8: Access Dashboard (1 minute)

1. Open Internet Explorer or another browser
2. Go to: `http://localhost:3000`
3. You should see the DICOM Router Dashboard

### Step 9: Validate Connection (3 minutes)

In the dashboard:

1. Click the "Validation" tab
2. Click "Test DICOM Listener"
   - Should show: ✓ DICOM listener is running
3. Click "Test API Connection"
   - Should show: ✓ API connection successful
4. Click "Test Authentication"
   - Should show: ✓ Authentication configured

### Step 10: Configure Fuji FCR (5 minutes)

On your Fuji FCR machine:

1. Go to DICOM settings/configuration
2. Set up new destination:
   - **Name**: ASSIST_DICOM
   - **AE Title**: ASSIST_DICOM
   - **IP Address**: [Your Windows 7 PC IP address]
   - **Port**: 11112
   - **Your AE Title**: FUJI_FCR

3. Test connection from Fuji (if available)

## How to Find Your Windows 7 IP Address

1. Open Command Prompt
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your network adapter
4. Example: `192.168.1.100`
5. Use this IP in Fuji FCR configuration

## Testing the Complete Workflow

1. Send a test DICOM file from Fuji FCR to ASSIST_DICOM
2. Watch the dashboard - you should see:
   - "File Received" notification
   - New entry in Transfer Logs
   - Transfer status changes from "pending" to "sent"
3. Check the "System Events" tab for details

## Common First-Time Issues

### "Node.js is not recognized"
**Solution**: Restart Command Prompt or computer after installing Node.js

### "Cannot find module..."
**Solution**: Make sure you ran `npm install` in the project directory

### "Port 11112 already in use"
**Solution**: 
- Check if another DICOM application is running
- Change DICOM_PORT in .env to a different port (e.g., 11113)

### Dashboard won't load
**Solution**:
- Check if server started successfully
- Try: `http://127.0.0.1:3000` instead of localhost
- Check Windows Firewall settings

### Fuji cannot connect
**Solution**:
1. Verify Windows 7 IP address is correct
2. Check firewall is configured
3. Ping Windows 7 from Fuji (if possible)
4. Make sure both machines are on same network

## Daily Operation

### Starting the Application

**Method 1: Double-click**
- Double-click `start.bat` in project folder

**Method 2: Command line**
```cmd
cd C:\assist-dicom
npm start
```

### Stopping the Application

- Press `Ctrl+C` in Command Prompt window
- Type `Y` when asked to terminate batch job

### Checking Logs

View logs at: `C:\assist-dicom\storage\logs\app.log`

## Maintenance

### Weekly Tasks
- Check disk space in `C:\assist-dicom\storage\dicom\`
- Review failed transfers in dashboard
- Clear old DICOM files if needed

### Monthly Tasks
- Backup database: `C:\assist-dicom\storage\logs.db`
- Review system events for patterns
- Update API credentials if changed

## Getting Help

1. **Check dashboard** → System Events tab
2. **Check logs** → `storage\logs\app.log`
3. **Run tests** → Double-click `test.bat`
4. **Read full documentation** → README.md

## Next Steps

✅ Application is running  
✅ Dashboard is accessible  
✅ Connections validated  
✅ Fuji configured  

**You're ready to start receiving and forwarding DICOM files!**

Monitor the dashboard to ensure files are being processed correctly.
