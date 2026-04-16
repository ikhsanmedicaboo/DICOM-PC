# assist-dicom-lite

Lightweight DICOM router for two functions only:
- Listen for incoming DICOM files (port + AET)
- Forward received files to the configured API endpoint

No frontend app, no dashboard, no upload UI, and no extra HTTP routes.

## Features

- DICOM receiver with two modes:
  - Uses `storescp` (DCMTK) when available
  - Falls back to built-in TCP receiver when not available
- JSON queue store for transfer tracking (no native DB dependency)
- Automatic retry for retryable API errors
- Local file cleanup after sent/failed transfer

## Requirements

- Node.js 12.22+ (recommended 16+)
- npm
- Optional: DCMTK `storescp` in PATH

## Setup

1. Copy `.env.example` to `.env`
2. Fill `API_KEY` and `HOSPITAL_ID`
3. Install dependencies:

```bash
npm install
```

4. Start service:

```bash
npm start
```

## Environment

- `API_URL`: base API URL
- `API_KEY`: API key for authentication
- `HOSPITAL_ID`: hospital ID for authentication
- `DICOM_PORT`: listener port
- `DICOM_AET`: listener AE title
- `DICOM_STORAGE_PATH`: folder for incoming DICOM files
- `DB_PATH`: JSON queue store path
- `LOG_FILE`: log file path
- `MAX_RETRIES`: max retries per transfer
- `CONCURRENT_UPLOADS`: max parallel forwards

## Storage

- Incoming files: `storage/dicom`
- Queue store: `storage/lite-store.json`
- Logs: `storage/logs/app.log`

## Build EXE (Windows 7 target)

```bash
npm run build:win7
```

Output:
- `dist/DICOM-Router-Lite-Win7.exe`
