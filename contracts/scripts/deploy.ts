import { ethers } from "hardhat";

const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a"; // Celo mainnet

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const Padi = await ethers.getContractFactory("Padi");
  const contract = await Padi.deploy(USDM_ADDRESS);
  await contract.waitForDeployment();
  console.log("Padi deployed to:", await contract.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
