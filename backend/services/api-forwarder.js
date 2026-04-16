const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');
const EventEmitter = require('events');
const config = require('../config/default');
const logger = require('./logger');
const { TransferModel, ApiLogModel, EventModel, ConnectionModel } = require('../database/models');

function maskValue(value, visibleChars = 4) {
  if (!value || typeof value !== 'string') {
    return value || '';
  }

  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }

  return `${'*'.repeat(value.length - visibleChars)}${value.slice(-visibleChars)}`;
}

class ApiForwarder extends EventEmitter {
  constructor() {
    super();
    this.processing = false;
    this.queue = [];
    this.activeTransfers = 0;
    this.maxConcurrent = config.performance.concurrentUploads;
    this.processingTransfers = new Set(); // Track which transfers are currently being processed
  }

  /**
   * Start processing queue
   */
  start() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    logger.info('='.repeat(50));
    logger.info('\u2705 API Forwarder Started - Assist.id Technology');
    logger.info('='.repeat(50));
    EventModel.log('api', 'API forwarder started', 'info');
    
    // Process pending transfers immediately
    this.processQueue();
    
    // Set up periodic processing
    this.interval = setInterval(() => {
      this.processQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop processing queue
   */
  stop() {
    if (!this.processing) {
      return;
    }

    this.processing = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    logger.info('API forwarder stopped');
    EventModel.log('api', 'API forwarder stopped', 'info');
  }

  /**
   * Process pending transfers
   */
  async processQueue() {
    if (!this.processing) {
      return;
    }

    try {
      // Get pending transfers from database
      const pending = TransferModel.getPending(10);
      
      if (pending.length === 0) {
        return;
      }

      logger.info(`Found ${pending.length} pending transfers`);

      // Process transfers (respect concurrent limit)
      for (const transfer of pending) {
        // Skip if already processing this transfer
        if (this.processingTransfers.has(transfer.id)) {
          continue;
        }

        if (this.activeTransfers >= this.maxConcurrent) {
          break;
        }

        // Skip if max retries exceeded
        if (transfer.retries >= config.retry.maxRetries) {
          logger.warn(`Max retries exceeded for transfer ${transfer.id}, deleting file`);
          TransferModel.updateStatus(transfer.id, 'failed', 'Max retries exceeded');
          // Delete the file
          if (await fs.pathExists(transfer.file_path)) {
            await fs.remove(transfer.file_path);
            logger.info(`Deleted file: ${transfer.file_path}`);
          }
          continue;
        }

        // Mark as being processed
        this.processingTransfers.add(transfer.id);
        this.activeTransfers++;
        
        this.forwardFile(transfer)
          .catch((err) => {
            // This should not happen as forwardFile catches its own errors
            logger.error(`Unhandled error in forwardFile for transfer ${transfer.id}:`, err);
          })
          .finally(() => {
            this.activeTransfers--;
            this.processingTransfers.delete(transfer.id); // Remove from processing set
          });
      }
    } catch (error) {
      logger.error('Error processing queue:', error);
    }
  }

  /**
   * Authenticate and get one-time token
   */
  async getAuthToken() {
    try {
      // Use runtime credentials if available, otherwise fall back to config
      const hospitalId = config.api.runtimeHospitalId || config.api.hospitalId;
      const apiKey = config.api.runtimeKey || config.api.key;

      if (!hospitalId || !apiKey) {
        throw new Error('Hospital ID and API Key not configured. Please login first.');
      }

      // Build authentication URL
      const authUrl = `${config.api.url}${config.api.endpoints.authenticate}`;

      logger.info(`Requesting authentication token for Hospital: ${hospitalId}...`);

      const response = await axios.post(authUrl, {}, {
        headers: {
          'hospital_id': hospitalId,
          'api_key': apiKey
        },
        timeout: 0
      });

      if (response.data && response.data.success && response.data.data && response.data.data.token) {
        logger.info('Authentication token obtained successfully');
        return response.data.data.token;
      } else {
        throw new Error('Invalid authentication response');
      }
    } catch (error) {
      logger.error('Failed to get authentication token:', error.message);
      if (error.response) {
        logger.error('Authentication error response:', error.response.data);
      }
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Forward DICOM file to API
   */
  async forwardFile(transfer) {
    const startTime = Date.now();
    
    try {
      logger.info(`Forwarding transfer ${transfer.id}: ${transfer.file_path}`);

      // Check if file exists
      if (!await fs.pathExists(transfer.file_path)) {
        throw new Error('DICOM file not found');
      }

      // Read file
      const fileBuffer = await fs.readFile(transfer.file_path);
      const fileSize = fileBuffer.length;

      // Get authentication token
      logger.info('Obtaining authentication token...');
      const token = await this.getAuthToken();
      const hospitalId = config.api.runtimeHospitalId || config.api.hospitalId;

      // Prepare form data
      const formData = new FormData();
      
      // Add hospital ID and token (required for authentication)
      formData.append('hospitalId', hospitalId || '');
      formData.append('token', token);
      
      // Add the complete DICOM file
      formData.append('file', fileBuffer, {
        filename: `${transfer.patient_id}_${transfer.study_date}.dcm`,
        contentType: 'application/dicom'
      });

      // Add metadata (optional, for reference)
      formData.append('patient_id', transfer.patient_id || '');
      formData.append('patient_name', transfer.patient_name || '');
      formData.append('study_date', transfer.study_date || '');
      formData.append('modality', transfer.modality || '');
      formData.append('accession_number', transfer.accession_number || '');
      formData.append('study_instance_uid', transfer.study_instance_uid || '');

      // Prepare request headers
      const headers = {
        ...formData.getHeaders()
      };

      // Send request
      const receiveUrl = `${config.api.url}${config.api.endpoints.receive}`;
      logger.info('API outgoing payload (receive)', {
        endpoint: receiveUrl,
        method: 'POST',
        headers: {
          'content-type': headers['content-type']
        },
        payload: {
          hospitalId: hospitalId || '',
          token: maskValue(token),
          patient_id: transfer.patient_id || '',
          patient_name: transfer.patient_name || '',
          study_date: transfer.study_date || '',
          modality: transfer.modality || '',
          accession_number: transfer.accession_number || '',
          study_instance_uid: transfer.study_instance_uid || '',
          file: {
            filename: `${transfer.patient_id}_${transfer.study_date}.dcm`,
            contentType: 'application/dicom',
            sizeBytes: fileSize
          }
        }
      });
      logger.info(`Sending to ${receiveUrl}`);
      const response = await axios.post(receiveUrl, formData, {
        headers,
        timeout: config.api.timeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const responseTime = Date.now() - startTime;

      // Log API call
      ApiLogModel.create({
        transferId: transfer.id,
        endpoint: `${config.api.url}${config.api.endpoints.receive}`,
        method: 'POST',
        statusCode: response.status,
        responseTime,
        requestSize: fileSize,
        responseBody: JSON.stringify(response.data)
      });

      // Update transfer status
      TransferModel.updateStatus(transfer.id, 'sent', null);

      logger.info(`\u2705 Transfer ${transfer.id} SUCCESS - ${transfer.patient_id} (${responseTime}ms)`);
      logger.info(`\u27a4  Assist.id: Delivering Healthcare Excellence`);
      logger.api('file_sent', {
        transferId: transfer.id,
        patientId: transfer.patient_id,
        responseTime,
        statusCode: response.status
      });

      EventModel.log('api', `File sent successfully: ${transfer.patient_id}`, 'info', {
        transferId: transfer.id,
        responseTime
      });

      // Update connection status
      ConnectionModel.update('api', 'connected', `Last successful upload: ${new Date().toISOString()}`);

      this.emit('transferred', { transfer, response });

      // Clean up file after successful upload
      if (await fs.pathExists(transfer.file_path)) {
        await fs.remove(transfer.file_path);
        logger.info(`Deleted successfully uploaded file: ${transfer.file_path}`);
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log error prominently with full details
      logger.error(`Transfer ${transfer.id} failed:`, error.message);
      logger.error(`Error details - Code: ${error.code || 'N/A'}, Patient: ${transfer.patient_id}`);
      
      // Determine if error is retryable
      const isRetryable = this.isRetryableError(error);
      
      if (isRetryable && transfer.retries < config.retry.maxRetries) {
        // Increment retry count
        TransferModel.incrementRetries(transfer.id);
        TransferModel.updateStatus(transfer.id, 'pending', error.message);
        
        logger.warn(`Will retry transfer ${transfer.id} (attempt ${transfer.retries + 1}/${config.retry.maxRetries}) - Error: ${error.message}`);
      } else {
        // Mark as failed and delete file
        TransferModel.updateStatus(transfer.id, 'failed', error.message);
        logger.error(`Transfer ${transfer.id} marked as FAILED permanently - ${error.message}`);
        
        // Delete the file since we won't retry
        if (await fs.pathExists(transfer.file_path)) {
          await fs.remove(transfer.file_path);
          logger.info(`Deleted failed transfer file: ${transfer.file_path}`);
        }
      }

      // Log API call (always log failures)
      ApiLogModel.create({
        transferId: transfer.id,
        endpoint: config.api.url,
        method: 'POST',
        statusCode: error.response ? error.response.status : null,
        responseTime,
        error: error.message
      });

      EventModel.log('api', `File transfer failed: ${transfer.patient_id}`, 'error', {
        transferId: transfer.id,
        error: error.message,
        errorCode: error.code || 'unknown',
        retries: transfer.retries,
        willRetry: isRetryable && transfer.retries < config.retry.maxRetries
      });

      // Update connection status
      ConnectionModel.update('api', 'error', error.message);

      this.emit('error', { transfer, error });
    }
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(error) {
    // Network errors are retryable
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND') {
      return true;
    }

    // 5xx server errors are retryable
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // 429 (Too Many Requests) is retryable
    if (error.response && error.response.status === 429) {
      return true;
    }

    // Other errors are not retryable
    return false;
  }

  /**
   * Test API connection and validate credentials
   */
  async testConnection() {
    try {
      logger.info('Testing API connection and validating credentials...');

      // Use runtime credentials if available, otherwise fall back to config
      const hospitalId = config.api.runtimeHospitalId || config.api.hospitalId;
      const apiKey = config.api.runtimeKey || config.api.key;

      if (!hospitalId || !apiKey) {
        throw new Error('Hospital ID and API Key not configured. Please login first.');
      }

      // Build validation URL
      const validateUrl = `${config.api.url}${config.api.endpoints.validate}`;

      // Validate credentials
      const response = await axios.post(validateUrl, {}, {
        headers: {
          'hospital_id': hospitalId,
          'api_key': apiKey
        },
        timeout: 0
      });

      if (response.data && response.data.valid) {
        logger.info('API connection and credentials valid');
        ConnectionModel.update('api', 'connected', `Hospital: ${response.data.data.hospitalName}`);
        
        return {
          success: true,
          valid: true,
          status: response.status,
          message: 'API connection successful and credentials validated',
          hospital: response.data.data
        };
      } else {
        throw new Error('Credentials validation failed');
      }
    } catch (error) {
      logger.error('API connection test failed:', error.message);
      
      let errorMsg = error.message;
      if (error.response && error.response.data) {
        errorMsg = error.response.data.message || error.message;
      }
      
      ConnectionModel.update('api', 'error', errorMsg);
      
      return {
        success: false,
        valid: false,
        error: errorMsg,
        message: 'API connection or validation failed'
      };
    }
  }

  /**
   * Get forwarder status
   */
  getStatus() {
    return {
      processing: this.processing,
      activeTransfers: this.activeTransfers,
      maxConcurrent: this.maxConcurrent,
      apiUrl: `${config.api.url}${config.api.endpoints.receive}`,
      hospitalId: config.api.runtimeHospitalId || config.api.hospitalId,
      hospitalName: config.api.runtimeHospitalName || '',
      hasAuth: !!(config.api.runtimeKey || config.api.key) && !!(config.api.runtimeHospitalId || config.api.hospitalId)
    };
  }
}

// Create singleton instance
const forwarder = new ApiForwarder();

module.exports = forwarder;
