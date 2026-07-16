import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    celo: {
      url: process.env.CELO_RPC_URL ?? "https://forno.celo.org",
      chainId: 42220,
      accounts: [PRIVATE_KEY],
      gasPrice: 250_000_000_000,  // 250 Gwei — current Celo mainnet base fee
    },
  },
  etherscan: {
    apiKey: process.env.CELOSCAN_API_KEY ?? "",
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io",
        },
      },
    ],
  },
};

export default config;
