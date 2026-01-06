// Simple deploy script for Counter that also copies ABI and addresses to frontend
// Usage: npx hardhat run scripts/deploy.ts --network localhost

import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const { ethers } = await network.connect();

const filename = fileURLToPath(import.meta.url);
const dir = dirname(filename);

async function copyArtifactsToFrontend() {
  const hardhatDir = path.join(dir, "..");
  const frontendDir = path.join(hardhatDir, "../src/contracts");

  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  const artifactsPath = path.join(hardhatDir, "artifacts/contracts");

  fs.copyFileSync(
    path.join(artifactsPath, "Counter.sol/Counter.json"),
    path.join(frontendDir, "Counter.json"),
  );

  fs.copyFileSync(
    path.join(hardhatDir, "deployed-addresses.json"),
    path.join(frontendDir, "addresses.json"),
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Counter with account:", deployer.address);

  const Counter = await ethers.getContractFactory("Counter");
  const counter = await Counter.deploy();
  await counter.waitForDeployment();

  const counterAddress = await counter.getAddress();
  console.log("Counter deployed to:", counterAddress);

  const addresses = {
    counter: counterAddress,
    deployer: deployer.address,
  };

  fs.writeFileSync(
    path.join(dir, "../deployed-addresses.json"),
    JSON.stringify(addresses, null, 2),
  );

  await copyArtifactsToFrontend();
  console.log("Deployment complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
