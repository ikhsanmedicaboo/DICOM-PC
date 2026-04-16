const fs = require('fs-extra');
const path = require('path');
const config = require('../config/default');

fs.ensureDirSync(path.dirname(config.logging.file));

class Logger {
  constructor(filePath, level) {
    this.filePath = filePath;
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  canLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  write(level, message, meta) {
    if (!this.canLog(level)) return;

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
    fs.appendFileSync(this.filePath, `${line}\n`, 'utf8');
  }

  info(message, meta) { this.write('info', message, meta); }
  warn(message, meta) { this.write('warn', message, meta); }
  error(message, meta) { this.write('error', message, meta); }
  debug(message, meta) { this.write('debug', message, meta); }
}

module.exports = new Logger(config.logging.file, config.logging.level);
