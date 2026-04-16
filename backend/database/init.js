const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config/default');
const logger = require('../services/logger');

// Ensure database directory exists
const dbDir = path.dirname(config.storage.dbPath);
fs.ensureDirSync(dbDir);

// Initialize database
const db = new Database(config.storage.dbPath);

// Enable WAL mode for better concurrency (Windows 7 compatible)
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

function hasUniqueStudyUidConstraint() {
  const indexList = db.prepare("PRAGMA index_list('transfers')").all();
  for (const index of indexList) {
    if (!index.unique) {
      continue;
    }

    const columns = db.prepare(`PRAGMA index_info('${index.name}')`).all();
    const hasStudyUid = columns.some((column) => column.name === 'study_instance_uid');
    if (hasStudyUid) {
      return true;
    }
  }
  return false;
}

function migrateTransfersAllowDuplicateStudyUid() {
  if (!hasUniqueStudyUidConstraint()) {
    return;
  }

  logger.warn('Migrating transfers table: removing UNIQUE constraint on study_instance_uid');

  try {
    // Disable foreign keys during migration to avoid constraint violations
    db.prepare('PRAGMA foreign_keys = OFF').run();
    
    db.prepare('BEGIN TRANSACTION').run();
    
    db.prepare('ALTER TABLE transfers RENAME TO transfers_legacy_unique_study_uid').run();

    db.prepare(`
      CREATE TABLE transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        patient_name TEXT,
        study_date TEXT,
        study_time TEXT,
        modality TEXT,
        accession_number TEXT,
        study_instance_uid TEXT,
        series_instance_uid TEXT,
        sop_instance_uid TEXT,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        status TEXT DEFAULT 'pending',
        retries INTEGER DEFAULT 0,
        error_message TEXT,
        fuji_aet TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      INSERT INTO transfers (
        id, patient_id, patient_name, study_date, study_time, modality,
        accession_number, study_instance_uid, series_instance_uid,
        sop_instance_uid, file_path, file_size, status, retries,
        error_message, fuji_aet, created_at, sent_at, updated_at
      )
      SELECT
        id, patient_id, patient_name, study_date, study_time, modality,
        accession_number, study_instance_uid, series_instance_uid,
        sop_instance_uid, file_path, file_size, status, retries,
        error_message, fuji_aet, created_at, sent_at, updated_at
      FROM transfers_legacy_unique_study_uid
    `).run();

    db.prepare('DROP TABLE transfers_legacy_unique_study_uid').run();
    db.prepare('COMMIT').run();
    logger.info('Migration completed: duplicate Study Instance UID now allowed');
  } catch (error) {
    db.prepare('ROLLBACK').run();
    throw error;
  } finally {
    // Re-enable foreign keys after migration
    db.prepare('PRAGMA foreign_keys = ON').run();
  }
}

// Create tables
function initializeTables() {
  try {
    // Transfers table - stores DICOM file transfer records
    db.exec(`
      CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        patient_name TEXT,
        study_date TEXT,
        study_time TEXT,
        modality TEXT,
        accession_number TEXT,
        study_instance_uid TEXT,
        series_instance_uid TEXT,
        sop_instance_uid TEXT,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        status TEXT DEFAULT 'pending',
        retries INTEGER DEFAULT 0,
        error_message TEXT,
        fuji_aet TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    migrateTransfersAllowDuplicateStudyUid();

    // Events table - stores system events
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        message TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // API logs table - stores API call history
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id INTEGER,
        endpoint TEXT NOT NULL,
        method TEXT DEFAULT 'POST',
        status_code INTEGER,
        response_time INTEGER,
        request_size INTEGER,
        response_body TEXT,
        error TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transfer_id) REFERENCES transfers(id)
      )
    `);

    // Connection status table - tracks DICOM/API connection status
    db.exec(`
      CREATE TABLE IF NOT EXISTS connection_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_type TEXT NOT NULL,
        status TEXT NOT NULL,
        last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT
      )
    `);

    // Create indexes for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
      CREATE INDEX IF NOT EXISTS idx_transfers_created ON transfers(created_at);
      CREATE INDEX IF NOT EXISTS idx_transfers_study_uid ON transfers(study_instance_uid);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs(timestamp);
    `);

    // Initialize connection status records
    const insertStatus = db.prepare(`
      INSERT OR IGNORE INTO connection_status (id, service_type, status, details)
      VALUES (?, ?, ?, ?)
    `);
    
    insertStatus.run(1, 'dicom', 'stopped', 'DICOM listener not started');
    insertStatus.run(2, 'api', 'unknown', 'API not tested');

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

// Initialize tables on first load
initializeTables();

module.exports = db;
