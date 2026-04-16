// Main application logic
const API_BASE = window.location.origin;

// State
let appState = {
    authenticated: false,
    hospitalId: '',
    apiKey: '',
    hospitalName: ''
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing DICOM Router Dashboard');
    
    // Check authentication state (auto-login first, then local storage)
    checkAuthentication();
    
    // Update server time
    updateServerTime();
    setInterval(updateServerTime, 1000);
    
    // Attach event listeners
    attachEventListeners();
});

// Check authentication status
async function checkAuthentication() {
    const autoLoginSuccess = await tryAutoLoginFromConfig();
    if (autoLoginSuccess) {
        return;
    }

    const savedHospitalId = localStorage.getItem('hospitalId');
    const savedApiKey = localStorage.getItem('apiKey');
    
    if (savedHospitalId && savedApiKey) {
        // Auto-login with saved credentials
        document.getElementById('hospitalId').value = savedHospitalId;
        document.getElementById('apiKey').value = savedApiKey;
        document.getElementById('rememberMe').checked = true;
        authenticateCredentials(savedHospitalId, savedApiKey);
    } else {
        showLoginScreen();
    }
}

async function tryAutoLoginFromConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/auto-login`, {
            method: 'POST'
        });
        const data = await response.json();

        if (!response.ok || !data.success || !data.authenticated) {
            return false;
        }

        const hospitalId = data.data && data.data.hospital_id ? data.data.hospital_id : '';
        const hospitalName = data.data && data.data.hospital_name ? data.data.hospital_name : '';

        appState.authenticated = true;
        appState.hospitalId = hospitalId;
        appState.apiKey = '';
        appState.hospitalName = hospitalName;

        updateHospitalInfo(hospitalId, hospitalName);
        showDashboard();

        setTimeout(() => {
            showToast('Auto Login', `Welcome! ${hospitalName || hospitalId}`, 'success');
        }, 500);

        return true;
    } catch (error) {
        console.error('Auto-login check failed:', error);
        return false;
    }
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboardContent').style.display = 'none';
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardContent').style.display = 'block';
    
    // Load initial data
    setTimeout(() => {
        refreshData();
    }, 500);
    
    // Auto-refresh every 10 seconds
    setInterval(() => {
        if (document.visibilityState === 'visible' && appState.authenticated) {
            refreshData();
        }
    }, 10000);
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const hospitalId = document.getElementById('hospitalId').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;
    
    if (!hospitalId || !apiKey) {
        showLoginError('Please enter both Hospital ID and API Key');
        return;
    }
    
    // Disable form
    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Validating...';
    
    // Hide previous errors
    document.getElementById('loginError').classList.add('d-none');
    
    try {
        // Authenticate credentials
        await authenticateCredentials(hospitalId, apiKey, rememberMe);
    } catch (error) {
        console.error('Login failed:', error);
        showLoginError(error.message || 'Authentication failed. Please check your credentials.');
        
        // Re-enable form
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Login';
    }
}

// Authenticate credentials with backend
async function authenticateCredentials(hospitalId, apiKey, rememberMe = false) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                hospital_id: hospitalId,
                api_key: apiKey
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Invalid credentials');
        }
        
        // Store credentials
        appState.authenticated = true;
        appState.hospitalId = hospitalId;
        appState.apiKey = apiKey;
        appState.hospitalName = data.data && data.data.hospital_name ? data.data.hospital_name : '';

        updateHospitalInfo(hospitalId, appState.hospitalName);
        
        // Save to localStorage if remember me is checked
        if (rememberMe) {
            localStorage.setItem('hospitalId', hospitalId);
            localStorage.setItem('apiKey', apiKey);
        } else {
            localStorage.removeItem('hospitalId');
            localStorage.removeItem('apiKey');
        }
        
        // Show dashboard
        showDashboard();
        
        // Show success message
        setTimeout(() => {
            showToast('Login Successful', `Welcome! ${appState.hospitalName || hospitalId}`, 'success');
        }, 500);
        
    } catch (error) {
        // Re-enable form on error
        const btn = document.getElementById('btnLogin');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Login';
        }
        throw error;
    }
}

// Show login error
function showLoginError(message) {
    const errorEl = document.getElementById('loginError');
    const errorMsg = document.getElementById('loginErrorMsg');
    
    errorMsg.textContent = message;
    errorEl.classList.remove('d-none');
}

function updateHospitalInfo(hospitalId, hospitalName) {
    const hospitalInfoEl = document.getElementById('hospitalInfo');
    if (!hospitalInfoEl) return;

    const display = hospitalName || hospitalId || '--';
    hospitalInfoEl.textContent = `Hospital: ${display}`;
}

// Update server time display
function updateServerTime() {
    const timeEl = document.getElementById('serverTime');
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString();
    }
}

// Attach all event listeners
function attachEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    
    // API test
    document.getElementById('btnTestApi')?.addEventListener('click', testApiConnection);
    
    // Refresh buttons
    document.getElementById('btnRefreshTransfers')?.addEventListener('click', refreshTransfers);
    document.getElementById('btnRefreshEvents')?.addEventListener('click', refreshEvents);
    
    // Validation buttons
    document.getElementById('btnValidateApi')?.addEventListener('click', validateApi);
    document.getElementById('btnValidateAuth')?.addEventListener('click', validateAuth);
    
    // Upload form
    document.getElementById('uploadForm')?.addEventListener('submit', handleUpload);
    document.getElementById('dicomFile')?.addEventListener('change', handleFileSelect);
    document.getElementById('btnClearUpload')?.addEventListener('click', clearUploadForm);
}

// Refresh all data
function refreshData() {
    updateStats();
    refreshTransfers();
    refreshEvents();
}

// Update statistics
async function updateStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        if (data.success && data.stats) {
            document.getElementById('statsTotal').textContent = data.stats.total || 0;
            document.getElementById('statsSent').textContent = data.stats.sent || 0;
            document.getElementById('statsPending').textContent = data.stats.pending || 0;
            document.getElementById('statsFailed').textContent = data.stats.failed || 0;
            
            const successRate = parseFloat(data.stats.successRate) || 0;
            document.getElementById('statsRate').textContent = `Success: ${successRate}%`;
            document.getElementById('statsProgress').style.width = `${successRate}%`;
            document.getElementById('statsProgress').setAttribute('aria-valuenow', successRate);
        }
    } catch (error) {
        console.error('Failed to update stats:', error);
    }
}

// Refresh transfers table
async function refreshTransfers() {
    try {
        const response = await fetch(`${API_BASE}/api/transfers?limit=50`);
        const data = await response.json();
        
        if (data.success && data.transfers) {
            renderTransfersTable(data.transfers);
        }
    } catch (error) {
        console.error('Failed to fetch transfers:', error);
        showError('transfersTableBody', 'Failed to load transfers');
    }
}

// Render transfers table
function renderTransfersTable(transfers) {
    const tbody = document.getElementById('transfersTableBody');
    if (!tbody) return;
    
    if (transfers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted">No transfers found</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = transfers.map(transfer => `
        <tr class="transfer-row" data-transfer-id="${transfer.id}" style="cursor: pointer;">
            <td>${transfer.id}</td>
            <td>${escapeHtml(transfer.patient_id || '-')}</td>
            <td>${escapeHtml(transfer.patient_name || '-')}</td>
            <td>${formatDate(transfer.study_date)}</td>
            <td><span class="badge bg-secondary">${escapeHtml(transfer.modality || '-')}</span></td>
            <td class="file-size">${formatBytes(transfer.file_size)}</td>
            <td>${renderStatusBadge(transfer.status)}</td>
            <td>${transfer.retries || 0}</td>
            <td>${formatDateTime(transfer.created_at)}</td>
        </tr>
    `).join('');
    
    // Attach click event to all transfer rows
    tbody.querySelectorAll('.transfer-row').forEach(row => {
        row.addEventListener('click', () => {
            const transferId = row.getAttribute('data-transfer-id');
            showTransferDetails(transferId);
        });
    });
}

// Render status badge
function renderStatusBadge(status) {
    const statusMap = {
        'pending': 'badge-pending',
        'sent': 'badge-sent',
        'failed': 'badge-failed'
    };
    
    const badgeClass = statusMap[status] || 'bg-secondary';
    return `<span class="badge badge-status ${badgeClass}">${status || 'unknown'}</span>`;
}

// Refresh events log
async function refreshEvents() {
    try {
        const response = await fetch(`${API_BASE}/api/events?limit=100`);
        const data = await response.json();
        
        if (data.success && data.events) {
            renderEventLog(data.events);
        }
    } catch (error) {
        console.error('Failed to fetch events:', error);
        showError('eventLog', 'Failed to load events');
    }
}

// Render event log
function renderEventLog(events) {
    const logEl = document.getElementById('eventLog');
    if (!logEl) return;
    
    if (events.length === 0) {
        logEl.innerHTML = '<div class="text-center text-muted">No events found</div>';
        return;
    }
    
    logEl.innerHTML = events.map(event => `
        <div class="event-item event-${event.level || 'info'}">
            <div class="d-flex justify-content-between">
                <strong>${escapeHtml(event.type)}</strong>
                <span class="event-timestamp">${formatDateTime(event.timestamp)}</span>
            </div>
            <p class="event-message">${escapeHtml(event.message)}</p>
        </div>
    `).join('');
}

// Test API connection
async function testApiConnection() {
    try {
        const btn = document.getElementById('btnTestApi');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Testing...';
        
        const response = await fetch(`${API_BASE}/api/validate/api`, {
            method: 'POST'
        });
        const data = await response.json();
        
        const apiStatus = document.getElementById('apiStatus');
        if (apiStatus) {
            const statusClass = data.success ? 'status-running' : 'status-error';
            apiStatus.innerHTML = `<i class="bi bi-circle-fill ${statusClass}"></i>`;
        }
        
        showToast('API Test', data.message, data.success ? 'success' : 'danger');
        
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Test';
    } catch (error) {
        console.error('API test failed:', error);
        showToast('Error', 'Failed to test API connection', 'danger');
        
        const btn = document.getElementById('btnTestApi');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Test';
    }
}

// Toggle DICOM listener
async function toggleDicomListener() {
    try {
        const btn = document.getElementById('btnToggleDicom');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        
        const response = await fetch(`${API_BASE}/api/dicom/toggle`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('DICOM Listener', data.message, 'success');
        } else {
            showToast('Error', data.error || 'Failed to toggle DICOM listener', 'danger');
        }
        
        btn.disabled = false;
        // Button text will be updated by socket status update
    } catch (error) {
        console.error('DICOM toggle failed:', error);
        showToast('Error', 'Failed to toggle DICOM listener', 'danger');
        
        const btn = document.getElementById('btnToggleDicom');
        btn.disabled = false;
    }
}

// Validate API
async function validateApi() {
    try {
        const resultEl = document.getElementById('apiValidationResult');
        resultEl.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Testing...';
        
        const response = await fetch(`${API_BASE}/api/validate/api`, {
            method: 'POST'
        });
        const data = await response.json();
        
        renderValidationResult('apiValidationResult', data);
    } catch (error) {
        console.error('API validation failed:', error);
        renderValidationResult('apiValidationResult', {
            success: false,
            error: error.message
        });
    }
}

// Validate Auth
async function validateAuth() {
    try {
        const resultEl = document.getElementById('authValidationResult');
        resultEl.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Testing...';
        
        const response = await fetch(`${API_BASE}/api/validate/auth`, {
            method: 'POST'
        });
        const data = await response.json();
        
        renderValidationResult('authValidationResult', data);
    } catch (error) {
        console.error('Auth validation failed:', error);
        renderValidationResult('authValidationResult', {
            success: false,
            error: error.message
        });
    }
}

// Render validation result
function renderValidationResult(elementId, data) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const resultClass = data.success ? 'validation-success' : 'validation-error';
    const icon = data.success ? 'check-circle' : 'x-circle';
    
    let html = `
        <div class="validation-result ${resultClass}">
            <i class="bi bi-${icon}"></i>
            <strong>${data.message}</strong>
    `;
    
    if (data.details) {
        html += '<ul class="mt-2 mb-0">';
        for (const [key, value] of Object.entries(data.details)) {
            html += `<li>${escapeHtml(key)}: ${escapeHtml(String(value))}</li>`;
        }
        html += '</ul>';
    }
    
    if (data.error) {
        html += `<p class="mt-2 mb-0"><small>Error: ${escapeHtml(data.error)}</small></p>`;
    }
    
    html += '</div>';
    el.innerHTML = html;
}

// Show toast notification
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toastId = 'toast-' + Date.now();
    const bgClass = `bg-${type}`;
    
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header ${bgClass} text-white">
                <strong class="me-auto">${escapeHtml(title)}</strong>
                <small>just now</small>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${escapeHtml(message)}
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 5000 });
    toast.show();
    
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

// Utility: Format bytes
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Utility: Format date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    
    // DICOM date format: YYYYMMDD
    if (dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
    }
    
    return dateStr;
}

// Utility: Format datetime
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    try {
        const date = new Date(dateStr);
        
        // Get local date/time components
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        // Format as YYYY-MM-DD HH:MM:SS (local time)
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        return dateStr;
    }
}

// Utility: Escape HTML
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Show error in element
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-danger">
                    <i class="bi bi-exclamation-triangle"></i> ${escapeHtml(message)}
                </td>
            </tr>
        `;
    }
}

// Show transfer details in modal
async function showTransferDetails(transferId) {
    const modal = new bootstrap.Modal(document.getElementById('transferDetailsModal'));
    const modalBody = document.getElementById('transferDetailsBody');
    
    // Show loading state
    modalBody.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    // Open modal
    modal.show();
    
    try {
        // Fetch transfer details
        const response = await fetch(`${API_BASE}/api/transfers/${transferId}`);
        const data = await response.json();
        
        if (!data.success || !data.transfer) {
            throw new Error('Failed to load transfer details');
        }
        
        // Render transfer details
        modalBody.innerHTML = renderTransferDetails(data.transfer, data.apiLogs || []);
        
    } catch (error) {
        console.error('Error loading transfer details:', error);
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i>
                Failed to load transfer details: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

// Render transfer details
function renderTransferDetails(transfer, apiLogs) {
    const statusClass = transfer.status === 'sent' ? 'success' : 
                        transfer.status === 'failed' ? 'danger' : 
                        transfer.status === 'pending' ? 'warning' : 'secondary';
    
    let html = `
        <!-- Status Header -->
        <div class="alert alert-${statusClass} d-flex align-items-center mb-4">
            <i class="bi bi-${transfer.status === 'sent' ? 'check-circle' : 
                              transfer.status === 'failed' ? 'x-circle' : 
                              'clock'} fs-4 me-3"></i>
            <div>
                <h5 class="mb-0">Status: ${transfer.status.toUpperCase()}</h5>
                ${transfer.error_message ? `<small>${escapeHtml(transfer.error_message)}</small>` : ''}
            </div>
        </div>
        
        <!-- Transfer Information -->
        <div class="card mb-3">
            <div class="card-header bg-light">
                <h6 class="mb-0"><i class="bi bi-info-circle"></i> Transfer Information</h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <dl class="row mb-0">
                            <dt class="col-sm-5">Transfer ID:</dt>
                            <dd class="col-sm-7">${transfer.id}</dd>
                            
                            <dt class="col-sm-5">Status:</dt>
                            <dd class="col-sm-7">${renderStatusBadge(transfer.status)}</dd>
                            
                            <dt class="col-sm-5">Retries:</dt>
                            <dd class="col-sm-7">
                                <span class="badge ${transfer.retries > 0 ? 'bg-warning' : 'bg-success'}">
                                    ${transfer.retries} attempts
                                </span>
                            </dd>
                            
                            <dt class="col-sm-5">File Size:</dt>
                            <dd class="col-sm-7">${formatBytes(transfer.file_size)}</dd>
                        </dl>
                    </div>
                    <div class="col-md-6">
                        <dl class="row mb-0">
                            <dt class="col-sm-5">Created:</dt>
                            <dd class="col-sm-7">${formatDateTime(transfer.created_at)}</dd>
                            
                            <dt class="col-sm-5">Updated:</dt>
                            <dd class="col-sm-7">${formatDateTime(transfer.updated_at)}</dd>
                            
                            <dt class="col-sm-5">Sent At:</dt>
                            <dd class="col-sm-7">${transfer.sent_at ? formatDateTime(transfer.sent_at) : '<em>Not sent yet</em>'}</dd>
                            
                            <dt class="col-sm-5">Source:</dt>
                            <dd class="col-sm-7">${escapeHtml(transfer.fuji_aet || 'Unknown')}</dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Patient & Study Information -->
        <div class="card mb-3">
            <div class="card-header bg-light">
                <h6 class="mb-0"><i class="bi bi-person"></i> Patient & Study Information</h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <dl class="row mb-0">
                            <dt class="col-sm-5">Patient ID:</dt>
                            <dd class="col-sm-7">${escapeHtml(transfer.patient_id || '-')}</dd>
                            
                            <dt class="col-sm-5">Patient Name:</dt>
                            <dd class="col-sm-7">${escapeHtml(transfer.patient_name || '-')}</dd>
                            
                            <dt class="col-sm-5">Study Date:</dt>
                            <dd class="col-sm-7">${formatDate(transfer.study_date)}</dd>
                            
                            <dt class="col-sm-5">Study Time:</dt>
                            <dd class="col-sm-7">${escapeHtml(transfer.study_time || '-')}</dd>
                        </dl>
                    </div>
                    <div class="col-md-6">
                        <dl class="row mb-0">
                            <dt class="col-sm-5">Modality:</dt>
                            <dd class="col-sm-7">
                                <span class="badge bg-secondary">${escapeHtml(transfer.modality || '-')}</span>
                            </dd>
                            
                            <dt class="col-sm-5">Accession #:</dt>
                            <dd class="col-sm-7">${escapeHtml(transfer.accession_number || '-')}</dd>
                            
                            <dt class="col-sm-5">Study UID:</dt>
                            <dd class="col-sm-7"><small class="text-monospace">${escapeHtml(transfer.study_instance_uid || '-')}</small></dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- DICOM UIDs -->
        <div class="card mb-3">
            <div class="card-header bg-light">
                <h6 class="mb-0"><i class="bi bi-fingerprint"></i> DICOM Identifiers</h6>
            </div>
            <div class="card-body">
                <dl class="row mb-0">
                    <dt class="col-sm-3">Study Instance UID:</dt>
                    <dd class="col-sm-9"><small class="text-monospace">${escapeHtml(transfer.study_instance_uid || '-')}</small></dd>
                    
                    <dt class="col-sm-3">Series Instance UID:</dt>
                    <dd class="col-sm-9"><small class="text-monospace">${escapeHtml(transfer.series_instance_uid || '-')}</small></dd>
                    
                    <dt class="col-sm-3">SOP Instance UID:</dt>
                    <dd class="col-sm-9"><small class="text-monospace">${escapeHtml(transfer.sop_instance_uid || '-')}</small></dd>
                </dl>
            </div>
        </div>
        
        <!-- File Information -->
        <div class="card mb-3">
            <div class="card-header bg-light">
                <h6 class="mb-0"><i class="bi bi-file-earmark"></i> File Information</h6>
            </div>
            <div class="card-body">
                <dl class="row mb-0">
                    <dt class="col-sm-3">File Path:</dt>
                    <dd class="col-sm-9"><code>${escapeHtml(transfer.file_path)}</code></dd>
                    
                    <dt class="col-sm-3">File Size:</dt>
                    <dd class="col-sm-9">${formatBytes(transfer.file_size)} (${transfer.file_size?.toLocaleString()} bytes)</dd>
                </dl>
            </div>
        </div>
    `;
    
    // Error Message
    if (transfer.error_message) {
        html += `
            <div class="card mb-3 border-danger">
                <div class="card-header bg-danger text-white">
                    <h6 class="mb-0"><i class="bi bi-exclamation-triangle"></i> Error Details</h6>
                </div>
                <div class="card-body">
                    <pre class="mb-0 text-danger">${escapeHtml(transfer.error_message)}</pre>
                </div>
            </div>
        `;
    }
    
    // API Logs
    if (apiLogs && apiLogs.length > 0) {
        html += `
            <div class="card">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><i class="bi bi-journal-text"></i> API Request History (${apiLogs.length} attempts)</h6>
                </div>
                <div class="card-body">
        `;
        
        apiLogs.forEach((log, index) => {
            const logStatusClass = log.status_code >= 200 && log.status_code < 300 ? 'success' : 
                                    log.status_code >= 400 ? 'danger' : 'secondary';
            
            html += `
                <div class="border-start border-3 border-${logStatusClass} ps-3 mb-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>${log.method || 'POST'} ${escapeHtml(log.endpoint)}</strong>
                            ${log.status_code ? `<span class="badge bg-${logStatusClass} ms-2">${log.status_code}</span>` : ''}
                        </div>
                        <small class="text-muted">${formatDateTime(log.timestamp)}</small>
                    </div>
                    
                    ${log.response_time ? `
                        <div class="mt-1">
                            <small><i class="bi bi-clock"></i> Response Time: <strong>${log.response_time}ms</strong></small>
                        </div>
                    ` : ''}
                    
                    ${log.request_size ? `
                        <div class="mt-1">
                            <small><i class="bi bi-file-earmark"></i> Request Size: ${formatBytes(log.request_size)}</small>
                        </div>
                    ` : ''}
                    
                    ${log.error ? `
                        <div class="alert alert-danger mt-2 mb-0 py-2">
                            <small><i class="bi bi-x-circle"></i> <strong>Error:</strong> ${escapeHtml(log.error)}</small>
                        </div>
                    ` : ''}
                    
                    ${log.response_body && !log.error ? `
                        <details class="mt-2">
                            <summary class="text-muted" style="cursor: pointer;">
                                <small>View Response</small>
                            </summary>
                            <pre class="mt-2 mb-0 p-2 bg-light rounded"><small>${escapeHtml(log.response_body)}</small></pre>
                        </details>
                    ` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> No API request history available for this transfer.
            </div>
        `;
    }
    
    return html;
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    const fileInfoDiv = document.getElementById('fileInfo');
    const fileNameDiv = document.getElementById('fileName');
    const fileSizeDiv = document.getElementById('fileSize');
    
    if (file) {
        fileInfoDiv.classList.remove('d-none');
        fileNameDiv.textContent = file.name;
        fileSizeDiv.textContent = `Size: ${formatBytes(file.size)}`;
        
        // Clear previous results
        document.getElementById('uploadResult').innerHTML = '';
        document.getElementById('uploadProgress').classList.add('d-none');
    } else {
        fileInfoDiv.classList.add('d-none');
    }
}

// Clear upload form
function clearUploadForm() {
    document.getElementById('uploadForm').reset();
    document.getElementById('fileInfo').classList.add('d-none');
    document.getElementById('uploadProgress').classList.add('d-none');
    document.getElementById('uploadResult').innerHTML = '';
}

// Handle file upload
async function handleUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('dicomFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Error', 'Please select a file', 'danger');
        return;
    }
    
    // Validate file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.dcm') && !fileName.endsWith('.dicom')) {
        showToast('Error', 'Please select a valid DICOM file (.dcm or .dicom)', 'danger');
        return;
    }
    
    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
        showToast('Error', 'File size exceeds 100 MB limit', 'danger');
        return;
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append('file', file);
    
    // Show progress
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const statusDiv = document.getElementById('uploadStatus');
    const resultDiv = document.getElementById('uploadResult');
    const uploadBtn = document.getElementById('btnUpload');
    
    progressDiv.classList.remove('d-none');
    resultDiv.innerHTML = '';
    uploadBtn.disabled = true;
    
    try {
        // Create XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = percentComplete + '%';
                progressBar.textContent = Math.round(percentComplete) + '%';
                statusDiv.textContent = `Uploading... ${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
            }
        });
        
        // Handle completion
        xhr.addEventListener('load', () => {
            uploadBtn.disabled = false;
            
            if (xhr.status === 200 || xhr.status === 201) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    
                    if (response.success) {
                        progressBar.classList.remove('progress-bar-animated');
                        progressBar.classList.add('bg-success');
                        statusDiv.textContent = 'Upload completed successfully!';
                        
                        resultDiv.innerHTML = `
                            <div class="alert alert-success">
                                <h6><i class="bi bi-check-circle"></i> File Uploaded Successfully!</h6>
                                <hr>
                                <div class="row">
                                    <div class="col-md-6">
                                        <small><strong>File ID:</strong> ${escapeHtml(response.data.id)}</small><br>
                                        <small><strong>Patient ID:</strong> ${escapeHtml(response.data.patientId || 'N/A')}</small><br>
                                        <small><strong>Modality:</strong> ${escapeHtml(response.data.modality || 'N/A')}</small>
                                    </div>
                                    <div class="col-md-6">
                                        <small><strong>File Size:</strong> ${formatBytes(response.data.filesize)}</small><br>
                                        <small><strong>Study Date:</strong> ${formatDate(response.data.studyDate)}</small><br>
                                        <small><strong>Received:</strong> ${formatDateTime(response.data.receivedAt)}</small>
                                    </div>
                                </div>
                            </div>
                        `;
                        
                        showToast('Success', 'DICOM file uploaded successfully', 'success');
                        
                        // Refresh transfer logs after a short delay
                        setTimeout(() => {
                            refreshTransfers();
                            refreshEvents();
                            updateStats();
                        }, 1000);
                        
                        // Clear form
                        setTimeout(() => {
                            clearUploadForm();
                        }, 3000);
                    } else {
                        throw new Error(response.message || 'Upload failed');
                    }
                } catch (parseError) {
                    throw new Error('Invalid server response');
                }
            } else {
                let errorMessage = `Server error: ${xhr.status}`;
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    errorMessage = errorResponse.message || errorResponse.error || errorMessage;
                } catch (e) {
                    // Use default error message
                }
                throw new Error(errorMessage);
            }
        });
        
        // Handle errors
        xhr.addEventListener('error', () => {
            uploadBtn.disabled = false;
            progressBar.classList.remove('progress-bar-animated');
            progressBar.classList.add('bg-danger');
            statusDiv.textContent = 'Upload failed';
            
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-x-circle"></i> <strong>Upload Failed:</strong> Network error
                </div>
            `;
            
            showToast('Error', 'Upload failed due to network error', 'danger');
        });
        
        // Handle abort
        xhr.addEventListener('abort', () => {
            uploadBtn.disabled = false;
            progressBar.classList.remove('progress-bar-animated');
            progressBar.classList.add('bg-warning');
            statusDiv.textContent = 'Upload cancelled';
            showToast('Warning', 'Upload was cancelled', 'warning');
        });
        
        // Send request
        xhr.open('POST', `${API_BASE}/api/upload`);
        xhr.send(formData);
        
    } catch (error) {
        console.error('Upload error:', error);
        uploadBtn.disabled = false;
        progressBar.classList.remove('progress-bar-animated');
        progressBar.classList.add('bg-danger');
        statusDiv.textContent = 'Upload failed';
        
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-x-circle"></i> <strong>Upload Failed:</strong> ${escapeHtml(error.message)}
            </div>
        `;
        
        showToast('Error', error.message, 'danger');
    }
}
