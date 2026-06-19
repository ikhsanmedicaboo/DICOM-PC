const fs = require('fs-extra');
const path = require('path');
const config = require('../config/default');

fs.ensureDirSync(path.dirname(config.logging.file));

// How many daily rotated log files to keep
const MAX_ROTATED_LOGS = 7;

class Logger {
  constructor(filePath, level) {
    this.filePath = filePath;
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    this.currentDate = new Date().toISOString().slice(0, 10);
  }

  canLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  /** Rotate log file when the calendar date rolls over. */
  _checkRotation() {
    const today = new Date().toISOString().slice(0, 10);
    if (today === this.currentDate) return;

    try {
      if (fs.existsSync(this.filePath)) {
        const ext = path.extname(this.filePath);
        const base = this.filePath.slice(0, -ext.length || undefined);
        const rotatedPath = `${base}-${this.currentDate}${ext}`;
        fs.renameSync(this.filePath, rotatedPath);
      }
      this._cleanOldLogs();
    } catch (_) {
      // rotation failure must not crash the process
    }

    this.currentDate = today;
  }

  /** Remove rotated files beyond MAX_ROTATED_LOGS. */
  _cleanOldLogs() {
    try {
      const dir = path.dirname(this.filePath);
      const ext = path.extname(this.filePath);
      const baseName = path.basename(this.filePath, ext);

      const old = fs.readdirSync(dir)
        .filter(f => f.startsWith(`${baseName}-`) && f.endsWith(ext))
        .sort()
        .reverse()
        .slice(MAX_ROTATED_LOGS);

      old.forEach(f => {
        try { fs.removeSync(path.join(dir, f)); } catch (_) {}
      });
    } catch (_) {}
  }

  write(level, message, meta) {
    if (!this.canLog(level)) return;

    this._checkRotation();

    const timestamp = new Date().toISOString();
    let line = `${timestamp} [${level.toUpperCase()}] ${message}`;

    if (meta) {
      if (meta instanceof Error) {
        line += `\n${meta.stack}`;
      } else if (typeof meta === 'object') {
        line += ` ${JSON.stringify(meta)}`;
      }
    }

    console.log(line);
    try {
      fs.appendFileSync(this.filePath, `${line}\n`, 'utf8');
    } catch (_) {}
  }

  info(message, meta) { this.write('info', message, meta); }
  warn(message, meta) { this.write('warn', message, meta); }
  error(message, meta) { this.write('error', message, meta); }
  debug(message, meta) { this.write('debug', message, meta); }
}

module.exports = new Logger(config.logging.file, config.logging.level);
