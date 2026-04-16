#!/bin/bash

# Verification Script for Duplicate API Call Fix
# This script helps verify that the duplicate API call issue is fixed

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     Duplicate API Call Fix - Verification Script              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3001"

# Function to check if server is running
check_server() {
    echo "[1] Checking if server is running..."
    if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo "    ✓ Server is running"
        return 0
    else
        echo "    ✗ Server is NOT running"
        echo ""
        echo "    Please start the server first:"
        echo "    npm start"
        echo ""
        return 1
    fi
}

# Function to get DICOM listener status
check_dicom_status() {
    echo ""
    echo "[2] Checking DICOM listener status..."
    STATUS=$(curl -s "$BASE_URL/api/dicom/status")
    echo "$STATUS" | jq '.' 2>/dev/null || echo "$STATUS"
    
    METHOD=$(echo "$STATUS" | jq -r '.status.method' 2>/dev/null)
    if [ "$METHOD" = "built-in" ]; then
        echo ""
        echo "    ℹ Using built-in listener (fix is most important for this mode)"
    elif [ "$METHOD" = "storescp" ]; then
        echo ""
        echo "    ℹ Using storescp (fix still provides extra protection)"
    fi
}

# Function to monitor transfers for duplicates
check_recent_transfers() {
    echo ""
    echo "[3] Checking recent transfers for duplicates..."
    TRANSFERS=$(curl -s "$BASE_URL/api/transfers?limit=20")
    
    echo "$TRANSFERS" | jq '.transfers[] | {id, patient_id, study_instance_uid, created_at}' 2>/dev/null || echo "    (jq not installed - showing raw output)"
    
    # Count duplicates by study_instance_uid within 10 seconds
    echo ""
    echo "    Analyzing for duplicates..."
    
    DUPLICATE_COUNT=$(echo "$TRANSFERS" | jq '[.transfers[] | {uid: .study_instance_uid, time: .created_at}] | group_by(.uid) | map(select(length > 1)) | length' 2>/dev/null)
    
    if [ "$DUPLICATE_COUNT" = "0" ]; then
        echo "    ✓ No duplicate Study Instance UIDs found in recent transfers"
    else
        echo "    ⚠ Found $DUPLICATE_COUNT potentially duplicate Study Instance UIDs"
        echo "    (This might be intentional if the same study was sent multiple times)"
    fi
}

# Function to check recent events for duplicate warnings
check_events() {
    echo ""
    echo "[4] Checking for duplicate detection events..."
    EVENTS=$(curl -s "$BASE_URL/api/events?limit=50")
    
    SKIP_COUNT=$(echo "$EVENTS" | jq '[.events[] | select(.message | contains("Skipping duplicate"))] | length' 2>/dev/null)
    
    if [ "$SKIP_COUNT" = "0" ]; then
        echo "    ℹ No duplicate skips detected (either no duplicates or no recent activity)"
    else
        echo "    ✓ Duplicate protection triggered $SKIP_COUNT times"
        echo ""
        echo "    Recent duplicate skip events:"
        echo "$EVENTS" | jq '.events[] | select(.message | contains("Skipping duplicate")) | {timestamp, message}' 2>/dev/null | head -20
    fi
}

# Function to watch logs in real-time
watch_logs() {
    echo ""
    echo "[5] Monitoring logs for duplicate processing..."
    echo "    (Press Ctrl+C to stop)"
    echo ""
    echo "    Watching for:"
    echo "    - 'Processing DICOM file' (should appear ONCE per file)"
    echo "    - 'Skipping duplicate processing' (indicates protection working)"
    echo ""
    
    if [ -f "storage/logs/app.log" ]; then
        tail -f storage/logs/app.log | grep --line-buffered -E "(Processing DICOM file|Skipping duplicate|Transfer.*created and queued)"
    else
        echo "    ✗ Log file not found at storage/logs/app.log"
    fi
}

# Main execution
main() {
    if ! check_server; then
        exit 1
    fi
    
    check_dicom_status
    check_recent_transfers
    check_events
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Would you like to watch logs in real-time? (y/n)"
    read -r response
    
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        watch_logs
    else
        echo ""
        echo "Verification complete!"
        echo ""
        echo "To manually watch logs:"
        echo "  tail -f storage/logs/app.log | grep 'Processing DICOM'"
        echo ""
        echo "To check for duplicates after sending a DICOM file:"
        echo "  curl http://localhost:3001/api/transfers?limit=10"
        echo ""
    fi
}

# Run main function
main
