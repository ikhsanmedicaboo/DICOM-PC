const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');
const EventEmitter = require('events');
const config = require('../config/default');
const logger = require('./logger');
const { TransferModel, ApiLogModel } = require('../database/models');

class ApiForwarder extends EventEmitter {
  constructor() {
    super();
    this.running = false;
    this.interval = null;
    this.activeTransfers = 0;
    this.maxConcurrent = config.performance.concurrentUploads;
  }

  start() {
    if (this.running) return;

    this.running = true;
    this.processQueue();
    this.interval = setInterval(() => this.processQueue(), config.performance.queuePollInterval);
    logger.info('API forwarder started');
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info('API forwarder stopped');
  }

  async getAuthToken() {
    if (!config.api.hospitalId || !config.api.key) {
      throw new Error('Set HOSPITAL_ID and API_KEY in .env');
    }

    const authUrl = `${config.api.url}${config.api.endpoints.authenticate}`;
    const response = await axios.post(authUrl, {}, {
      headers: {
        hospital_id: config.api.hospitalId,
        api_key: config.api.key
      },
      timeout: 0
    });

    const token = response && response.data && response.data.data && response.data.data.token;
    if (!token) {
      throw new Error('Authentication failed, token missing');
    }

    return token;
  }

  async processQueue() {
    if (!this.running) return;

    const pending = TransferModel.getPending(10);
    if (!pending.length) return;

    for (const transfer of pending) {
      if (this.activeTransfers >= this.maxConcurrent) break;

      if (transfer.retries >= config.retry.maxRetries) {
        TransferModel.updateStatus(transfer.id, 'failed', 'Max retries reached');
        if (await fs.pathExists(transfer.file_path)) {
          await fs.remove(transfer.file_path);
        }
        continue;
      }

      this.activeTransfers += 1;

      this.forwardFile(transfer)
        .catch((error) => logger.error(`Unhandled transfer failure ${transfer.id}`, error))
        .finally(() => {
          this.activeTransfers -= 1;
        });
    }
  }

  async forwardFile(transfer) {
    const startedAt = Date.now();

    try {
      if (!await fs.pathExists(transfer.file_path)) {
        logger.warn(`Transfer ${transfer.id} failed because file was missing: ${transfer.file_path}`);
        TransferModel.updateStatus(transfer.id, 'failed', 'DICOM file not found');
        return;
      }

      const token = await this.getAuthToken();
      const buffer = await fs.readFile(transfer.file_path);

      const form = new FormData();
      form.append('hospitalId', config.api.hospitalId);
      form.append('token', token);
      form.append('file', buffer, {
        filename: `${transfer.patient_id || 'unknown'}_${transfer.id}.dcm`,
        contentType: 'application/dicom'
      });
      form.append('patient_id', transfer.patient_id || '');
      form.append('patient_name', transfer.patient_name || '');
      form.append('study_date', transfer.study_date || '');
      form.append('modality', transfer.modality || '');
      form.append('study_instance_uid', transfer.study_instance_uid || '');

      const url = `${config.api.url}${config.api.endpoints.receive}`;
      const response = await axios.post(url, form, {
        headers: form.getHeaders(),
        timeout: 0,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      TransferModel.updateStatus(transfer.id, 'sent', null);
      ApiLogModel.create({
        transferId: transfer.id,
        statusCode: response.status,
        responseTime: Date.now() - startedAt
      });

      if (await fs.pathExists(transfer.file_path)) {
        await fs.remove(transfer.file_path);
      }

      logger.info(`Transfer ${transfer.id} sent`);
      this.emit('transferred', { transferId: transfer.id, statusCode: response.status });
    } catch (error) {
      const isRetryable = this.isRetryableError(error);

      if (isRetryable) {
        TransferModel.incrementRetries(transfer.id);
        TransferModel.updateStatus(transfer.id, 'pending', error.message);
      } else {
        TransferModel.updateStatus(transfer.id, 'failed', error.message);
        if (await fs.pathExists(transfer.file_path)) {
          await fs.remove(transfer.file_path);
        }
      }

      ApiLogModel.create({
        transferId: transfer.id,
        statusCode: error.response ? error.response.status : null,
        responseTime: Date.now() - startedAt,
        error: error.message
      });

      logger.error(`Transfer ${transfer.id} failed: ${error.message}`);
      this.emit('error', { transferId: transfer.id, message: error.message });
    }
  }

  isRetryableError(error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    if (error.response && (error.response.status >= 500 || error.response.status === 429)) {
      return true;
    }

    return false;
  }

  getStatus() {
    return {
      running: this.running,
      activeTransfers: this.activeTransfers,
      maxConcurrent: this.maxConcurrent,
      stats: TransferModel.getStats()
    };
  }
}

module.exports = new ApiForwarder();
