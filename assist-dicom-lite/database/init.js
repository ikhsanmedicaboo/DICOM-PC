const fs = require('fs-extra');
const path = require('path');
const config = require('../config/default');

const dbPath = config.storage.dbPath;

function readStore() {
  fs.ensureDirSync(path.dirname(dbPath));
  if (!fs.pathExistsSync(dbPath)) {
    const initial = {
      lastTransferId: 0,
      transfers: [],
      apiLogs: []
    };
    fs.writeJsonSync(dbPath, initial, { spaces: 2 });
    return initial;
  }

  try {
    const data = fs.readJsonSync(dbPath);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }
    data.lastTransferId = data.lastTransferId || 0;
    data.transfers = Array.isArray(data.transfers) ? data.transfers : [];
    data.apiLogs = Array.isArray(data.apiLogs) ? data.apiLogs : [];
    return data;
  } catch (error) {
    const backupPath = `${dbPath}.corrupt.${Date.now()}`;
    try {
      fs.copyFileSync(dbPath, backupPath);
    } catch (copyError) {
      // Ignore backup failure and continue with fresh store.
    }
    const fresh = {
      lastTransferId: 0,
      transfers: [],
      apiLogs: []
    };
    fs.writeJsonSync(dbPath, fresh, { spaces: 2 });
    return fresh;
  }
}

function writeStore(data) {
  fs.ensureDirSync(path.dirname(dbPath));
  fs.writeJsonSync(dbPath, data, { spaces: 2 });
}

module.exports = {
  readStore,
  writeStore
};
