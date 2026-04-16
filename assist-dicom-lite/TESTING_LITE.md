# Lite Version Testing Guide

## Features to Test

### 1. Environment Validation ✅
### 2. Credential Validation ✅
### 3. Duplicate API Call Prevention ✅

---

## Test 1: Missing Configuration

**Purpose:** Verify app stops if credentials are not configured

**Steps:**
```bash
cd assist-dicom-lite

# Remove .env file
rm .env

# Try to start
npm start
```

**Expected Output:**
```
╔═══════════════════════════════════════════════════════════════╗
║          CONFIGURATION ERROR - Missing Credentials             ║
╚═══════════════════════════════════════════════════════════════╝

❌ Configuration errors detected:

   1. HOSPITAL_ID is not set in .env file
   2. API_KEY is not set in .env file

📝 Required steps:
   [Shows instructions...]

[Application exits - does NOT start]
```

**Status:** 🔲 Not Tested | ✅ Pass | ❌ Fail

---

## Test 2: Invalid Credentials

**Purpose:** Verify app validates credentials with API before starting

**Steps:**
```bash
cd assist-dicom-lite

# Create .env with invalid credentials
cat > .env << 'EOF'
API_URL=https://api-dicom-router.assist.id
API_KEY=invalid_key_12345
HOSPITAL_ID=invalid_id_12345
DICOM_PORT=11112
EOF

# Try to start
npm start
```

**Expected Output:**
```
╔═══════════════════════════════════════════════════════════════╗
║          Validating Credentials with API                      ║
╚═══════════════════════════════════════════════════════════════╝

Hospital ID: invalid_id_12345
API URL: https://api-dicom-router.assist.id

Testing authentication...

❌ Authentication failed!
   Error: Invalid hospital credentials
   HTTP Status: 401

📝 Please check:
   1. HOSPITAL_ID is correct
   2. API_KEY is correct and not expired
   [...]

[Application exits - does NOT start]
```

**Status:** ✅ Tested & Passed (see terminal output above)

---

## Test 3: Valid Credentials

**Purpose:** Verify app starts normally with valid credentials

**Steps:**
```bash
cd assist-dicom-lite

# Edit .env with VALID credentials from Assist.id
nano .env
# OR copy from main version:
cp ../backend/.env .env

# Start the app
npm start
```

**Expected Output:**
```
╔═══════════════════════════════════════════════════════════════╗
║          Validating Credentials with API                      ║
╚═══════════════════════════════════════════════════════════════╝

Hospital ID: 678484fe219a19629b962377
API URL: https://api-dicom-router.assist.id

Testing authentication...

✅ Authentication successful!
   Hospital: Bismillah Radiology
   Status: Authenticated

════════════════════════════════════════════════════════════════

╔═══════════════════════════════════════════════════════════════╗
║          DICOM Router Lite - Starting                         ║
╚═══════════════════════════════════════════════════════════════╝

[Server starts normally...]
```

**Status:** 🔲 Awaiting valid credentials from Assist.id

---

## Test 4: Network Error (API Unreachable)

**Purpose:** Verify app behavior when API is unreachable

**Steps:**
```bash
cd assist-dicom-lite

# Edit .env with invalid API_URL
cat > .env << 'EOF'
API_URL=https://invalid-api-url-that-does-not-exist.com
API_KEY=Njc4NDg0ZmUyMTlhMTk2MjliOTYyMzc3OkJpc21pbGxhaFJhZGlvbG9neTEyMyE
HOSPITAL_ID=678484fe219a19629b962377
DICOM_PORT=11112
EOF

# Try to start
npm start
```

**Expected Output:**
```
╔═══════════════════════════════════════════════════════════════╗
║          Validating Credentials with API                      ║
╚═══════════════════════════════════════════════════════════════╝

Hospital ID: 678484fe219a19629b962377
API URL: https://invalid-api-url-that-does-not-exist.com

Testing authentication...

❌ Cannot connect to API server!
   Error: getaddrinfo ENOTFOUND invalid-api-url-that-does-not-exist.com

📝 Please check:
   1. Internet connection is active
   2. API URL is correct
   3. Firewall is not blocking the connection

⚠️  Starting anyway (will retry when receiving DICOM files)...

════════════════════════════════════════════════════════════════

[Server CONTINUES to start - network error is non-fatal]
```

**Status:** 🔲 Not Tested | ✅ Pass | ❌ Fail

---

## Test 5: Duplicate API Call Prevention

**Purpose:** Verify DICOM files are only processed once

**Prerequisites:**
- Valid credentials in .env
- App running successfully

**Steps:**

### Step 5.1: Start with Clean State
```bash
cd assist-dicom-lite

# Clean previous data
rm -f storage/lite-store.json
rm -f storage/dicom/*

# Start the app
npm start
```

### Step 5.2: Send Test DICOM File
```bash
# In another terminal, send a DICOM file
cd assist-dicom-lite

# Option A: Using storescu (if DCMTK installed)
storescu localhost 11112 -aec ASSIST_ROUTER path/to/test.dcm

# Option B: Copy file directly (triggers file watcher)
cp path/to/test.dcm storage/dicom/
```

### Step 5.3: Check Logs
```bash
# Check application logs
tail -f storage/logs/app.log | grep -i "processing\|duplicate\|forwarder"
```

**Expected Log Output (SINGLE processing):**
```
[INFO] Processing DICOM file: dcm_1234567890_ABC123.dcm
[INFO] Patient: DOE^JOHN, Study: CT CHEST
[INFO] API Forwarder: Transferring dcm_1234567890_ABC123.dcm
[INFO] API Forwarder: Successfully transferred dcm_1234567890_ABC123.dcm
```

**If duplicate detected (should NOT happen):**
```
[INFO] Processing DICOM file: dcm_1234567890_ABC123.dcm
[WARN] Skipping duplicate processing of dcm_1234567890_ABC123.dcm (processed 1234ms ago)
```

### Step 5.4: Verify API Calls
```bash
# Check lite-store.json
cat storage/lite-store.json | jq '.transfers'
```

**Expected:** Only ONE transfer entry for the file

**Status:** 🔲 Not Tested | ✅ Pass | ❌ Fail

---

## Test 6: Multiple Files (Stress Test)

**Purpose:** Verify duplicate prevention works with multiple concurrent files

**Prerequisites:**
- Valid credentials
- App running
- Multiple DICOM test files

**Steps:**
```bash
# Send 10 DICOM files quickly
for i in {1..10}; do
  cp test_files/test$i.dcm storage/dicom/ &
done

# Wait for processing
sleep 10

# Count transfers
cat storage/lite-store.json | jq '.transfers | length'
```

**Expected:** Exactly 10 transfers (no duplicates)

**Status:** 🔲 Not Tested | ✅ Pass | ❌ Fail

---

## Test 7: Build Executable

**Purpose:** Verify executable includes all validation features

**Steps:**
```bash
cd assist-dicom-lite

# Build the executable
npm run build:full
# (Note: May need to create build script for lite version)

# Check dist folder
ls -lh dist/

# Test the executable
cd dist
./DICOM-Router-Lite-Win7.exe
```

**Expected:**
- Executable starts
- Shows validation banner
- Validates credentials before starting

**Status:** 🔲 Not Tested | ✅ Pass | ❌ Fail

---

## Current Test Status Summary

| Test | Feature | Status |
|------|---------|--------|
| 1 | Missing configuration detection | 🔲 Not Tested |
| 2 | Invalid credentials detection | ✅ **PASSED** |
| 3 | Valid credentials startup | 🔲 Awaiting valid API key |
| 4 | Network error handling | 🔲 Not Tested |
| 5 | Duplicate prevention | 🔲 Not Tested |
| 6 | Multiple files stress test | 🔲 Not Tested |
| 7 | Executable build | 🔲 Not Tested |

---

## Getting Valid Credentials

To complete testing, you need valid credentials from Assist.id:

1. **Option A:** Contact Assist.id Support
   - Website: https://assist.id
   - Phone: 082112222500
   - Request HOSPITAL_ID and API_KEY

2. **Option B:** Copy from Main Version
   ```bash
   # If main version has valid credentials
   cp ../backend/.env ./assist-dicom-lite/.env
   ```

3. **Option C:** Use Production Credentials
   ```bash
   # Edit .env file
   nano .env
   
   # Add your credentials:
   HOSPITAL_ID=your_actual_hospital_id
   API_KEY=your_actual_api_key
   API_URL=https://api-dicom-router.assist.id
   ```

---

## Quick Test Script

Create this script for automated testing:

```bash
#!/bin/bash
# test-lite-validation.sh

echo "=== Testing Lite Version Validation ==="
echo ""

# Test 1: Missing config
echo "Test 1: Missing Configuration"
rm -f .env
timeout 5 npm start 2>&1 | grep -q "CONFIGURATION ERROR" && echo "✅ PASS" || echo "❌ FAIL"
echo ""

# Test 2: Invalid credentials  
echo "Test 2: Invalid Credentials"
cat > .env << EOF
API_URL=https://api-dicom-router.assist.id
API_KEY=invalid
HOSPITAL_ID=invalid
DICOM_PORT=11112
EOF
timeout 5 npm start 2>&1 | grep -q "Authentication failed" && echo "✅ PASS" || echo "❌ FAIL"
echo ""

# Test 3: Valid credentials (requires manual setup)
echo "Test 3: Valid Credentials"
echo "🔲 Manual test - requires valid API credentials"
echo ""

echo "=== Test Summary ==="
echo "See results above"
```

**Run:**
```bash
cd assist-dicom-lite
chmod +x test-lite-validation.sh
./test-lite-validation.sh
```

---

## Troubleshooting

### Issue: "Cannot find module 'axios'"
**Solution:**
```bash
npm install
```

### Issue: API timeout
**Solution:**
```bash
# Increase timeout in .env
API_TIMEOUT=60000
```

### Issue: Port already in use
**Solution:**
```bash
# Change port in .env
DICOM_PORT=11113
```

---

**Last Updated:** April 15, 2026  
**Version:** 1.0.1
