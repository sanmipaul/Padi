import { ethers } from "hardhat";

const USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Padi with account:", deployer.address);

  const Padi = await ethers.getContractFactory("Padi");
  const padi = await Padi.deploy(USDM_ADDRESS);
  await padi.waitForDeployment();

  const address = await padi.getAddress();
  console.log("Padi deployed to:", address);
  console.log("Update PADI_ADDRESS in frontend/lib/contracts.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
