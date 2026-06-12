#!/bin/bash
# Quick dev start — compile contracts, then run frontend
set -e
echo "==> Compiling contracts..."
cd "$(dirname "$0")/../contracts"
npm install --quiet
npx hardhat compile
echo "==> Starting frontend..."
cd ../frontend
npm install --quiet
npm run dev
