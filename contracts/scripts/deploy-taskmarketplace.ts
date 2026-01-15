import hre from "hardhat";
import fs from "fs";

async function main() {
  console.log("Deploying TaskMarketplace...");

  const { ethers } = await hre.network.connect();
  
  const TaskMarketplace = await ethers.getContractFactory("TaskMarketplace");
  const taskMarketplace = await TaskMarketplace.deploy();

  await taskMarketplace.waitForDeployment();

  const address = await taskMarketplace.getAddress();
  console.log(`TaskMarketplace deployed to: ${address}`);

  // Save deployment info
  const deploymentInfo = {
    address: address,
    network: (await ethers.provider.getNetwork()).name,
    deployer: (await ethers.getSigners())[0].address,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
