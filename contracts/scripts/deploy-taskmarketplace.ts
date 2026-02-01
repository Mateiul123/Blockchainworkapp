import hre from "hardhat";
import fs from "fs";

async function main() {
  console.log("Deploying TaskMarketplace with TaskLibrary...");

  const { ethers } = await hre.network.connect();
  
  // Step 1: Deploy TaskLibrary first
  console.log("1️⃣ Deploying TaskLibrary...");
  const TaskLibrary = await ethers.getContractFactory("TaskLibrary");
  const taskLibrary = await TaskLibrary.deploy();
  await taskLibrary.waitForDeployment();
  const libraryAddress = await taskLibrary.getAddress();
  console.log(`✅ TaskLibrary deployed to: ${libraryAddress}`);

  // Step 2: Deploy TaskMarketplace with library linked
  console.log("\n2️⃣ Deploying TaskMarketplace...");
  const TaskMarketplace = await ethers.getContractFactory("TaskMarketplace", {
    libraries: {
      TaskLibrary: libraryAddress,
    },
  });
  const taskMarketplace = await TaskMarketplace.deploy();
  await taskMarketplace.waitForDeployment();
  const marketplaceAddress = await taskMarketplace.getAddress();
  console.log(`✅ TaskMarketplace deployed to: ${marketplaceAddress}`);

  // Save deployment info
  const deploymentInfo = {
    taskMarketplace: marketplaceAddress,
    taskLibrary: libraryAddress,
    network: (await ethers.provider.getNetwork()).name,
    deployer: (await ethers.getSigners())[0].address,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📝 Deployment info saved to deployed-addresses.json");
  console.log("\n🎉 Deployment complete!");
  console.log(`\n📋 Summary:`);
  console.log(`   TaskLibrary:     ${libraryAddress}`);
  console.log(`   TaskMarketplace: ${marketplaceAddress}`);
  console.log(`\n🔗 Update your frontend with this address:`);
  console.log(`   ${marketplaceAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
