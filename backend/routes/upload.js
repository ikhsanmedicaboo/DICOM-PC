const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const dicomParser = require('dicom-parser');
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config/default');
const logger = require('../services/logger');
const { TransferModel, EventModel } = require('../database/models');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../storage/uploads');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.dcm' && ext !== '.dicom') {
      return cb(new Error('Only DICOM files (.dcm, .dicom) are allowed'));
    }
    cb(null, true);
  }
});

/**
 * POST /api/upload - Upload DICOM file and forward to API
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    filePath = req.file.path;
    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

    // Read and parse DICOM file
    const fileBuffer = await fs.readFile(filePath);
    const dataSet = dicomParser.parseDicom(fileBuffer);

    // Extract metadata
    const metadata = {
      patientId: getStringValue(dataSet, 'x00100020') || 'UNKNOWN',
      patientName: getStringValue(dataSet, 'x00100010') || 'UNKNOWN',
      studyDate: getStringValue(dataSet, 'x00080020') || '',
      studyTime: getStringValue(dataSet, 'x00080030') || '',
      modality: getStringValue(dataSet, 'x00080060') || '',
      accessionNumber: getStringValue(dataSet, 'x00080050') || '',
      studyInstanceUid: getStringValue(dataSet, 'x0020000d') || generateUid(),
      seriesInstanceUid: getStringValue(dataSet, 'x0020000e') || '',
      sopInstanceUid: getStringValue(dataSet, 'x00080018') || ''
    };

    // If study instance UID already exists, generate a new one to avoid conflicts
    const TransferModel = require('../database/models').TransferModel;
    const existingTransfer = TransferModel.getByStudyInstanceUid(metadata.studyInstanceUid);
    if (existingTransfer) {
      logger.warn(`Duplicate Study Instance UID detected: ${metadata.studyInstanceUid}, generating new UID`);
      metadata.studyInstanceUid = generateUid();
    }

    logger.info(`DICOM metadata: Patient=${metadata.patientId}, Modality=${metadata.modality}, Study=${metadata.studyDate}`);

    // Save to database
    const transferId = TransferModel.create({
      ...metadata,
      filePath: filePath,
      fileSize: req.file.size
    });

    EventModel.log('upload', `File uploaded via web UI: ${req.file.originalname}`, 'info', {
      transferId,
      size: req.file.size,
      patientId: metadata.patientId
    });

    // Return success response immediately
    res.json({
      success: true,
      message: 'DICOM file received and queued for processing',
      data: {
        id: transferId,
        filename: req.file.originalname,
        filesize: req.file.size,
        patientId: metadata.patientId,
        studyDate: metadata.studyDate,
        modality: metadata.modality,
        receivedAt: new Date().toISOString()
      }
    });

    logger.info(`Transfer ${transferId} created and queued`);

  } catch (error) {
    logger.error('Upload error:', error);

    // Clean up file if it exists
    if (filePath) {
      try {
        await fs.remove(filePath);
      } catch (cleanupError) {
        logger.error('Failed to clean up file:', cleanupError);
      }
    }

    // Check if response has already been sent
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to process upload',
        error: error.message
      });
    }
  }
});

/**
 * Get string value from DICOM dataset
 */
function getStringValue(dataSet, tag) {
  try {
    const element = dataSet.elements[tag];
    if (!element) return '';
    return dataSet.string(tag).trim();
  } catch (err) {
    return '';
  }
}

/**
 * Generate UID (simplified)
 */
function generateUid() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `1.2.840.99999.${timestamp}.${random}`;
}

module.exports = router;
