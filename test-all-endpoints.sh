#!/bin/bash

# DICOM Router - Complete API Test Script
# Tests all endpoints with your credentials

BASE_URL="http://localhost:3001"
HOSPITAL_ID="678484fe219a19629b962377"
API_KEY="Njc4NDg0ZmUyMTlhMTk2MjliOTYyMzc3OkJpc21pbGxhaFJhZGlvbG9neTEyMyE"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     DICOM Router - API Endpoint Test Suite                    ║"
echo "║     Testing all endpoints with your credentials               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Function to print section header
section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo ""
    echo "▶ Testing: $name"
    echo "  Method: $method"
    echo "  URL: ${BASE_URL}${endpoint}"
    
    if [ "$method" = "GET" ]; then
        curl -s -w "\n  HTTP Status: %{http_code}\n" \
             -X GET "${BASE_URL}${endpoint}" | jq '.' 2>/dev/null || echo "  (Response not JSON or jq not installed)"
    elif [ "$method" = "POST" ] && [ -z "$data" ]; then
        curl -s -w "\n  HTTP Status: %{http_code}\n" \
             -X POST "${BASE_URL}${endpoint}" \
             -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "  (Response not JSON or jq not installed)"
    else
        curl -s -w "\n  HTTP Status: %{http_code}\n" \
             -X POST "${BASE_URL}${endpoint}" \
             -H "Content-Type: application/json" \
             -d "$data" | jq '.' 2>/dev/null || echo "  (Response not JSON or jq not installed)"
    fi
    
    sleep 1
}

# 0. Health Check
section "0. HEALTH CHECK"
test_endpoint "Health Check" "GET" "/health"

# 1. Configuration
section "1. CONFIGURATION"
test_endpoint "Get Configuration" "GET" "/api/config"

# 2. Authentication
section "2. AUTHENTICATION ENDPOINTS"

test_endpoint "Validate Credentials" "POST" "/api/auth/validate" \
'{
  "hospital_id": "'$HOSPITAL_ID'",
  "api_key": "'$API_KEY'"
}'

test_endpoint "Auto Login" "POST" "/api/auth/auto-login"

# 3. Validation
section "3. VALIDATION ENDPOINTS"

test_endpoint "Test API Connection" "POST" "/api/validate/api"

test_endpoint "Validate Auth Configuration" "POST" "/api/validate/auth"

# 4. DICOM Listener
section "4. DICOM LISTENER ENDPOINTS"

test_endpoint "Get DICOM Status" "GET" "/api/dicom/status"

test_endpoint "Start DICOM Listener" "POST" "/api/dicom/start"

sleep 2

test_endpoint "Get DICOM Status (After Start)" "GET" "/api/dicom/status"

# 5. API Forwarder
section "5. API FORWARDER ENDPOINTS"

test_endpoint "Start API Forwarder" "POST" "/api/validate/forwarder/start"

# 6. System Status
section "6. SYSTEM STATUS ENDPOINTS"

test_endpoint "Get Overall Status" "GET" "/api/status"

test_endpoint "Get Recent Transfers" "GET" "/api/transfers?limit=10"

test_endpoint "Get Recent Events" "GET" "/api/events?limit=10"

test_endpoint "Get Recent API Logs" "GET" "/api/logs?limit=10"

# Summary
section "TEST SUMMARY"

echo ""
echo "✅ All endpoints tested!"
echo ""
echo "Next steps:"
echo "  1. Check if authentication passed (look for 'success: true')"
echo "  2. Verify DICOM listener is running (status should show 'running: true')"
echo "  3. Check system status endpoint for overall health"
echo ""
echo "If you see HTTP Status codes:"
echo "  - 200: Success ✓"
echo "  - 401: Authentication failed (check credentials)"
echo "  - 500: Server error (check logs)"
echo "  - Connection errors: Server might not be running"
echo ""
echo "To view detailed logs:"
echo "  tail -f storage/logs/app.log"
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     Test Complete - Check output above for any errors         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
