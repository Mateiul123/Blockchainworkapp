import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TaskMarketplaceModule = buildModule("TaskMarketplaceModule", (m) => {
  const taskMarketplace = m.contract("TaskMarketplace");

  return { taskMarketplace };
});

export default TaskMarketplaceModule;
