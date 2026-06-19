const { readStore, writeStore } = require('./init');

const TransferModel = {
  create(data) {
    const store = readStore();
    const id = store.lastTransferId + 1;
    const now = new Date().toISOString();

    const record = {
      id,
      patient_id: data.patientId || '',
      patient_name: data.patientName || '',
      study_date: data.studyDate || '',
      modality: data.modality || 'OT',
      study_instance_uid: data.studyInstanceUid || '',
      sop_instance_uid: data.sopInstanceUid || '',
      file_path: data.filePath,
      file_size: data.fileSize || 0,
      status: data.status || 'pending',
      retries: 0,
      error_message: null,
      created_at: now,
      updated_at: now
    };

    store.lastTransferId = id;
    store.transfers.push(record);
    writeStore(store);
    return id;
  },

  getByStudyInstanceUid(uid) {
    if (!uid) return null;
    const store = readStore();
    return store.transfers.find((item) => item.study_instance_uid === uid) || null;
  },

  getBySopInstanceUid(uid) {
    if (!uid) return null;
    const store = readStore();
    return store.transfers.find((item) => item.sop_instance_uid === uid) || null;
  },

  getPending(limit) {
    const store = readStore();
    return store.transfers
      .filter((item) => item.status === 'pending')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(0, limit || 10);
  },

  updateStatus(id, status, errorMessage) {
    const store = readStore();
    const item = store.transfers.find((transfer) => transfer.id === id);
    if (!item) return;

    item.status = status;
    item.error_message = errorMessage || null;
    item.updated_at = new Date().toISOString();
    writeStore(store);
  },

  incrementRetries(id) {
    const store = readStore();
    const item = store.transfers.find((transfer) => transfer.id === id);
    if (!item) return;

    item.retries = (item.retries || 0) + 1;
    item.updated_at = new Date().toISOString();
    writeStore(store);
  },

  getStats() {
    const store = readStore();
    const stats = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0
    };

    for (const item of store.transfers) {
      stats.total += 1;
      if (item.status === 'sent') stats.sent += 1;
      if (item.status === 'failed') stats.failed += 1;
      if (item.status === 'pending') stats.pending += 1;
    }

    return stats;
  }
};

const ApiLogModel = {
  create(data) {
    const store = readStore();
    const id = store.apiLogs.length + 1;
    store.apiLogs.push({
      id,
      transfer_id: data.transferId || null,
      status_code: data.statusCode || null,
      response_time: data.responseTime || null,
      error: data.error || null,
      timestamp: new Date().toISOString()
    });
    writeStore(store);
  }
};

module.exports = {
  TransferModel,
  ApiLogModel
};
