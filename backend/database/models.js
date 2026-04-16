const db = require('./init');

// Transfer Model
const TransferModel = {
  // Create new transfer record
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO transfers (
        patient_id, patient_name, study_date, study_time, modality,
        accession_number, study_instance_uid, series_instance_uid,
        sop_instance_uid, file_path, file_size, fuji_aet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.patientId || '',
      data.patientName || '',
      data.studyDate || '',
      data.studyTime || '',
      data.modality || '',
      data.accessionNumber || '',
      data.studyInstanceUid || '',
      data.seriesInstanceUid || '',
      data.sopInstanceUid || '',
      data.filePath,
      data.fileSize || 0,
      data.fujiAet || ''
    );
    
    return result.lastInsertRowid;
  },

  // Update transfer status
  updateStatus(id, status, errorMessage = null) {
    const stmt = db.prepare(`
      UPDATE transfers 
      SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP,
          sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
      WHERE id = ?
    `);
    stmt.run(status, errorMessage, status, id);
  },

  // Increment retry count
  incrementRetries(id) {
    const stmt = db.prepare(`
      UPDATE transfers 
      SET retries = retries + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
  },

  // Get transfer by ID
  getById(id) {
    const stmt = db.prepare('SELECT * FROM transfers WHERE id = ?');
    return stmt.get(id);
  },

  // Get transfer by Study Instance UID
  getByStudyInstanceUid(uid) {
    const stmt = db.prepare('SELECT * FROM transfers WHERE study_instance_uid = ? LIMIT 1');
    return stmt.get(uid);
  },

  // Get pending transfers
  getPending(limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM transfers 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  // Get recent transfers
  getRecent(limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM transfers 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  // Get statistics
  getStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(file_size) as total_size
      FROM transfers
      WHERE created_at >= datetime('now', '-24 hours')
    `);
    return stmt.get();
  }
};

// Event Model
const EventModel = {
  // Log event
  log(type, message, level = 'info', details = null) {
    const stmt = db.prepare(`
      INSERT INTO events (type, level, message, details)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(type, level, message, details ? JSON.stringify(details) : null);
  },

  // Get recent events
  getRecent(limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM events 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  // Clear old events
  clearOld(days = 30) {
    const stmt = db.prepare(`
      DELETE FROM events 
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(days);
    return result.changes;
  }
};

// API Log Model
const ApiLogModel = {
  // Create API log
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO api_logs (
        transfer_id, endpoint, method, status_code,
        response_time, request_size, response_body, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.transferId || null,
      data.endpoint,
      data.method || 'POST',
      data.statusCode || null,
      data.responseTime || null,
      data.requestSize || null,
      data.responseBody || null,
      data.error || null
    );
  },

  // Get recent API logs
  getRecent(limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM api_logs 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  // Get API logs by transfer ID
  getByTransferId(transferId) {
    const stmt = db.prepare(`
      SELECT * FROM api_logs 
      WHERE transfer_id = ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(transferId);
  }
};

// Connection Status Model
const ConnectionModel = {
  // Update connection status
  update(serviceType, status, details = null) {
    const stmt = db.prepare(`
      UPDATE connection_status 
      SET status = ?, details = ?, last_check = CURRENT_TIMESTAMP
      WHERE service_type = ?
    `);
    stmt.run(status, details, serviceType);
  },

  // Get status
  get(serviceType) {
    const stmt = db.prepare(`
      SELECT * FROM connection_status WHERE service_type = ?
    `);
    return stmt.get(serviceType);
  },

  // Get all statuses
  getAll() {
    const stmt = db.prepare('SELECT * FROM connection_status');
    return stmt.all();
  }
};

module.exports = {
  TransferModel,
  EventModel,
  ApiLogModel,
  ConnectionModel
};
