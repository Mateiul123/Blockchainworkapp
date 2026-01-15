import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("TaskMarketplace", function () {
  let taskMarketplace: any;
  let owner: any;
  let creator: any;
  let worker: any;
  let user: any;

  const TASK_REWARD = ethers.parseEther("0.1");
  const TASK_TITLE = "Build a website";
  const TASK_DESCRIPTION = "Create a responsive website with React";
  
  beforeEach(async function () {
    [owner, creator, worker, user] = await ethers.getSigners();
    
    taskMarketplace = await ethers.deployContract("TaskMarketplace");
    await taskMarketplace.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await taskMarketplace.owner()).to.equal(owner.address);
    });

    it("Should have zero tasks initially", async function () {
      expect(await taskMarketplace.getTotalTasks()).to.equal(0);
    });

    it("Should have correct platform fee percentage", async function () {
      expect(await taskMarketplace.getPlatformFeePercentage()).to.equal(2);
    });
  });

  describe("Task Creation", function () {
    it("Should create a task with ETH reward", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
      
      await expect(
        taskMarketplace.connect(creator).createTask(
          TASK_TITLE,
          TASK_DESCRIPTION,
          deadline,
          { value: TASK_REWARD }
        )
      ).to.emit(taskMarketplace, "TaskCreated")
        .withArgs(1, creator.address, TASK_REWARD, deadline);

      const task = await taskMarketplace.getTask(1);
      expect(task.creator).to.equal(creator.address);
      expect(task.title).to.equal(TASK_TITLE);
      expect(task.reward).to.equal(TASK_REWARD);
    });

    it("Should reject task with empty title", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await expect(
        taskMarketplace.connect(creator).createTask(
          "",
          TASK_DESCRIPTION,
          deadline,
          { value: TASK_REWARD }
        )
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("Should reject task with zero reward", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await expect(
        taskMarketplace.connect(creator).createTask(
          TASK_TITLE,
          TASK_DESCRIPTION,
          deadline,
          { value: 0 }
        )
      ).to.be.revertedWith("Reward must be greater than 0");
    });

    it("Should reject task with past deadline", async function () {
      const pastDeadline = Math.floor(Date.now() / 1000) - 86400;
      
      await expect(
        taskMarketplace.connect(creator).createTask(
          TASK_TITLE,
          TASK_DESCRIPTION,
          pastDeadline,
          { value: TASK_REWARD }
        )
      ).to.be.revertedWith("Deadline must be in the future");
    });

    it("Should increment task counter", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await taskMarketplace.connect(creator).createTask(
        TASK_TITLE,
        TASK_DESCRIPTION,
        deadline,
        { value: TASK_REWARD }
      );

      expect(await taskMarketplace.getTotalTasks()).to.equal(1);
    });
  });

  describe("Taking Tasks", function () {
    let taskId: number;
    let deadline: number;

    beforeEach(async function () {
      deadline = Math.floor(Date.now() / 1000) + 86400;
      await taskMarketplace.connect(creator).createTask(
        TASK_TITLE,
        TASK_DESCRIPTION,
        deadline,
        { value: TASK_REWARD }
      );
      taskId = 1;
    });

    it("Should allow a worker to take an open task", async function () {
      await expect(
        taskMarketplace.connect(worker).takeTask(taskId)
      ).to.emit(taskMarketplace, "TaskTaken")
        .withArgs(taskId, worker.address);

      const task = await taskMarketplace.getTask(taskId);
      expect(task.worker).to.equal(worker.address);
      expect(task.status).to.equal(1); // InProgress
    });

    it("Should not allow creator to take their own task", async function () {
      await expect(
        taskMarketplace.connect(creator).takeTask(taskId)
      ).to.be.revertedWith("Creator cannot take own task");
    });

    it("Should not allow taking an already taken task", async function () {
      await taskMarketplace.connect(worker).takeTask(taskId);
      
      await expect(
        taskMarketplace.connect(user).takeTask(taskId)
      ).to.be.revertedWith("Task is not open");
    });

    it("Should not allow taking non-existent task", async function () {
      await expect(
        taskMarketplace.connect(worker).takeTask(999)
      ).to.be.revertedWith("Task does not exist");
    });
  });

  describe("Completing Tasks", function () {
    let taskId: number;

    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await taskMarketplace.connect(creator).createTask(
        TASK_TITLE,
        TASK_DESCRIPTION,
        deadline,
        { value: TASK_REWARD }
      );
      taskId = 1;
      await taskMarketplace.connect(worker).takeTask(taskId);
    });

    it("Should allow creator to complete task and transfer reward", async function () {
      const workerBalanceBefore = await taskMarketplace.getBalance(worker.address);
      
      // Worker submits work
      await expect(
        taskMarketplace.connect(worker).submitWork(taskId)
      ).to.emit(taskMarketplace, "WorkSubmitted");
      
      let task = await taskMarketplace.getTask(taskId);
      expect(task.status).to.equal(2); // PendingApproval
      
      // Creator approves work
      await expect(
        taskMarketplace.connect(creator).approveWork(taskId)
      ).to.emit(taskMarketplace, "TaskApproved");

      const workerBalanceAfter = await taskMarketplace.getBalance(worker.address);
      task = await taskMarketplace.getTask(taskId);
      
      expect(task.status).to.equal(3); // Completed
      expect(workerBalanceAfter).to.be.gt(workerBalanceBefore);
    });

    it("Should calculate correct platform fee (2%)", async function () {
      const platformFeeBalanceBefore = await taskMarketplace.platformFeeBalance();
      
      await taskMarketplace.connect(worker).submitWork(taskId);
      await taskMarketplace.connect(creator).approveWork(taskId);
      
      const platformFeeBalanceAfter = await taskMarketplace.platformFeeBalance();
      const expectedFee = TASK_REWARD * BigInt(2) / BigInt(100);
      
      expect(platformFeeBalanceAfter - platformFeeBalanceBefore).to.equal(expectedFee);
    });

    it("Should not allow non-creator to complete task", async function () {
      await taskMarketplace.connect(worker).submitWork(taskId);
      
      await expect(
        taskMarketplace.connect(worker).approveWork(taskId)
      ).to.be.revertedWith("Only task creator can call this");
    });

    it("Should not allow completing an open task", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await taskMarketplace.connect(creator).createTask(
        "Another task",
        "Description",
        deadline,
        { value: TASK_REWARD }
      );
      
      await expect(
        taskMarketplace.connect(creator).completeTask(2)
      ).to.be.revertedWith("Only assigned worker can call this");
    });
  });

  describe("Cancelling Tasks", function () {
    let taskId: number;

    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await taskMarketplace.connect(creator).createTask(
        TASK_TITLE,
        TASK_DESCRIPTION,
        deadline,
        { value: TASK_REWARD }
      );
      taskId = 1;
    });

    it("Should allow creator to cancel an open task", async function () {
      await expect(
        taskMarketplace.connect(creator).cancelTask(taskId)
      ).to.emit(taskMarketplace, "TaskCancelled")
        .withArgs(taskId);

      const task = await taskMarketplace.getTask(taskId);
      expect(task.status).to.equal(4); // Cancelled
    });

    it("Should refund creator on cancellation", async function () {
      const creatorBalanceBefore = await taskMarketplace.getBalance(creator.address);
      
      await taskMarketplace.connect(creator).cancelTask(taskId);
      
      const creatorBalanceAfter = await taskMarketplace.getBalance(creator.address);
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(TASK_REWARD);
    });

    it("Should not allow non-creator to cancel task", async function () {
      await expect(
        taskMarketplace.connect(worker).cancelTask(taskId)
      ).to.be.revertedWith("Only task creator can call this");
    });
  });

  describe("Withdrawals", function () {
    let taskId: number;

    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await taskMarketplace.connect(creator).createTask(
        TASK_TITLE,
        TASK_DESCRIPTION,
        deadline,
        { value: TASK_REWARD }
      );
      taskId = 1;
      await taskMarketplace.connect(worker).takeTask(taskId);
      await taskMarketplace.connect(worker).submitWork(taskId);
      await taskMarketplace.connect(creator).approveWork(taskId);
    });

    it("Should allow worker to withdraw earned rewards", async function () {
      const workerBalance = await taskMarketplace.getBalance(worker.address);
      const workerEthBefore = await ethers.provider.getBalance(worker.address);
      
      const tx = await taskMarketplace.connect(worker).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const workerEthAfter = await ethers.provider.getBalance(worker.address);
      
      expect(workerEthAfter).to.be.closeTo(
        workerEthBefore + workerBalance - gasUsed,
        ethers.parseEther("0.001") // Allow small difference for gas fluctuations
      );
    });

    it("Should not allow withdrawing with zero balance", async function () {
      await expect(
        taskMarketplace.connect(user).withdraw()
      ).to.be.revertedWith("No balance to withdraw");
    });

    it("Should reset balance after withdrawal", async function () {
      await taskMarketplace.connect(worker).withdraw();
      
      expect(await taskMarketplace.getBalance(worker.address)).to.equal(0);
    });
  });

  describe("Platform Fee Withdrawal", function () {
    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await taskMarketplace.connect(creator).createTask(
        TASK_TITLE,
        TASK_DESCRIPTION,
        deadline,
        { value: TASK_REWARD }
      );
      await taskMarketplace.connect(worker).takeTask(1);
      await taskMarketplace.connect(worker).submitWork(1);
      await taskMarketplace.connect(creator).approveWork(1);
    });

    it("Should allow owner to withdraw platform fees", async function () {
      const platformFeeBalance = await taskMarketplace.platformFeeBalance();
      const ownerEthBefore = await ethers.provider.getBalance(owner.address);
      
      const tx = await taskMarketplace.connect(owner).withdrawPlatformFees();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const ownerEthAfter = await ethers.provider.getBalance(owner.address);
      
      expect(ownerEthAfter).to.be.closeTo(
        ownerEthBefore + platformFeeBalance - gasUsed,
        ethers.parseEther("0.001")
      );
    });

    it("Should not allow non-owner to withdraw platform fees", async function () {
      await expect(
        taskMarketplace.connect(creator).withdrawPlatformFees()
      ).to.be.revertedWith("Only owner can call this");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      // Create multiple tasks
      await taskMarketplace.connect(creator).createTask(
        "Task 1",
        "Description 1",
        deadline,
        { value: TASK_REWARD }
      );
      
      await taskMarketplace.connect(creator).createTask(
        "Task 2",
        "Description 2",
        deadline,
        { value: TASK_REWARD }
      );
      
      await taskMarketplace.connect(user).createTask(
        "Task 3",
        "Description 3",
        deadline,
        { value: TASK_REWARD }
      );
    });

    it("Should return tasks by creator", async function () {
      const creatorTasks = await taskMarketplace.getTasksByCreator(creator.address);
      expect(creatorTasks.length).to.equal(2);
      expect(creatorTasks[0]).to.equal(1);
      expect(creatorTasks[1]).to.equal(2);
    });

    it("Should return tasks by worker", async function () {
      await taskMarketplace.connect(worker).takeTask(1);
      await taskMarketplace.connect(worker).takeTask(3);
      
      const workerTasks = await taskMarketplace.getTasksByWorker(worker.address);
      expect(workerTasks.length).to.equal(2);
    });

    it("Should return all open tasks", async function () {
      const openTasks = await taskMarketplace.getAllOpenTasks();
      expect(openTasks.length).to.equal(3);
    });

    it("Should return correct task details", async function () {
      const task = await taskMarketplace.getTask(1);
      expect(task.title).to.equal("Task 1");
      expect(task.creator).to.equal(creator.address);
      expect(task.status).to.equal(0); // Open
    });
  });
});
