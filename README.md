# DICOM Router - SatuSehat Integration
### Powered by Assist.id 🏥

A Node.js-based DICOM router that receives DICOM files from Fuji FCR machines and forwards them to the SatuSehat API (api-dicom-router.assist.id). Designed for **Windows 7 compatibility**.

![Node.js](https://img.shields.io/badge/node.js-12.22.12-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Assist.id](https://img.shields.io/badge/Powered%20by-Assist.id-00D9FF)

---

## About Assist.id

**Assist.id** is Indonesia's leading healthcare technology company, trusted by **6,000+ healthcare facilities** across Indonesia. We provide comprehensive Electronic Medical Record (EMR/RME) systems and clinic management solutions.

- 🏆 **#1 Healthcare System in Indonesia**
- ✅ **ISO 27001 Certified** - International data security standards
- ✅ **PSE Kemkomdigi Registered** - Officially registered with Indonesian government
- 🏥 **6,000+ Healthcare Facilities** - Serving clinics, hospitals, and health centers
- 🌐 **Website**: [https://assist.id](https://assist.id)
- 📞 **Contact**: info@assist.id | 082112222500

---

## Features

✅ **DICOM SCP Listener** - Receives DICOM files from Fuji FCR on configurable port  
✅ **API Forwarding** - Automatically sends files to SatuSehat API  
✅ **Web Dashboard** - Real-time monitoring and validation  
✅ **Connection Validation** - Test DICOM and API connections  
✅ **File Logging** - Complete transfer history with status tracking  
✅ **Retry Mechanism** - Automatic retry for failed transfers  
✅ **Authentication Support** - Bearer token or API key authentication  
✅ **Windows 7 Compatible** - Uses Node.js v12 and pure JavaScript libraries  

## Screenshots

### Dashboard
- Real-time status monitoring
- Transfer logs with patient information
- System events tracking
- Connection validation tools

## Requirements

### System Requirements
- **OS**: Windows 7 SP1 or later
- **RAM**: 2GB minimum, 4GB recommended
- **Disk Space**: 10GB for DICOM file storage
- **Network**: Stable internet connection

### Software Requirements
- **Node.js**: v12.22.12 (download from nodejs.org)
- **Visual C++ Redistributable**: For native module compilation

## Installation

### 1. Install Node.js

Download and install Node.js v12.22.12:
- 64-bit: https://nodejs.org/download/release/v12.22.12/node-v12.22.12-x64.msi
- 32-bit: https://nodejs.org/download/release/v12.22.12/node-v12.22.12-x86.msi

Verify installation:
```cmd
node --version
# Should show: v12.22.12

npm --version
# Should show: 6.14.16
```

### 2. Install Visual C++ Redistributable

Download and install: https://aka.ms/vs/16/release/vc_redist.x64.exe

### 3. Install Project Dependencies

```cmd
cd C:\path\to\assist-dicom
npm install
```

**If native module compilation fails:**
```cmd
npm install --build-from-source better-sqlite3@7.6.2
```

### 4. Configure Environment

Copy the example environment file:
```cmd
copy .env.example .env
```

Edit `.env` with your settings:
```env
# DICOM Configuration
DICOM_PORT=11112
DICOM_AET=ASSIST_DICOM
FUJI_AET=FUJI_FCR

# API Configuration
# For localhost testing:
API_URL=http://localhost:5000/api/receive
HOSPITAL_ID=TEST_HOSPITAL
API_KEY=test-key-123

# For production:
# API_URL=https://api-dicom-router.assist.id/api/receive
# HOSPITAL_ID=your-hospital-id
# API_KEY=your-api-key

# Server Configuration
WEB_PORT=3000
```

**Important**: You must obtain valid `HOSPITAL_ID` and `API_KEY` credentials from the API server administrator. The router uses token-based authentication where:
1. Credentials are validated with the API server
2. A one-time token is obtained for each file transfer
3. Files are uploaded using the token (expires in 5 minutes)

See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for detailed authentication flow documentation.

### 5. Configure Windows Firewall

Run Command Prompt as Administrator:

```cmd
# Allow DICOM port
netsh advfirewall firewall add rule name="DICOM Router" dir=in action=allow protocol=TCP localport=11112

# Allow web dashboard port
netsh advfirewall firewall add rule name="DICOM Web UI" dir=in action=allow protocol=TCP localport=3000
```

## Usage

### Start the Application

```cmd
npm start
```

The application will:
1. Start the web server on port 3000
2. Start the DICOM listener on port 11112
3. Start the API forwarder service

### Access the Dashboard

Open your browser:
```
http://localhost:3000
```

Or from another computer on the network:
```
http://YOUR_PC_IP:3000
```

### Configure Fuji FCR Machine

On your Fuji FCR machine, configure DICOM export:

- **Destination AE Title**: `ASSIST_DICOM` (or value from .env)
- **Destination IP**: Your Windows 7 PC IP address
- **Destination Port**: `11112` (or value from .env)
- **Calling AE Title**: `FUJI_FCR` (or value from .env)

### Test the Connection

1. Open the dashboard
2. Go to the **Validation** tab
3. Click **Test DICOM Listener** to verify listener is running
4. Click **Test API Connection** to verify API connectivity
5. Click **Test Authentication** to verify credentials

## Dashboard Features

### Status Cards
- **DICOM Listener**: Shows listener status, port, and active connections
- **API Connection**: Shows API status and authentication
- **Files (24h)**: Statistics for received and sent files
- **Queue Status**: Pending and failed transfers

### Tabs

#### 1. Transfer Logs
View all transferred files with:
- Patient ID and Name
- Study Date and Modality
- File size
- Transfer status (pending/sent/failed)
- Retry count

#### 2. System Events
Real-time log of:
- DICOM connections
- File received events
- API transfer events
- Errors and warnings

#### 3. Validation
Test tools for:
- DICOM listener connectivity
- API endpoint connectivity
- Authentication validation

## API Endpoints

### Status Endpoints
- `GET /api/status` - Overall system status
- `GET /api/transfers` - Transfer logs
- `GET /api/events` - System events
- `GET /api/stats` - Statistics

### Validation Endpoints
- `POST /api/validate/dicom` - Test DICOM listener
- `POST /api/validate/api` - Test API connection
- `POST /api/validate/auth` - Validate authentication

### Control Endpoints
- `POST /api/dicom/start` - Start DICOM listener
- `POST /api/dicom/stop` - Stop DICOM listener
- `POST /api/forwarder/start` - Start API forwarder
- `POST /api/forwarder/stop` - Stop API forwarder

## Architecture

```
┌─────────────────┐
│   Fuji FCR      │
│   Machine       │
└────────┬────────┘
         │ DICOM C-STORE
         │ Port 11112
         ▼
┌─────────────────────────────────┐
│  DICOM Router (Windows 7 PC)    │
│                                 │
│  ┌──────────────────────────┐  │
│  │  DICOM SCP Listener      │  │
│  │  (TCP Server)            │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  File Storage            │  │
│  │  SQLite Database         │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  API Forwarder           │  │
│  │  (Retry + Queue)         │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  Web Dashboard           │  │
│  │  (Port 3000)             │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
         │ HTTPS POST
         │ with Auth
         ▼
┌─────────────────┐
│  SatuSehat API  │
│  api-dicom      │
│  -router        │
│  .assist.id     │
└─────────────────┘
```

## Troubleshooting

### DICOM Listener Won't Start

**Error**: Port already in use

**Solution**: Change `DICOM_PORT` in `.env` or stop other services using port 11112

---

**Error**: Permission denied

**Solution**: Run Command Prompt as Administrator or configure firewall

### Fuji FCR Cannot Connect

**Checklist**:
1. ✓ Firewall allows port 11112
2. ✓ DICOM listener is running (check dashboard)
3. ✓ DICOM_AET matches Fuji configuration
4. ✓ Windows 7 PC IP address is correct
5. ✓ Network connectivity between machines

### API Transfer Fails

**Error**: Connection refused / Timeout

**Solution**:
1. Check internet connection
2. Verify `API_URL` in `.env`
3. Test API connection in dashboard
4. Check if Windows 7 has TLS 1.2 enabled (install KB3140245)

---

**Error**: Authentication failed (401/403)

**Solution**:
1. Verify `API_KEY` or `API_BEARER_TOKEN` in `.env`
2. Contact SatuSehat for valid credentials
3. Test authentication in dashboard

### Native Module Build Errors

**Error**: Cannot find module 'better-sqlite3'

**Solution**:
```cmd
npm install --global windows-build-tools@4.0.0
npm rebuild better-sqlite3 --build-from-source
```

### SSL/TLS Errors

**Error**: SSL handshake failed

**Solution**: Update Windows 7 to support TLS 1.2
1. Install update KB3140245
2. Download: https://support.microsoft.com/topic/update-to-enable-tls-1-1-and-tls-1-2

## Development

### Run in Development Mode

```cmd
npm run dev
```

Uses nodemon for auto-restart on file changes.

### Database Management

Initialize/reset database:
```cmd
npm run init-db
```

Database location: `storage/logs.db`

### Testing

Test DICOM connection:
```cmd
npm run test-dicom
```

Test API connection:
```cmd
npm run test-api
```

## File Structure

```
assist-dicom/
├── backend/
│   ├── config/
│   │   └── default.js          # Configuration
│   ├── services/
│   │   ├── dicom-listener.js   # DICOM SCP listener
│   │   ├── api-forwarder.js    # API forwarding service
│   │   └── logger.js           # Logging service
│   ├── database/
│   │   ├── init.js             # Database setup
│   │   └── models.js           # Data models
│   ├── routes/
│   │   ├── status.js           # Status API routes
│   │   └── validation.js       # Validation routes
│   └── server.js               # Main server
├── frontend/
│   ├── index.html              # Dashboard UI
│   ├── css/
│   │   └── style.css           # Styles
│   └── js/
│       ├── app.js              # Main app logic
│       └── socket-handler.js   # WebSocket handling
├── storage/
│   ├── dicom/                  # DICOM file storage
│   └── logs/                   # Application logs
├── .env                        # Configuration (create from .env.example)
├── package.json
└── README.md
```

## Security Notes

⚠️ **Important**: Windows 7 reached end-of-life in January 2020

- No security updates from Microsoft
- Use on isolated/trusted network if possible
- Keep antivirus software updated
- Restrict network access to trusted sources
- Consider upgrading to Windows 10/11 for production use

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review application logs in `storage/logs/`
3. Check system events in the dashboard
4. Contact SatuSehat support for API-related issues

## Changelog

### Version 1.0.0 (2026-04-14)
- Initial release
- DICOM SCP listener
- API forwarding with retry
- Web dashboard with real-time updates
- Windows 7 compatibility
- SQLite logging
- Connection validation tools

---

## Credits & Copyright

**Developed by Assist.id**  
**PT. Jaga Anugrah Giat Asa**

This DICOM Router application is proudly developed and maintained by **Assist.id**, Indonesia's premier healthcare technology company.

### About Assist.id

Assist.id provides comprehensive healthcare management solutions trusted by over 6,000 healthcare facilities across Indonesia. Our products include:

- **Privata** - Practice management for independent doctors
- **Clinica** - Clinic management system
- **Hospita** - Hospital information system (SIMRS)
- **Aesta** - Beauty clinic management
- **Veta** - Veterinary clinic system
- **Denta** - Dental clinic management
- **Pusada** - Puskesmas (community health center) system

### Certifications & Compliance

- ✅ **ISO 27001 Certified** - International data security standards
- ✅ **PSE Kemkomdigi Registered** - Indonesian government certified
- ✅ **BPJS Integration** - Seamless insurance integration
- ✅ **SatuSehat Champion** - Leading national health data integration

### Contact Assist.id

- 🌐 **Website**: [https://assist.id](https://assist.id)
- 📧 **Email**: info@assist.id
- 📞 **Phone**: 082112222500
- 🏢 **Head Office**: Jl. Palaraya No.325, Pekanbaru, Riau 28294
- 🏢 **Jakarta Office**: Ariobimo Sentral Level 8, Jakarta Selatan 12950
- 🏢 **Bandung Office**: Jl. Ir. H. Juanda No.108, Bandung 40132

### Why Choose Assist.id?

1. **Proven Track Record** - 6,000+ healthcare facilities trust us
2. **Complete Ecosystem** - From EMR to business intelligence
3. **Regulatory Compliance** - Government certified and compliant
4. **Local Expertise** - Deep understanding of Indonesian healthcare
5. **Continuous Innovation** - Regular updates and new features
6. **24/7 Support** - Dedicated support team

---

© 2026 Assist.id - PT. Jaga Anugrah Giat Asa. All Rights Reserved.

*Trusted by healthcare facilities across Indonesia | Building the future of digital healthcare*
