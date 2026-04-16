# 🔧 API Testing Tools - Quick Start Guide

I've created comprehensive testing tools to help you troubleshoot and validate your DICOM Router authentication and all API endpoints.

## 📁 Files Created

1. **CURL_API_REFERENCE.md** - Complete API documentation with all curl commands
2. **test-auth-quick.bat** - Quick authentication test (Windows) ⭐ **START HERE**
3. **test-all-endpoints.bat** - Complete endpoint test suite (Windows)
4. **test-all-endpoints.sh** - Complete endpoint test suite (macOS/Linux/Git Bash)

---

## 🚀 Quick Start - Test Authentication

### **Windows (Recommended):**

Simply double-click or run:
```cmd
test-auth-quick.bat
```

This will:
- ✓ Check if server is running
- ✓ Test server health
- ✓ Validate your credentials
- ✓ Show detailed results
- ✓ Verify .env file configuration

### **macOS/Linux/Git Bash:**

```bash
./test-all-endpoints.sh
```

---

## 🔍 What Each Tool Does

### 1. test-auth-quick.bat ⭐ **START HERE**
**Use this first to diagnose authentication issues**

- Checks if server is running
- Tests basic connectivity
- Validates credentials from .env
- Shows clear success/failure messages
- Provides troubleshooting tips

**When to use:**
- ✓ Authentication is failing
- ✓ Need to quickly verify credentials
- ✓ Troubleshooting connection issues

---

### 2. test-all-endpoints.bat / .sh
**Comprehensive test of ALL API endpoints**

Tests these endpoints:
- Health check
- Configuration
- Credential validation
- Auto login
- API connection test
- Auth configuration validation
- DICOM listener (start/status)
- API forwarder (start)
- System status
- Transfers, events, and logs

**When to use:**
- ✓ Full system validation
- ✓ After setup completion
- ✓ Regression testing
- ✓ Verifying all features work

---

### 3. CURL_API_REFERENCE.md
**Complete API documentation**

Contains:
- All 18 API endpoints
- Complete curl commands
- Expected responses
- Troubleshooting guide
- Quick reference table

**When to use:**
- ✓ Need specific curl commands
- ✓ API documentation reference
- ✓ Integration development
- ✓ Custom testing scripts

---

## 📋 Testing Workflow

### Step 1: Start the Server

**Option A - Using bat file:**
```cmd
START_DICOM_ROUTER.bat
```

**Option B - Using npm:**
```cmd
npm start
```

**Option C - Using executable (after build):**
```cmd
cd dist
START_DICOM_ROUTER.bat
```

---

### Step 2: Run Quick Auth Test

```cmd
test-auth-quick.bat
```

**Look for:**
```json
{
  "success": true,
  "message": "Credentials validated successfully",
  "data": {
    "hospital_id": "678484fe219a19629b962377",
    "hospital_name": "Your Hospital Name",
    "authenticated": true
  }
}
```

✅ If you see `"success": true` → **Authentication works!**
❌ If you see `"success": false` → **See troubleshooting below**

---

### Step 3: Run Full Test Suite (Optional)

```cmd
test-all-endpoints.bat
```

This will test all 18 endpoints and show the results.

---

## 🔧 Troubleshooting Common Issues

### Issue 1: "Server is NOT running on port 3001"

**Solution:**
1. Open a new terminal/command prompt
2. Navigate to project directory
3. Run: `npm start` or `START_DICOM_ROUTER.bat`
4. Wait for "Server running on port 3001" message
5. Run test again

---

### Issue 2: Authentication Failed (success: false)

**Possible causes:**

1. **Wrong credentials**
   - Check `.env` file
   - Verify HOSPITAL_ID matches: `678484fe219a19629b962377`
   - Verify API_KEY matches: `Njc4NDg0ZmUyMTlhMTk2MjliOTYyMzc3OkJpc21pbGxhaFJhZGlvbG9neTEyMyE`

2. **Network issues**
   ```cmd
   curl -I https://api-dicom-router.assist.id
   ```
   Should return `HTTP/1.1 200 OK` or similar

3. **API server down**
   - Contact Assist.id support
   - Check status at https://assist.id

---

### Issue 3: "curl is not installed"

**Windows:**
- Curl is built into Windows 10/11
- If missing, download from: https://curl.se/windows/
- Or use Git Bash which includes curl

**macOS/Linux:**
- Usually pre-installed
- If missing: `brew install curl` (macOS) or `apt-get install curl` (Linux)

---

### Issue 4: Connection Timeout or Slow

**Solutions:**

1. Check firewall settings
2. Verify internet connectivity
3. Increase timeout in curl:
   ```bash
   curl --max-time 30 ...
   ```

---

## 📊 Manual Testing with curl

### Test Authentication Manually:

```bash
curl -X POST http://localhost:3001/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{
    "hospital_id": "678484fe219a19629b962377",
    "api_key": "Njc4NDg0ZmUyMTlhMTk2MjliOTYyMzc3OkJpc21pbGxhaFJhZGlvbG9neTEyMyE"
  }'
```

### Get System Status:

```bash
curl -X GET http://localhost:3001/api/status
```

### Start DICOM Listener:

```bash
curl -X POST http://localhost:3001/api/dicom/start \
  -H "Content-Type: application/json"
```

See **CURL_API_REFERENCE.md** for all commands.

---

## 📝 Expected Successful Output

When everything is working, `test-auth-quick.bat` should show:

```
================================================================
  DICOM Router - Authentication Quick Test
  Powered by Assist.id
================================================================

[Step 1] Checking if server is running on port 3001...
----------------------------------------------------------------
✓ Server is running on port 3001

[Step 2] Testing server health...
----------------------------------------------------------------
✓ Server is responding

[Step 3] Credentials being tested...
----------------------------------------------------------------
Hospital ID: 678484fe219a19629b962377
API Key: Njc4NDg0ZmUyMTlhMTk2... (truncated for security)
API URL: https://api-dicom-router.assist.id

[Step 4] Testing authentication with your credentials...
----------------------------------------------------------------

Request:
  POST http://localhost:3001/api/auth/validate
  Content-Type: application/json

Response:
{"success":true,"message":"Credentials validated successfully","data":{"hospital_id":"678484fe219a19629b962377","hospital_name":"Your Hospital","authenticated":true}}
HTTP Status: 200
```

---

## 📞 Support

If tests fail after trying troubleshooting steps:

1. **Check logs:**
   ```cmd
   type storage\logs\app.log
   ```

2. **Contact Assist.id Support:**
   - Website: https://assist.id
   - Phone: 082112222500
   - Email: info@assist.id

3. **Provide this information:**
   - Output of `test-auth-quick.bat`
   - Contents of `storage/logs/app.log`
   - Your Hospital ID
   - Error messages received

---

## ✅ Next Steps After Successful Authentication

Once authentication works:

1. ✓ Run full test suite: `test-all-endpoints.bat`
2. ✓ Configure DICOM device to send to port 11112
3. ✓ Access web UI: http://localhost:3001
4. ✓ Monitor transfers in the dashboard

---

**Built by Assist.id - PT. Jaga Anugrah Giat Asa**
