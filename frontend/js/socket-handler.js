// Socket.IO connection handler
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function initSocket() {
    // Connect to server
    socket = io({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts
    });

    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server');
        reconnectAttempts = 0;
        updateConnectionStatus(true);
        
        // Request initial status
        socket.emit('requestStatus');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reconnectAttempts++;
        
        if (reconnectAttempts >= maxReconnectAttempts) {
            updateConnectionStatus(false, 'Connection failed');
        }
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
        showToast('Reconnected', 'Connection restored', 'success');
    });

    // Custom events
    socket.on('connected', (data) => {
        console.log('Server message:', data.message);
    });

    socket.on('statusUpdate', (data) => {
        handleStatusUpdate(data);
    });

    socket.on('fileReceived', (data) => {
        console.log('File received:', data);
        showToast('File Received', `Patient: ${data.metadata.patientId}`, 'info');
        refreshTransfers();
        updateStats();
    });

    socket.on('fileTransferred', (data) => {
        console.log('File transferred:', data);
        showToast('File Sent', `Transfer ID: ${data.transferId}`, 'success');
        refreshTransfers();
        updateStats();
    });

    socket.on('transferError', (data) => {
        console.log('Transfer error:', data);
        showToast('Transfer Error', data.error, 'danger');
        refreshTransfers();
    });

    // DICOM listener events
    socket.on('dicomStarted', (data) => {
        console.log('DICOM listener started:', data);
        showToast('DICOM Listener', `Started on port ${data.port}`, 'success');
        updateDicomStatus();
    });

    socket.on('dicomStopped', (data) => {
        console.log('DICOM listener stopped:', data);
        showToast('DICOM Listener', 'Stopped', 'info');
        updateDicomStatus();
    });

    socket.on('dicomFileReceived', (data) => {
        console.log('DICOM file received:', data);
        showToast('DICOM File Received', `Patient: ${data.patientId}, Transfer: ${data.transferId}`, 'info');
        refreshTransfers();
        updateStats();
    });

    socket.on('dicomError', (data) => {
        console.log('DICOM listener error:', data);
        showToast('DICOM Error', data.error, 'danger');
        updateDicomStatus();
    });
}

function updateConnectionStatus(connected, message = '') {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    if (connected) {
        statusEl.innerHTML = '<i class="bi bi-circle-fill text-success"></i> Connected';
        statusEl.className = 'badge bg-success';
    } else {
        const msg = message || 'Disconnected';
        statusEl.innerHTML = `<i class="bi bi-circle-fill text-danger"></i> ${msg}`;
        statusEl.className = 'badge bg-danger pulse';
    }
}

function handleStatusUpdate(data) {
    if (!data) return;

    // Update API status
    if (data.forwarder) {
        const authText = document.getElementById('apiAuth');
        const hospitalInfoText = document.getElementById('hospitalInfo');
        
        if (authText) {
            const authStatus = data.forwarder.hasAuth ? 'Configured' : 'Not Set';
            authText.textContent = `Auth: ${authStatus}`;
        }

        if (hospitalInfoText) {
            const hospitalDisplay = data.forwarder.hospitalName || data.forwarder.hospitalId || '--';
            hospitalInfoText.textContent = `Hospital: ${hospitalDisplay}`;
        }
    }

    // Update DICOM listener status
    if (data.dicom) {
        updateDicomStatus(data.dicom);
    }
}

function updateDicomStatus(dicomData) {
    const statusEl = document.getElementById('dicomStatus');
    const infoEl = document.getElementById('dicomInfo');
    const btnToggle = document.getElementById('btnToggleDicom');
    
    if (!statusEl || !infoEl) return;

    if (dicomData && dicomData.running) {
        statusEl.innerHTML = '<i class="bi bi-circle-fill text-success"></i>';
        infoEl.textContent = `Port: ${dicomData.port} (${dicomData.method})`;
        btnToggle.innerHTML = '<i class="bi bi-power"></i> Stop';
        btnToggle.className = 'btn btn-sm btn-outline-danger';
    } else {
        statusEl.innerHTML = '<i class="bi bi-circle-fill text-secondary"></i>';
        infoEl.textContent = 'Port: -- (offline)';
        btnToggle.innerHTML = '<i class="bi bi-power"></i> Start';
        btnToggle.className = 'btn btn-sm btn-outline-primary';
    }
}

// Initialize socket on load
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
});
