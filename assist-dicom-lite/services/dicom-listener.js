const net = require('net');
const path = require('path');
const fs = require('fs-extra');
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
    this.storescpProcess = null;
    this.useStorescp = false;
    this.connections = new Map();
    this.watcherInterval = null;
    this.receivedInstances = new Map(); // Track SOP Instance UIDs to prevent same-session duplicates
    this.processedFiles = new Set(); // Track files already processed by file watcher
  }

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

  async start() {
    if (this.isRunning) {
      logger.info('DICOM listener is already running');
      return;
    }

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
          this.emit('started', this.getStatus());
          return;
        } else {
          const errorMsg = `Port ${config.dicom.port} is in use by ${processName} (PID: ${processInfo.pid}). Please stop that process or change DICOM_PORT in .env file.`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        }
      } else {
        // Port is in use but we couldn't identify the process
        logger.warn(`Port ${config.dicom.port} is in use but process could not be identified`);
        logger.info('This might be a previous instance. Attempting to start anyway...');
      }
    }

    const hasStorescp = await this.checkStorescp();
    if (hasStorescp) {
      try {
        await this.startStorescp();
        this.useStorescp = true;
        this.startFileWatcher();
        logger.info(`DICOM listener started with storescp on port ${config.dicom.port}`);
      } catch (error) {
        this.useStorescp = false;
        
        // Check if error is due to port already in use by storescp from previous run
        if (error.message && error.message.includes('Address already in use')) {
          const processInfo = await this.findProcessUsingPort(config.dicom.port);
          if (processInfo.inUse && processInfo.name && processInfo.name.toLowerCase().includes('storescp')) {
            logger.info(`storescp is already running on port ${config.dicom.port} (PID: ${processInfo.pid})`);
            logger.info('Continuing with existing storescp instance');
            this.useStorescp = true;
            this.startFileWatcher();
            this.isRunning = true;
            this.emit('started', this.getStatus());
            return;
          }
        }
        
        logger.warn(`storescp failed to start, falling back to built-in listener: ${error.message}`);
        await this.startBuiltinListener();
        logger.info(`DICOM listener started with built-in receiver on port ${config.dicom.port}`);
      }
    } else {
      await this.startBuiltinListener();
      logger.info(`DICOM listener started with built-in receiver on port ${config.dicom.port}`);
    }

    this.isRunning = true;
    this.emit('started', this.getStatus());
  }

  async checkStorescp() {
    return new Promise((resolve) => {
      const proc = spawn('storescp', ['--version']);
      let done = false;

      const finish = (value) => {
        if (done) {
          return;
        }
        done = true;
        resolve(value);
      };

      proc.on('error', () => finish(false));
      proc.on('exit', (code) => finish(code === 0));
      setTimeout(() => {
        try {
          proc.kill();
        } catch (error) {
          logger.debug(`storescp version check kill failed: ${error.message}`);
        }
        finish(false);
      }, 2000);
    });
  }

  async startStorescp() {
    const args = [
      '-od', config.dicom.storagePath,
      '-aet', config.dicom.aet,
      '+xa',
      config.dicom.port.toString()
    ];

    return new Promise((resolve, reject) => {
      let settled = false;
      let stderrOutput = '';

      const finishResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const finishReject = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      this.storescpProcess = spawn('storescp', args);

      this.storescpProcess.stdout.on('data', (data) => {
        logger.debug(`storescp: ${data.toString().trim()}`);
      });

      this.storescpProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        stderrOutput += `${message}\n`;
        logger.info(`storescp: ${message}`);
      });

      this.storescpProcess.on('error', (error) => {
        this.storescpProcess = null;
        finishReject(error);
      });

      this.storescpProcess.on('exit', (code) => {
        const startupError = new Error(
          stderrOutput.trim() || `storescp exited with code ${code}`
        );

        if (!settled) {
          this.storescpProcess = null;
          finishReject(startupError);
          return;
        }

        if (code !== 0 && code !== null) {
          this.storescpProcess = null;
          this.emit('error', startupError);
        }
      });

      setTimeout(() => {
        if (this.storescpProcess && this.storescpProcess.exitCode === null) {
          finishResolve();
        } else if (!settled) {
          finishReject(new Error(stderrOutput.trim() || 'storescp terminated during startup'));
        }
      }, 1000);
    });
  }

  async startBuiltinListener() {
    await new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleConnection(socket));
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${config.dicom.port} is already in use`));
          return;
        }
        reject(error);
      });
      this.server.listen(config.dicom.port, '0.0.0.0', resolve);
    });
  }

  handleConnection(socket) {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
    this.connections.set(connectionId, socket);
    logger.info(`DICOM connection from ${connectionId}`);

    const state = {
      buffer: Buffer.alloc(0),
      presentationContexts: {},
      commandBuffers: {},
      datasetBuffers: {},
      pendingCommand: null
    };

    socket.on('data', (chunk) => {
      state.buffer = Buffer.concat([state.buffer, chunk]);
      this.processPduBuffer(socket, state, connectionId);
    });

    socket.on('end', () => {
      this.connections.delete(connectionId);
      logger.info(`DICOM connection closed: ${connectionId}`);
    });

    socket.on('error', (error) => {
      this.connections.delete(connectionId);
      logger.error(`Socket error for ${connectionId}: ${error.message}`);
      this.emit('error', error);
    });
  }

  processPduBuffer(socket, state, connectionId) {
    while (state.buffer.length >= 6) {
      const pduType = state.buffer[0];
      const pduLength = state.buffer.readUInt32BE(2);
      const totalLength = 6 + pduLength;

      if (state.buffer.length < totalLength) {
        break;
      }

      const pduData = state.buffer.slice(6, totalLength);
      state.buffer = state.buffer.slice(totalLength);

      try {
        switch (pduType) {
          case 0x01:
            this.handleAssociateRQ(socket, state, pduData);
            break;
          case 0x04:
            this.handlePDataTF(socket, state, pduData, connectionId);
            break;
          case 0x05:
            this.handleReleaseRQ(socket);
            break;
          case 0x07:
            socket.destroy();
            break;
          default:
            logger.debug(`Unknown PDU type: 0x${pduType.toString(16)}`);
        }
      } catch (error) {
        logger.error(`PDU handling error for ${connectionId}: ${error.message}`);
      }
    }
  }

  handleAssociateRQ(socket, state, data) {
    const calledAE = data.slice(4, 20);
    const callingAE = data.slice(20, 36);
    const acceptedPCs = {};
    let offset = 68;

    while (offset + 4 <= data.length) {
      const itemType = data[offset];
      const itemLength = data.readUInt16BE(offset + 2);
      const itemEnd = offset + 4 + itemLength;

      if (itemEnd > data.length) {
        break;
      }

      const itemData = data.slice(offset + 4, itemEnd);
      offset = itemEnd;

      if (itemType === 0x20) {
        const pcId = itemData[0];
        const offeredTransferSyntaxes = [];
        let abstractSyntax = '';
        let innerOffset = 4;

        while (innerOffset + 4 <= itemData.length) {
          const subType = itemData[innerOffset];
          const subLength = itemData.readUInt16BE(innerOffset + 2);
          if (innerOffset + 4 + subLength > itemData.length) break;
          if (subType === 0x30 && subLength > 0) {
            // Abstract Syntax (SOP Class UID)
            abstractSyntax = itemData.slice(innerOffset + 4, innerOffset + 4 + subLength)
              .toString('ascii').replace(/\0/g, '').trim();
          } else if (subType === 0x40 && subLength > 0) {
            // Transfer Syntax
            const ts = itemData.slice(innerOffset + 4, innerOffset + 4 + subLength)
              .toString('ascii').replace(/\0/g, '').trim();
            offeredTransferSyntaxes.push(ts);
          }
          innerOffset += 4 + subLength;
        }

        // Pick best supported Transfer Syntax (prefer Explicit VR LE > Implicit VR LE > first offered)
        const preferredOrder = [
          '1.2.840.10008.1.2.1',  // Explicit VR Little Endian
          '1.2.840.10008.1.2',    // Implicit VR Little Endian
        ];
        let selectedTS = offeredTransferSyntaxes[0] || '1.2.840.10008.1.2.1';
        for (const preferred of preferredOrder) {
          if (offeredTransferSyntaxes.includes(preferred)) {
            selectedTS = preferred;
            break;
          }
        }

        acceptedPCs[pcId] = selectedTS;
        logger.debug(`PC ${pcId}: SOP=${abstractSyntax}, offered TS=[${offeredTransferSyntaxes.join(', ')}], accepted TS=${selectedTS}`);
      }
    }

    state.presentationContexts = acceptedPCs;
    socket.write(this.buildAssociateAC(calledAE, callingAE, acceptedPCs));
    logger.info(`Sent A-ASSOCIATE-AC with ${Object.keys(acceptedPCs).length} presentation context(s)`);
  }

  buildAssociateAC(calledAE, callingAE, acceptedPCs) {
    const parts = [];
    const appUID = Buffer.from('1.2.840.10008.3.1.1.1', 'ascii');
    const appItem = Buffer.alloc(4 + appUID.length);
    appItem[0] = 0x10;
    appItem.writeUInt16BE(appUID.length, 2);
    appUID.copy(appItem, 4);
    parts.push(appItem);

    for (const [pcId, transferSyntax] of Object.entries(acceptedPCs)) {
      const tsBytes = Buffer.from(transferSyntax, 'ascii');
      const tsItem = Buffer.alloc(4 + tsBytes.length);
      tsItem[0] = 0x40;
      tsItem.writeUInt16BE(tsBytes.length, 2);
      tsBytes.copy(tsItem, 4);

      const pcPayload = Buffer.concat([
        Buffer.from([parseInt(pcId, 10), 0x00, 0x00, 0x00]),
        tsItem
      ]);
      const pcItem = Buffer.alloc(4 + pcPayload.length);
      pcItem[0] = 0x21;
      pcItem.writeUInt16BE(pcPayload.length, 2);
      pcPayload.copy(pcItem, 4);
      parts.push(pcItem);
    }

    const maxLen = Buffer.alloc(8);
    maxLen[0] = 0x51;
    maxLen.writeUInt16BE(4, 2);
    maxLen.writeUInt32BE(65536, 4);
    const userItem = Buffer.alloc(4 + maxLen.length);
    userItem[0] = 0x50;
    userItem.writeUInt16BE(maxLen.length, 2);
    maxLen.copy(userItem, 4);
    parts.push(userItem);

    const variableItems = Buffer.concat(parts);
    const fixedHeader = Buffer.alloc(68);
    fixedHeader.writeUInt16BE(0x0001, 0);
    calledAE.copy(fixedHeader, 4);
    callingAE.copy(fixedHeader, 20);

    const body = Buffer.concat([fixedHeader, variableItems]);
    const pdu = Buffer.alloc(6 + body.length);
    pdu[0] = 0x02;
    pdu.writeUInt32BE(body.length, 2);
    body.copy(pdu, 6);
    return pdu;
  }

  handlePDataTF(socket, state, data, connectionId) {
    let offset = 0;

    while (offset + 6 <= data.length) {
      const pdvLength = data.readUInt32BE(offset);
      if (offset + 4 + pdvLength > data.length) {
        break;
      }

      const presentationContextId = data[offset + 4];
      const messageControlHeader = data[offset + 5];
      // Per DICOM PS3.8 9.3.5.1: bit 0 (0x01) = Command(1)/Data(0), bit 1 (0x02) = Last fragment
      const isCommand = (messageControlHeader & 0x01) !== 0;
      const isLast = (messageControlHeader & 0x02) !== 0;
      const payload = data.slice(offset + 6, offset + 4 + pdvLength);
      offset += 4 + pdvLength;

      if (isCommand) {
        if (!state.commandBuffers[presentationContextId]) {
          state.commandBuffers[presentationContextId] = [];
        }
        state.commandBuffers[presentationContextId].push(payload);

        if (isLast) {
          const commandBuffer = Buffer.concat(state.commandBuffers[presentationContextId]);
          state.commandBuffers[presentationContextId] = [];
          this.dispatchDimseCommand(socket, state, presentationContextId, commandBuffer, connectionId);
        }
      } else {
        if (!state.datasetBuffers[presentationContextId]) {
          state.datasetBuffers[presentationContextId] = [];
        }
        state.datasetBuffers[presentationContextId].push(payload);

        if (isLast && state.pendingCommand && state.pendingCommand.pcId === presentationContextId) {
          const datasetBuffer = Buffer.concat(state.datasetBuffers[presentationContextId]);
          state.datasetBuffers[presentationContextId] = [];
          this.handleCStoreDataset(socket, state, presentationContextId, datasetBuffer, connectionId);
        }
      }
    }
  }

  parseDimseCommand(data) {
    const command = {};
    let offset = 0;

    while (offset + 8 <= data.length) {
      const group = data.readUInt16LE(offset);
      const element = data.readUInt16LE(offset + 2);
      const length = data.readUInt32LE(offset + 4);

      // Skip elements with undefined length or invalid length
      if (length === 0xFFFFFFFF || offset + 8 + length > data.length) {
        break;
      }

      const value = data.slice(offset + 8, offset + 8 + length);
      offset += 8 + length;

      // Parse all group 0000 elements (command group), don't break on other groups
      if (group !== 0x0000) {
        continue;
      }

      switch (element) {
        case 0x0002:
          command.affectedSOPClassUID = value.toString('ascii').replace(/\0/g, '').trim();
          break;
        case 0x0100:
          if (value.length >= 2) command.commandField = value.readUInt16LE(0);
          break;
        case 0x0110:
          if (value.length >= 2) command.messageId = value.readUInt16LE(0);
          break;
        case 0x0120:
          if (value.length >= 2) command.messageIdBeingRespondedTo = value.readUInt16LE(0);
          break;
        case 0x0800:
          if (value.length >= 2) command.dataSetType = value.readUInt16LE(0);
          break;
        case 0x1000:
          command.affectedSOPInstanceUID = value.toString('ascii').replace(/\0/g, '').trim();
          break;
        case 0x1030:
          // MoveOriginatorApplicationEntityTitle - GE machines may send this
          command.moveOriginatorAET = value.toString('ascii').replace(/\0/g, '').trim();
          break;
        case 0x1031:
          // MoveOriginatorMessageID - GE machines may send this
          if (value.length >= 2) command.moveOriginatorMessageId = value.readUInt16LE(0);
          break;
      }
    }

    return command;
  }

  dispatchDimseCommand(socket, state, presentationContextId, commandBuffer, connectionId) {
    const command = this.parseDimseCommand(commandBuffer);
    logger.info(
      `DIMSE cmd=0x${(command.commandField || 0).toString(16).padStart(4, '0')} msgId=${command.messageId || '?'} SOP=${command.affectedSOPClassUID || '?'} instanceUID=${command.affectedSOPInstanceUID || 'N/A'} dataSetType=0x${(command.dataSetType || 0).toString(16)} PC=${presentationContextId} from=${connectionId}`
    );

    switch (command.commandField) {
      case 0x0030:
        this.sendCEchoRSP(socket, presentationContextId, command.messageId || 1, command.affectedSOPClassUID);
        break;
      case 0x0001:
        state.pendingCommand = {
          pcId: presentationContextId,
          messageId: command.messageId,
          sopClassUID: command.affectedSOPClassUID,
          sopInstanceUID: command.affectedSOPInstanceUID
        };
        if (command.dataSetType === 0x0101) {
          this.sendCStoreRSP(
            socket,
            presentationContextId,
            command.messageId,
            command.affectedSOPClassUID,
            command.affectedSOPInstanceUID
          );
          state.pendingCommand = null;
        }
        break;
      default:
        logger.warn(`Unhandled DIMSE command: 0x${(command.commandField || 0).toString(16)}`);
    }
  }

  encodeCmdElement(group, element, value) {
    const buffer = Buffer.alloc(8 + value.length);
    buffer.writeUInt16LE(group, 0);
    buffer.writeUInt16LE(element, 2);
    buffer.writeUInt32LE(value.length, 4);
    value.copy(buffer, 8);
    return buffer;
  }

  buildCommandDataset(elements) {
    const body = Buffer.concat(elements.map((element) => this.encodeCmdElement(element.g, element.e, element.v)));
    const groupLength = Buffer.alloc(4);
    groupLength.writeUInt32LE(body.length, 0);
    return Buffer.concat([this.encodeCmdElement(0x0000, 0x0000, groupLength), body]);
  }

  encUint16(value) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value, 0);
    return buffer;
  }

  encUID(uid) {
    const buffer = Buffer.from(uid || '', 'ascii');
    return buffer.length % 2 !== 0 ? Buffer.concat([buffer, Buffer.from([0x00])]) : buffer;
  }

  sendCEchoRSP(socket, presentationContextId, messageId, sopClassUID) {
    const commandDataset = this.buildCommandDataset([
      { g: 0x0000, e: 0x0002, v: this.encUID(sopClassUID || '1.2.840.10008.1.1') },
      { g: 0x0000, e: 0x0100, v: this.encUint16(0x8030) },
      { g: 0x0000, e: 0x0120, v: this.encUint16(messageId) },
      { g: 0x0000, e: 0x0800, v: this.encUint16(0x0101) },
      { g: 0x0000, e: 0x0900, v: this.encUint16(0x0000) }
    ]);

    this.sendPData(socket, presentationContextId, commandDataset, true);
    logger.info(`Sent C-ECHO-RSP success on PC ${presentationContextId}`);
  }

  async handleCStoreDataset(socket, state, presentationContextId, datasetBuffer, connectionId) {
    const pendingCommand = state.pendingCommand;
    state.pendingCommand = null;

    // Always send C-STORE-RSP success immediately (required by DICOM protocol)
    this.sendCStoreRSP(
      socket,
      presentationContextId,
      pendingCommand.messageId,
      pendingCommand.sopClassUID,
      pendingCommand.sopInstanceUID
    );

    // Check for duplicate SOP Instance UID (prevents retry loops from GE machines)
    const sopInstanceUID = pendingCommand.sopInstanceUID || '';
    const now = Date.now();

    // Clean up old entries (older than 5 minutes)
    for (const [uid, timestamp] of this.receivedInstances.entries()) {
      if (now - timestamp > 300000) {
        this.receivedInstances.delete(uid);
      }
    }

    if (sopInstanceUID && this.receivedInstances.has(sopInstanceUID)) {
      const firstReceived = this.receivedInstances.get(sopInstanceUID);
      const ageSeconds = Math.floor((now - firstReceived) / 1000);
      logger.warn(`Skipping duplicate SOP Instance (received ${ageSeconds}s ago): ${sopInstanceUID}`);
      return; // Don't process duplicate, but already sent success to prevent retry
    }

    // Mark this instance as received
    if (sopInstanceUID) {
      this.receivedInstances.set(sopInstanceUID, now);
    }

    const transferSyntaxUID = state.presentationContexts[presentationContextId] || '1.2.840.10008.1.2.1';

    // Process file asynchronously without blocking (fire-and-forget)
    // This ensures the C-STORE-RSP is fully sent before heavy processing begins
    setImmediate(() => {
      this.saveAndProcessDicom(datasetBuffer, connectionId, {
        sopClassUID: pendingCommand.sopClassUID,
        sopInstanceUID: pendingCommand.sopInstanceUID,
        transferSyntaxUID
      }).catch(error => {
        const errorMsg = error instanceof Error ? error.message : (error ? String(error) : 'Unknown error');
        logger.error(`Error saving C-STORE dataset: ${errorMsg}`);
      });
    });
  }

  sendCStoreRSP(socket, presentationContextId, messageId, sopClassUID, sopInstanceUID) {
    const commandDataset = this.buildCommandDataset([
      { g: 0x0000, e: 0x0002, v: this.encUID(sopClassUID || '1.2.840.10008.5.1.4.1.1.1') },
      { g: 0x0000, e: 0x0100, v: this.encUint16(0x8001) },
      { g: 0x0000, e: 0x0120, v: this.encUint16(messageId || 1) },
      { g: 0x0000, e: 0x0800, v: this.encUint16(0x0101) },
      { g: 0x0000, e: 0x0900, v: this.encUint16(0x0000) },
      { g: 0x0000, e: 0x1000, v: this.encUID(sopInstanceUID || this.generateUid()) }
    ]);

    this.sendPData(socket, presentationContextId, commandDataset, true);
    logger.info(`Sent C-STORE-RSP success on PC ${presentationContextId}`);
  }

  sendPData(socket, presentationContextId, data, isCommand) {
    const controlHeader = isCommand ? 0x03 : 0x02;
    const pdvItem = Buffer.alloc(6 + data.length);
    pdvItem.writeUInt32BE(2 + data.length, 0);
    pdvItem[4] = presentationContextId;
    pdvItem[5] = controlHeader;
    data.copy(pdvItem, 6);

    const pdu = Buffer.alloc(6 + pdvItem.length);
    pdu[0] = 0x04;
    pdu.writeUInt32BE(pdvItem.length, 2);
    pdvItem.copy(pdu, 6);
    socket.write(pdu);
  }

  handleReleaseRQ(socket) {
    const pdu = Buffer.alloc(10);
    pdu[0] = 0x06;
    pdu.writeUInt32BE(4, 2);
    socket.write(pdu);
    logger.info('Sent A-RELEASE-RP');
  }

  startFileWatcher() {
    this.watcherInterval = setInterval(async () => {
      try {
        const files = await fs.readdir(config.dicom.storagePath);
        for (const filename of files) {
          if (filename.startsWith('.')) {
            continue;
          }

          const filePath = path.resolve(path.join(config.dicom.storagePath, filename));

          // Skip if we already processed this file path
          if (this.processedFiles.has(filePath)) {
            continue;
          }

          let stats;
          try {
            stats = await fs.stat(filePath);
          } catch (err) {
            // File may have been renamed/deleted between readdir and stat
            continue;
          }

          if (!stats.isFile()) {
            continue;
          }

          // Wait for file to finish writing (size stable check)
          const first = stats.size;
          await new Promise((resolve) => setTimeout(resolve, 500));

          let second;
          try {
            second = (await fs.stat(filePath)).size;
          } catch (err) {
            // File disappeared during wait
            continue;
          }

          if (first > 0 && first === second) {
            // Mark as processed BEFORE processing to prevent race with next watcher tick
            this.processedFiles.add(filePath);

            try {
              const normalizedPath = await this.ensureDcmExtension(filePath);
              // Also track the renamed path
              if (normalizedPath !== filePath) {
                this.processedFiles.add(normalizedPath);
              }
              await this.processReceivedFile(normalizedPath);
            } catch (err) {
              logger.error(`Error processing watched file ${filename}: ${err.message}`);
              // Remove from processed set so it can be retried next cycle
              this.processedFiles.delete(filePath);
            }
          }
        }
      } catch (error) {
        this.emit('error', error);
      }
    }, 2000);
  }

  buildDicomPart10Header(sopClassUID, sopInstanceUID, transferSyntaxUID) {
    const preamble = Buffer.alloc(128, 0);
    const prefix = Buffer.from('DICM', 'ascii');

    const encUID = (uid) => {
      const buf = Buffer.from(uid || '', 'ascii');
      return buf.length % 2 !== 0 ? Buffer.concat([buf, Buffer.from([0x00])]) : buf;
    };

    const encSH = (str) => {
      const buf = Buffer.from(str || '', 'ascii');
      return buf.length % 2 !== 0 ? Buffer.concat([buf, Buffer.from([0x20])]) : buf;
    };

    const makeExplicitEl = (elementId, vr, valueBuffer) => {
      const header = Buffer.alloc(8);
      header.writeUInt16LE(0x0002, 0);
      header.writeUInt16LE(elementId, 2);
      header.write(vr, 4, 2, 'ascii');

      if (['OB', 'OW', 'OF', 'UT', 'SQ', 'UN'].includes(vr)) {
        const extendedHeader = Buffer.alloc(12);
        extendedHeader.writeUInt16LE(0x0002, 0);
        extendedHeader.writeUInt16LE(elementId, 2);
        extendedHeader.write(vr, 4, 2, 'ascii');
        extendedHeader.writeUInt16BE(0, 6);
        extendedHeader.writeUInt32LE(valueBuffer.length, 8);
        return Buffer.concat([extendedHeader, valueBuffer]);
      } else {
        header.writeUInt16LE(valueBuffer.length, 6);
        return Buffer.concat([header, valueBuffer]);
      }
    };

    const elements = [];
    // File Meta Information Version
    elements.push(makeExplicitEl(0x0001, 'OB', Buffer.from([0x00, 0x01])));
    // Media Storage SOP Class UID
    elements.push(makeExplicitEl(0x0002, 'UI', encUID(sopClassUID)));
    // Media Storage SOP Instance UID
    elements.push(makeExplicitEl(0x0003, 'UI', encUID(sopInstanceUID)));
    // Transfer Syntax UID
    elements.push(makeExplicitEl(0x0010, 'UI', encUID(transferSyntaxUID)));
    // Implementation Class UID
    elements.push(makeExplicitEl(0x0012, 'UI', encUID('1.2.276.0.7230010.3.0.3.6.4')));
    // Implementation Version Name
    elements.push(makeExplicitEl(0x0013, 'SH', encSH('ASSIST_ROUTER')));

    const metaBytesWithoutLength = Buffer.concat(elements);

    // File Meta Information Group Length
    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32LE(metaBytesWithoutLength.length, 0);
    const groupLengthEl = makeExplicitEl(0x0000, 'UL', lengthBuf);

    const metaHeader = Buffer.concat([groupLengthEl, metaBytesWithoutLength]);
    return Buffer.concat([preamble, prefix, metaHeader]);
  }

  async saveAndProcessDicom(buffer, source, metadata = {}) {
    const filename = `dcm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.dcm`;
    const filePath = path.resolve(path.join(config.dicom.storagePath, filename));

    let finalBuffer = buffer;
    if (metadata.sopClassUID && metadata.sopInstanceUID) {
      const header = this.buildDicomPart10Header(
        metadata.sopClassUID,
        metadata.sopInstanceUID,
        metadata.transferSyntaxUID || '1.2.840.10008.1.2.1'
      );
      finalBuffer = Buffer.concat([header, buffer]);
    }

    await fs.writeFile(filePath, finalBuffer);
    logger.info(`DICOM file saved: ${filename} (${finalBuffer.length} bytes) from ${source || 'socket'}`);
    
    await this.processReceivedFile(filePath);
  }

  async processReceivedFile(filePath) {
    const normalizedPath = await this.ensureDcmExtension(filePath);
    const filename = path.basename(normalizedPath);

    const fileBuffer = await fs.readFile(normalizedPath);
    const dataSet = dicomParser.parseDicom(fileBuffer);
    const sopInstanceUid = this.getStringValue(dataSet, 'x00080018') || this.generateUid();
    const studyInstanceUid = this.getStringValue(dataSet, 'x0020000d') || this.generateUid();

    const existingTransfer = TransferModel.getBySopInstanceUid(sopInstanceUid);
    if (existingTransfer && (existingTransfer.status === 'pending' || existingTransfer.status === 'sent')) {
      logger.warn(`Duplicate SOP Instance skipped: ${sopInstanceUid} (transfer ${existingTransfer.id}, status=${existingTransfer.status})`);
      return;
    }

    const sopInstanceUID = this.getStringValue(dataSet, 'x00080018');

    // Deduplicate by SOP Instance UID (prevents storescp retry from creating duplicate transfers)
    if (sopInstanceUID) {
      const now = Date.now();
      // Clean up old entries (older than 10 minutes)
      for (const [uid, timestamp] of this.receivedInstances.entries()) {
        if (now - timestamp > 600000) {
          this.receivedInstances.delete(uid);
        }
      }
      if (this.receivedInstances.has(sopInstanceUID)) {
        const ageSeconds = Math.floor((now - this.receivedInstances.get(sopInstanceUID)) / 1000);
        logger.warn(`Skipping duplicate SOP Instance UID ${sopInstanceUID} (first seen ${ageSeconds}s ago): ${filename}`);
        // Remove the duplicate file to keep folder clean
        try { await fs.remove(normalizedPath); } catch (e) { /* ignore */ }
        return;
      }
      this.receivedInstances.set(sopInstanceUID, now);
    }

    const metadata = {
      patientId: this.getStringValue(dataSet, 'x00100020') || 'UNKNOWN',
      patientName: this.getStringValue(dataSet, 'x00100010') || 'UNKNOWN',
      studyDate: this.getStringValue(dataSet, 'x00080020') || '',
      modality: this.getStringValue(dataSet, 'x00080060') || 'OT',
      studyInstanceUid,
      sopInstanceUid,
      filePath: normalizedPath,
      fileSize: fileBuffer.length,
      status: 'pending'
    };

    const transferId = TransferModel.create(metadata);

    logger.info(`DICOM received, queued transfer ${transferId}`, {
      patientId: metadata.patientId,
      modality: metadata.modality,
      sopInstanceUID: sopInstanceUID || 'unknown',
      filePath: normalizedPath
    });

    this.emit('file-received', {
      transferId,
      patientId: metadata.patientId,
      modality: metadata.modality,
      fileSize: metadata.fileSize
    });
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

  getStringValue(dataSet, tag) {
    try {
      const value = dataSet.string(tag);
      return value ? value.trim() : '';
    } catch (error) {
      return '';
    }
  }

  generateUid() {
    return `1.2.840.99999.${Date.now()}.${Math.floor(Math.random() * 1000000)}`;
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.watcherInterval) {
      clearInterval(this.watcherInterval);
      this.watcherInterval = null;
    }

    if (this.storescpProcess) {
      this.storescpProcess.kill();
      this.storescpProcess = null;
    }

    if (this.server) {
      for (const socket of this.connections.values()) {
        socket.destroy();
      }
      this.connections.clear();
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }

    // Clear duplicate detection cache
    this.receivedInstances.clear();
    this.processedFiles.clear();

    this.isRunning = false;
    this.emit('stopped');
  }

  getStatus() {
    return {
      running: this.isRunning,
      method: this.useStorescp ? 'storescp' : 'built-in',
      port: config.dicom.port,
      aet: config.dicom.aet,
      activeConnections: this.connections.size
    };
  }
}

module.exports = new DicomListener();
