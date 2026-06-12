#!/bin/bash
# Verify Padi contract on Celoscan after deployment
# Usage: PADI_ADDRESS=0x... bash scripts/verify.sh
set -e
if [ -z "$PADI_ADDRESS" ]; then
  echo "Usage: PADI_ADDRESS=0x... bash scripts/verify.sh"
  exit 1
fi
USDM="0x765DE816845861e75A25fCA122bb6898B8B1282a"
cd contracts
npx hardhat verify --network celo "$PADI_ADDRESS" "$USDM"
