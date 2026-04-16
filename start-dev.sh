#!/bin/zsh
# DICOM Router - Start Script (Node 12 for Windows 7 compatibility)
# This script runs the server using x86_64 architecture on ARM Mac

echo "Starting DICOM Router with Node.js 12..."
arch -x86_64 zsh -c "source ~/.nvm/nvm.sh && nvm use 12 && cd /Users/mac/Documents/PROJECT/assist-dicom && npm start"
