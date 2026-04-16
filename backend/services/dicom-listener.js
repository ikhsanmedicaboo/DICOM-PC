const net = require('net');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const dicomParser = require('dicom-parser');
const config = require('../config/default');
const logger = require('./logger');
const { TransferModel } = require('../database/models');

class DicomListener extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.isRunning = false;
    this.connections = new Map();
    this.storescpProcess = null;
    this.useStorescp = false; // Will try to use DCMTK storescp first
    this.recentlyProcessed = new Map(); // Track recently processed files to prevent duplicates
  }

  /**
   * Check if port is available
   */
  async checkPortAvailability(port) {
    return new Promise((resolve) => {
      const testServer = net.createServer();
      
      testServer.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      });
      
      testServer.once('listening', () => {
        testServer.close(() => {
          resolve(true);
        });
      });
      
      testServer.listen(port, '0.0.0.0');
    });
  }

  /**
   * Find process using the port
   */
  async findProcessUsingPort(port) {
    return new Promise((resolve) => {
      let command, args;
      
      if (process.platform === 'win32') {
        command = 'netstat';
        args = ['-ano'];
      } else {
        command = 'lsof';
        args = ['-i', `:${port}`, '-sTCP:LISTEN', '-n', '-P'];
      }
      
      const proc = spawn(command, args);
      let output = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0 && output) {
          const lines = output.split('\n');
          if (lines.length > 1) {
            const processInfo = lines[1].split(/\s+/);
            const processName = processInfo[0] || 'unknown';
            const pid = processInfo[1] || 'unknown';
            resolve({ name: processName, pid: pid, inUse: true });
            return;
          }
        }
        resolve({ inUse: false });
      });
      
      proc.on('error', () => {
        resolve({ inUse: false });
      });
    });
  }

  /**
   * Start DICOM listener
   */
  async start() {
    if (this.isRunning) {
      logger.warn('DICOM listener already running');
      return;
    }

    try {
      // Ensure storage directory exists
      await fs.ensureDir(config.dicom.storagePath);

      // Check if port is available
      const portAvailable = await this.checkPortAvailability(config.dicom.port);
      
      if (!portAvailable) {
        const processInfo = await this.findProcessUsingPort(config.dicom.port);
        
        if (processInfo.inUse) {
          const processName = processInfo.name || 'unknown';
          
          // Check if it's our own process (storescp, node, DICOM-Router)
          const isOurProcess = processName.toLowerCase().includes('storescp') ||
                               processName.toLowerCase().includes('node') ||
                               processName.toLowerCase().includes('dicom');
          
          if (isOurProcess) {
            logger.warn(`Port ${config.dicom.port} is already in use by ${processName} (PID: ${processInfo.pid})`);
            logger.info('Assuming DICOM listener is already running from another instance');
            logger.info('If this is incorrect, please stop the other instance or change DICOM_PORT in .env');
            this.isRunning = true;
            this.emit('started');
            return;
          } else {
            const errorMsg = `Port ${config.dicom.port} is in use by ${processName} (PID: ${processInfo.pid}). Please stop that process or change DICOM_PORT in .env file.`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
          }
        }
      }

      // Try to use DCMTK storescp if available
      const storescpAvailable = await this.checkStorescp();
      
      if (storescpAvailable) {
        logger.info('Using DCMTK storescp for DICOM listener');
        this.useStorescp = true;
        try {
          await this.startStorescp();
        } catch (error) {
          // Check if error is due to storescp already running
          if (error.message && error.message.includes('Address already in use')) {
            const processInfo = await this.findProcessUsingPort(config.dicom.port);
            if (processInfo.inUse && processInfo.name && processInfo.name.toLowerCase().includes('storescp')) {
              logger.info(`storescp is already running on port ${config.dicom.port} (PID: ${processInfo.pid})`);
              logger.info('Continuing with existing storescp instance');
              this.startFileWatcher();
              this.isRunning = true;
              this.emit('started');
              return;
            }
          }
          // If not already running, fall back to built-in listener
          logger.warn('storescp failed to start, falling back to built-in listener');
          this.useStorescp = false;
          await this.startBuiltinListener();
        }
      } else {
        logger.info('DCMTK storescp not found, using built-in DICOM receiver');
        await this.startBuiltinListener();
      }

      this.isRunning = true;
      logger.info('='.repeat(50));
      logger.info(`✅ DICOM Listener Started on port ${config.dicom.port}`);
      logger.info(`   AE Title: ${config.dicom.aet}`);
      logger.info(`   Storage Path: ${config.dicom.storagePath}`);
      logger.info('='.repeat(50));
      
      this.emit('started');
    } catch (error) {
      logger.error('Failed to start DICOM listener:', error);
      throw error;
    }
  }

  /**
   * Check if DCMTK storescp is available
   */
  async checkStorescp() {
    return new Promise((resolve) => {
      const proc = spawn('storescp', ['--version']);
      
      proc.on('error', () => resolve(false));
      proc.on('exit', (code) => resolve(code === 0));
      
      // Timeout after 2 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 2000);
    });
  }

  /**
   * Start DCMTK storescp process
   */
  async startStorescp() {
    return new Promise((resolve, reject) => {
      // storescp command: storescp --fork -od <output-dir> <port> -aet <AET>
      const args = [
        '--fork',                          // Handle multiple associations
        '-od', config.dicom.storagePath,  // Output directory
        config.dicom.port.toString(),     // Port
        '-aet', config.dicom.aet,         // Our AE Title
        '+xa'                              // Accept any calling AE title
      ];

      logger.info(`Starting storescp: storescp ${args.join(' ')}`);

      this.storescpProcess = spawn('storescp', args);

      this.storescpProcess.stdout.on('data', (data) => {
        logger.debug(`storescp: ${data.toString().trim()}`);
      });

      this.storescpProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        logger.info(`storescp: ${message}`);
        
        // Check if file was received
        if (message.includes('Association Received') || message.includes('storing')) {
          // Will trigger file watcher
        }
      });

      this.storescpProcess.on('error', (error) => {
        logger.error('storescp process error:', error);
        reject(error);
      });

      this.storescpProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          logger.error(`storescp exited with code ${code}`);
          this.isRunning = false;
          this.emit('stopped');
        }
      });

      // Start file watcher for new DICOM files
      this.startFileWatcher();

      // Give it a moment to start
      setTimeout(() => resolve(), 1000);
    });
  }

  /**
   * Watch for new DICOM files in storage directory
   */
  startFileWatcher() {
    // Track processed files to avoid duplicate processing
    this.processedFiles = new Set();

    // Check for new files every 2 seconds
    this.watcherInterval = setInterval(async () => {
      try {
        const files = await fs.readdir(config.dicom.storagePath);
        
        for (const filename of files) {
          // Skip if already processed
          if (this.processedFiles.has(filename)) {
            continue;
          }

          // Skip dot files and directories (storescp doesn't use extensions)
          if (filename.startsWith('.')) {
            continue;
          }

          const filePath = path.join(config.dicom.storagePath, filename);
          
          // Check if it's a file (not a directory)
          try {
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
              continue;
            }
          } catch (err) {
            continue;
          }
          
          // Check if file is fully written (size stable)
          try {
            const stats1 = await fs.stat(filePath);
            await new Promise(resolve => setTimeout(resolve, 500));
            const stats2 = await fs.stat(filePath);
            
            if (stats1.size === stats2.size && stats2.size > 0) {
              // File is complete - convert to absolute path
              const absolutePath = path.resolve(filePath);
              this.processedFiles.add(filename);
              await this.processReceivedFile(absolutePath);
            }
          } catch (err) {
            // File might have been moved/deleted
            logger.debug(`File check error for ${filename}:`, err.message);
          }
        }
      } catch (error) {
        logger.error('File watcher error:', error);
      }
    }, 2000);
  }

  /**
   * Start built-in DICOM listener (basic TCP receiver)
   */
  async startBuiltinListener() {
    return new Promise((resolve, reject) => {
      // Initialize processed files set for built-in listener
      this.processedFiles = new Set();
      
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${config.dicom.port} is already in use`));
        } else {
          reject(error);
        }
      });

      this.server.listen(config.dicom.port, '0.0.0.0', () => {
        logger.info(`Built-in DICOM listener ready on port ${config.dicom.port}`);
        resolve();
      });
    });
  }

  /**
   * Handle incoming DICOM connection - implements DICOM Upper Layer Protocol
   * Supports: C-ECHO (verification) and C-STORE (file reception)
   */
  handleConnection(socket) {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
    logger.info(`DICOM connection from ${connectionId}`);
    this.connections.set(connectionId, socket);

    const state = {
      buffer: Buffer.alloc(0),
      presentationContexts: {},  // pcId -> accepted transfer syntax
      commandBuffers: {},         // pcId -> Buffer[] (accumulate command PDVs)
      datasetBuffers: {},         // pcId -> Buffer[] (accumulate dataset PDVs)
      pendingCommand: null        // most recent C-STORE-RQ info
    };

    socket.on('data', (chunk) => {
      state.buffer = Buffer.concat([state.buffer, chunk]);
      this.processPduBuffer(socket, state, connectionId);
    });

    socket.on('end', () => {
      logger.info(`DICOM connection closed: ${connectionId}`);
      this.connections.delete(connectionId);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${connectionId}:`, error.message);
      this.connections.delete(connectionId);
    });
  }

  /**
   * Pull complete PDUs out of the state buffer and dispatch them
   */
  processPduBuffer(socket, state, connectionId) {
    while (state.buffer.length >= 6) {
      const pduType   = state.buffer[0];
      const pduLength = state.buffer.readUInt32BE(2);
      const total     = 6 + pduLength;
      if (state.buffer.length < total) break;

      const pduData   = state.buffer.slice(6, total);
      state.buffer    = state.buffer.slice(total);

      try {
        switch (pduType) {
          case 0x01: this.handleAssociateRQ(socket, state, pduData); break;
          case 0x04: this.handlePDataTF(socket, state, pduData, connectionId); break;
          case 0x05: this.handleReleaseRQ(socket); break;
          case 0x07: socket.destroy(); break; // A-ABORT
          default: logger.debug(`Unknown PDU type: 0x${pduType.toString(16)}`);
        }
      } catch (err) {
        logger.error(`PDU handling error (type 0x${pduType.toString(16)}): ${err.message}`);
      }
    }
  }

  /**
   * Handle A-ASSOCIATE-RQ: parse presentation contexts, reply with A-ASSOCIATE-AC
   */
  handleAssociateRQ(socket, state, data) {
    const calledAE  = data.slice(4, 20);
    const callingAE = data.slice(20, 36);

    let offset = 68; // skip fixed 68-byte header to variable items
    const acceptedPCs = {};

    while (offset + 4 <= data.length) {
      const itemType   = data[offset];
      const itemLength = data.readUInt16BE(offset + 2);
      const itemEnd    = offset + 4 + itemLength;
      if (itemEnd > data.length) break;
      const itemData   = data.slice(offset + 4, itemEnd);
      offset = itemEnd;

      if (itemType === 0x20) { // Presentation Context item
        const pcId = itemData[0];
        let ts = '1.2.840.10008.1.2.1'; // default: Explicit VR Little Endian
        let inner = 4;
        while (inner + 4 <= itemData.length) {
          const subType   = itemData[inner];
          const subLength = itemData.readUInt16BE(inner + 2);
          if (subType === 0x40 && subLength > 0) { // Transfer Syntax sub-item
            ts = itemData.slice(inner + 4, inner + 4 + subLength)
                          .toString('ascii').replace(/\0/g, '').trim();
            break;
          }
          inner += 4 + subLength;
        }
        acceptedPCs[pcId] = ts;
      }
    }

    state.presentationContexts = acceptedPCs;
    logger.info(`A-ASSOCIATE-RQ: accepting ${Object.keys(acceptedPCs).length} presentation context(s)`);
    socket.write(this.buildAssociateAC(calledAE, callingAE, acceptedPCs));
    logger.info('Sent A-ASSOCIATE-AC');
  }

  /**
   * Build A-ASSOCIATE-AC PDU
   */
  buildAssociateAC(calledAE, callingAE, acceptedPCs) {
    const parts = [];

    // Application Context Item (0x10)
    const appUID  = Buffer.from('1.2.840.10008.3.1.1.1', 'ascii');
    const appItem = Buffer.alloc(4 + appUID.length);
    appItem[0] = 0x10;
    appItem.writeUInt16BE(appUID.length, 2);
    appUID.copy(appItem, 4);
    parts.push(appItem);

    // Accepted Presentation Context Items (0x21)
    for (const [pcId, ts] of Object.entries(acceptedPCs)) {
      const tsBytes = Buffer.from(ts, 'ascii');
      const tsItem  = Buffer.alloc(4 + tsBytes.length);
      tsItem[0] = 0x40;
      tsItem.writeUInt16BE(tsBytes.length, 2);
      tsBytes.copy(tsItem, 4);
      const pcPayload = Buffer.concat([Buffer.from([parseInt(pcId), 0x00, 0x00, 0x00]), tsItem]);
      const pcItem    = Buffer.alloc(4 + pcPayload.length);
      pcItem[0] = 0x21;
      pcItem.writeUInt16BE(pcPayload.length, 2);
      pcPayload.copy(pcItem, 4);
      parts.push(pcItem);
    }

    // User Information Item (0x50) with Max PDU Length = 65536
    const maxLen = Buffer.alloc(8);
    maxLen[0] = 0x51;
    maxLen.writeUInt16BE(4, 2);
    maxLen.writeUInt32BE(65536, 4);
    const userItem = Buffer.alloc(4 + maxLen.length);
    userItem[0] = 0x50;
    userItem.writeUInt16BE(maxLen.length, 2);
    maxLen.copy(userItem, 4);
    parts.push(userItem);

    const varItems   = Buffer.concat(parts);
    const fixedHdr   = Buffer.alloc(68);
    fixedHdr.writeUInt16BE(0x0001, 0);
    calledAE.copy(fixedHdr, 4);
    callingAE.copy(fixedHdr, 20);

    const body = Buffer.concat([fixedHdr, varItems]);
    const pdu  = Buffer.alloc(6 + body.length);
    pdu[0] = 0x02; // A-ASSOCIATE-AC
    pdu.writeUInt32BE(body.length, 2);
    body.copy(pdu, 6);
    return pdu;
  }

  /**
   * Handle P-DATA-TF PDU: reassemble PDV fragments and dispatch DIMSE commands
   */
  handlePDataTF(socket, state, data, connectionId) {
    let offset = 0;
    while (offset + 6 <= data.length) {
      const pdvLength = data.readUInt32BE(offset);
      if (offset + 4 + pdvLength > data.length) break;
      const pcId    = data[offset + 4];
      const mch     = data[offset + 5];
      const isCmd   = (mch & 0x02) !== 0;
      const isLast  = (mch & 0x01) !== 0;
      const payload = data.slice(offset + 6, offset + 4 + pdvLength);
      offset += 4 + pdvLength;

      if (isCmd) {
        if (!state.commandBuffers[pcId]) state.commandBuffers[pcId] = [];
        state.commandBuffers[pcId].push(payload);
        if (isLast) {
          const cmdBuf = Buffer.concat(state.commandBuffers[pcId]);
          state.commandBuffers[pcId] = [];
          this.dispatchDimseCommand(socket, state, pcId, cmdBuf, connectionId);
        }
      } else {
        if (!state.datasetBuffers[pcId]) state.datasetBuffers[pcId] = [];
        state.datasetBuffers[pcId].push(payload);
        if (isLast && state.pendingCommand && state.pendingCommand.pcId === pcId) {
          const dsBuf = Buffer.concat(state.datasetBuffers[pcId]);
          state.datasetBuffers[pcId] = [];
          this.handleCStoreDataset(socket, state, pcId, dsBuf, connectionId);
        }
      }
    }
  }

  /**
   * Parse minimum DICOM command dataset (group 0000, implicit VR little endian)
   */
  parseDimseCommand(data) {
    const cmd = {};
    let offset = 0;
    while (offset + 8 <= data.length) {
      const group   = data.readUInt16LE(offset);
      const element = data.readUInt16LE(offset + 2);
      const length  = data.readUInt32LE(offset + 4);
      if (group !== 0x0000) break;
      const val = data.slice(offset + 8, offset + 8 + length);
      switch (element) {
        case 0x0002: cmd.affectedSOPClassUID    = val.toString('ascii').replace(/\0/g, '').trim(); break;
        case 0x0100: cmd.commandField           = val.readUInt16LE(0); break;
        case 0x0110: cmd.messageId              = val.readUInt16LE(0); break;
        case 0x0800: cmd.dataSetType            = val.readUInt16LE(0); break;
        case 0x1000: cmd.affectedSOPInstanceUID = val.toString('ascii').replace(/\0/g, '').trim(); break;
      }
      offset += 8 + length;
    }
    return cmd;
  }

  /**
   * Dispatch a fully-reassembled DIMSE command
   */
  dispatchDimseCommand(socket, state, pcId, cmdBuf, connectionId) {
    const cmd = this.parseDimseCommand(cmdBuf);
    logger.info(`DIMSE 0x${(cmd.commandField || 0).toString(16).padStart(4, '0')} on PC ${pcId} from ${connectionId}`);

    switch (cmd.commandField) {
      case 0x0030: // C-ECHO-RQ
        this.sendCEchoRSP(socket, pcId, cmd.messageId || 1, cmd.affectedSOPClassUID);
        break;
      case 0x0001: // C-STORE-RQ
        state.pendingCommand = {
          pcId,
          messageId:        cmd.messageId,
          sopClassUID:      cmd.affectedSOPClassUID,
          sopInstanceUID:   cmd.affectedSOPInstanceUID
        };
        // dataSetType 0x0101 means no dataset follows (unusual for C-STORE, handle gracefully)
        if (cmd.dataSetType === 0x0101) {
          this.sendCStoreRSP(socket, pcId, cmd.messageId, cmd.affectedSOPClassUID, cmd.affectedSOPInstanceUID);
          state.pendingCommand = null;
        }
        break;
      default:
        logger.warn(`Unhandled DIMSE command: 0x${(cmd.commandField || 0).toString(16)}`);
    }
  }

  /** Encode element for command dataset (implicit VR little endian) */
  encodeCmdElement(group, element, value) {
    const buf = Buffer.alloc(8 + value.length);
    buf.writeUInt16LE(group, 0);
    buf.writeUInt16LE(element, 2);
    buf.writeUInt32LE(value.length, 4);
    value.copy(buf, 8);
    return buf;
  }

  /** Build command group-0000 dataset with prepended group-length tag */
  buildCommandDataset(elements) {
    const body = Buffer.concat(elements.map(e => this.encodeCmdElement(e.g, e.e, e.v)));
    const glBuf = Buffer.alloc(4); glBuf.writeUInt32LE(body.length, 0);
    return Buffer.concat([this.encodeCmdElement(0x0000, 0x0000, glBuf), body]);
  }

  /** Encode uint16 as 2-byte LE Buffer */
  encUint16(val) { const b = Buffer.alloc(2); b.writeUInt16LE(val, 0); return b; }

  /** Encode UID string as even-length ASCII Buffer (null-padded) */
  encUID(uid) {
    const b = Buffer.from(uid || '', 'ascii');
    return b.length % 2 !== 0 ? Buffer.concat([b, Buffer.from([0x00])]) : b;
  }

  /** Send C-ECHO-RSP */
  sendCEchoRSP(socket, pcId, messageId, sopClassUID) {
    const uid = sopClassUID || '1.2.840.10008.1.1';
    const ds = this.buildCommandDataset([
      { g: 0x0000, e: 0x0002, v: this.encUID(uid) },
      { g: 0x0000, e: 0x0100, v: this.encUint16(0x8030) }, // C-ECHO-RSP
      { g: 0x0000, e: 0x0120, v: this.encUint16(messageId) },
      { g: 0x0000, e: 0x0800, v: this.encUint16(0x0101) }, // no dataset
      { g: 0x0000, e: 0x0900, v: this.encUint16(0x0000) }  // success
    ]);
    this.sendPData(socket, pcId, ds, true);
    logger.info(`Sent C-ECHO-RSP success on PC ${pcId}`);
  }

  /** Receive completed C-STORE dataset, save it, send C-STORE-RSP */
  async handleCStoreDataset(socket, state, pcId, datasetBuf, connectionId) {
    const cmd = state.pendingCommand;
    state.pendingCommand = null;
    this.sendCStoreRSP(socket, pcId, cmd.messageId, cmd.sopClassUID, cmd.sopInstanceUID);
    try {
      await this.saveAndProcessDicom(datasetBuf, connectionId);
    } catch (err) {
      logger.error('Error saving C-STORE dataset:', err.message);
    }
  }

  /** Send C-STORE-RSP */
  sendCStoreRSP(socket, pcId, messageId, sopClassUID, sopInstanceUID) {
    const uid  = sopClassUID    || '1.2.840.10008.5.1.4.1.1.1';
    const iuid = sopInstanceUID || this.generateUid();
    const ds = this.buildCommandDataset([
      { g: 0x0000, e: 0x0002, v: this.encUID(uid) },
      { g: 0x0000, e: 0x0100, v: this.encUint16(0x8001) }, // C-STORE-RSP
      { g: 0x0000, e: 0x0120, v: this.encUint16(messageId || 1) },
      { g: 0x0000, e: 0x0800, v: this.encUint16(0x0101) }, // no dataset
      { g: 0x0000, e: 0x0900, v: this.encUint16(0x0000) }, // success
      { g: 0x0000, e: 0x1000, v: this.encUID(iuid) }
    ]);
    this.sendPData(socket, pcId, ds, true);
    logger.info(`Sent C-STORE-RSP success on PC ${pcId}`);
  }

  /** Send P-DATA-TF PDU (single PDV, last fragment) */
  sendPData(socket, pcId, data, isCommand) {
    const mch     = isCommand ? 0x03 : 0x02; // bit0=last, bit1=command
    const pdvItem = Buffer.alloc(6 + data.length);
    pdvItem.writeUInt32BE(2 + data.length, 0); // pdv item length = pcId+mch+data
    pdvItem[4] = pcId;
    pdvItem[5] = mch;
    data.copy(pdvItem, 6);
    const pdu = Buffer.alloc(6 + pdvItem.length);
    pdu[0] = 0x04;
    pdu.writeUInt32BE(pdvItem.length, 2);
    pdvItem.copy(pdu, 6);
    socket.write(pdu);
  }

  /** Handle A-RELEASE-RQ: send A-RELEASE-RP */
  handleReleaseRQ(socket) {
    const pdu = Buffer.alloc(10);
    pdu[0] = 0x06;
    pdu.writeUInt32BE(4, 2);
    socket.write(pdu);
    logger.info('Sent A-RELEASE-RP');
  }

  /**
   * Save and process received DICOM buffer
   */
  async saveAndProcessDicom(buffer, source) {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `dcm_${timestamp}_${Math.random().toString(36).substr(2, 9)}.dcm`;
      const filePath = path.join(config.dicom.storagePath, filename);

      // Save to disk
      await fs.writeFile(filePath, buffer);
      logger.info(`DICOM file saved: ${filename} (${buffer.length} bytes) from ${source}`);

      // Mark as processed to prevent file watcher from processing it again
      if (this.processedFiles) {
        this.processedFiles.add(filename);
      }

      // Process the file
      await this.processReceivedFile(filePath);

    } catch (error) {
      logger.error('Error saving DICOM file:', error);
      throw error;
    }
  }

  /**
   * Process received DICOM file (parse metadata and queue for upload)
   */
  async processReceivedFile(filePath) {
    try {
      const normalizedPath = await this.ensureDcmExtension(filePath);
      
      // Check if this file was recently processed (prevent duplicate processing)
      const filename = path.basename(normalizedPath);
      const recentProcessTime = this.recentlyProcessed.get(filename);
      const now = Date.now();
      
      if (recentProcessTime && (now - recentProcessTime) < 10000) {
        // File was processed within last 10 seconds, skip duplicate
        logger.warn(`Skipping duplicate processing of ${filename} (processed ${now - recentProcessTime}ms ago)`);
        return;
      }
      
      // Mark as being processed
      this.recentlyProcessed.set(filename, now);
      
      // Clean up old entries (older than 30 seconds)
      for (const [key, timestamp] of this.recentlyProcessed.entries()) {
        if (now - timestamp > 30000) {
          this.recentlyProcessed.delete(key);
        }
      }
      
      logger.info(`Processing DICOM file: ${normalizedPath}`);

      // Read and parse DICOM file
      const fileBuffer = await fs.readFile(normalizedPath);
      const dataSet = dicomParser.parseDicom(fileBuffer);

      // Extract metadata
      const metadata = {
        patientId: this.getStringValue(dataSet, 'x00100020') || 'UNKNOWN',
        patientName: this.getStringValue(dataSet, 'x00100010') || 'UNKNOWN',
        studyDate: this.getStringValue(dataSet, 'x00080020') || '',
        studyTime: this.getStringValue(dataSet, 'x00080030') || '',
        modality: this.getStringValue(dataSet, 'x00080060') || 'OT',
        accessionNumber: this.getStringValue(dataSet, 'x00080050') || '',
        studyInstanceUid: this.getStringValue(dataSet, 'x0020000d') || '',
        seriesInstanceUid: this.getStringValue(dataSet, 'x0020000e') || '',
        sopInstanceUid: this.getStringValue(dataSet, 'x00080018') || ''
      };

      const fileSize = fileBuffer.length;

      logger.info(`DICOM metadata: Patient=${metadata.patientId}, Modality=${metadata.modality}, Study=${metadata.studyDate}`);

      // Allow re-processing same Study Instance UID across repeated sends.

      // Insert into database
      const transferId = TransferModel.create({
        patientId: metadata.patientId,
        patientName: metadata.patientName,
        studyDate: metadata.studyDate,
        studyTime: metadata.studyTime,
        modality: metadata.modality,
        accessionNumber: metadata.accessionNumber,
        studyInstanceUid: metadata.studyInstanceUid,
        seriesInstanceUid: metadata.seriesInstanceUid,
        sopInstanceUid: metadata.sopInstanceUid,
        filePath: normalizedPath,
        fileSize: fileSize,
        status: 'pending'
      });

      logger.info(`Transfer ${transferId} created and queued`);

      // Emit event for UI updates
      this.emit('file-received', {
        transferId,
        patientId: metadata.patientId,
        modality: metadata.modality,
        fileSize
      });

    } catch (error) {
      logger.error('Error processing DICOM file:', error);
      throw error;
    }
  }

  async ensureDcmExtension(filePath) {
    if (path.extname(filePath).toLowerCase() === '.dcm') {
      return filePath;
    }

    const newPath = `${filePath}.dcm`;
    const sourceExists = await fs.pathExists(filePath);
    const targetExists = await fs.pathExists(newPath);

    if (sourceExists && targetExists) {
      await fs.move(filePath, newPath, { overwrite: true });
      logger.info(`Overwrote existing .dcm file and reprocessed: ${path.basename(newPath)}`);
      return newPath;
    }

    if (!sourceExists && targetExists) {
      return newPath;
    }

    await fs.move(filePath, newPath, { overwrite: false });
    logger.info(`Renamed received file to .dcm: ${path.basename(newPath)}`);
    return newPath;
  }

  /**
   * Get string value from DICOM dataset
   */
  getStringValue(dataSet, tag) {
    try {
      const element = dataSet.elements[tag];
      if (!element) return '';
      
      const value = dataSet.string(tag);
      return value ? value.trim() : '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate unique UID
   */
  generateUid() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `1.2.840.99999.${timestamp}.${random}`;
  }

  /**
   * Stop DICOM listener
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop file watcher
      if (this.watcherInterval) {
        clearInterval(this.watcherInterval);
        this.watcherInterval = null;
      }

      // Stop storescp process
      if (this.storescpProcess) {
        this.storescpProcess.kill();
        this.storescpProcess = null;
      }

      // Close built-in server
      if (this.server) {
        // Close all connections
        for (const [id, socket] of this.connections) {
          socket.destroy();
        }
        this.connections.clear();

        // Close server
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        this.server = null;
      }

      this.isRunning = false;
      logger.info('DICOM listener stopped');
      this.emit('stopped');
    } catch (error) {
      logger.error('Error stopping DICOM listener:', error);
      throw error;
    }
  }

  /**
   * Get listener status
   */
  getStatus() {
    return {
      running: this.isRunning,
      port: config.dicom.port,
      aet: config.dicom.aet,
      method: this.useStorescp ? 'storescp' : 'built-in',
      connections: this.connections.size
    };
  }
}

// Create singleton instance
const dicomListener = new DicomListener();

module.exports = dicomListener;
