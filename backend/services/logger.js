const fs = require('fs-extra');
const path = require('path');
const config = require('../config/default');

// Ensure log directory exists
const logDir = path.dirname(config.logging.file);
fs.ensureDirSync(logDir);

// Simple logger implementation (Node.js v12 compatible)
class SimpleLogger {
  constructor(logFile, level = 'info') {
    this.logFile = logFile;
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  _formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (meta) {
      if (meta instanceof Error) {
        logMessage += `\n${meta.stack}`;
      } else if (typeof meta === 'object') {
        logMessage += ` ${JSON.stringify(meta)}`;
      }
    }
    
    return logMessage;
  }

  _write(level, message, meta) {
    if (!this._shouldLog(level)) return;

    const logMessage = this._formatMessage(level, message, meta);
    
    // Console output
    console.log(logMessage);
    
    // File output
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write to log file:', err.message);
    }
  }

  info(message, meta) {
    this._write('info', message, meta);
  }

  warn(message, meta) {
    this._write('warn', message, meta);
  }

  error(message, meta) {
    this._write('error', message, meta);
  }

  debug(message, meta) {
    this._write('debug', message, meta);
  }

  dicom(event, data) {
    this._write('info', `DICOM: ${event}`, data);
  }

  api(event, data) {
    this._write('info', `API: ${event}`, data);
  }

  getLogger() {
    return this;
  }
}

// Create and export logger instance
const logger = new SimpleLogger(config.logging.file, config.logging.level);

module.exports = logger;
