import { ethers } from "ethers";
import TaskMarketplaceABI from "../contracts/TaskMarketplace.json";

/**
 * Utility class for interacting with the TaskMarketplace smart contract
 * Demonstrates: Web3 provider connection, event handling, gas estimation, error handling
 */
class TaskMarketplaceUtils {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.contract = null;
    this.provider = null;
    this.signer = null;
  }

  /**
   * Check if wallet is connected and contract is initialized
   */
  isConnected() {
    return this.contract !== null && this.signer !== null && this.provider !== null;
  }

  /**
   * Connect to MetaMask and initialize contract instance
   * Part 2: Using web3 library and connecting to Web3 Provider
   */
  async connectWallet() {
    try {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        throw new Error("MetaMask not installed! Please install MetaMask browser extension.");
      }

      // Wait for MetaMask to be ready with retries
      let attempts = 0;
      const maxAttempts = 5;
      let provider;

      while (attempts < maxAttempts) {
        try {
          // Create provider immediately
          provider = new ethers.BrowserProvider(window.ethereum);
          
          // Test the provider by getting the network
          await provider.getNetwork();
          break; // Success, exit loop
        } catch (e) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error("MetaMask provider not responding. Please refresh and try again.");
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      this.provider = provider;

      // Request account access with timeout
      let accounts;
      try {
        const accountsPromise = window.ethereum.request({
          method: "eth_requestAccounts",
        });
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("MetaMask request timed out")), 10000)
        );
        
        accounts = await Promise.race([accountsPromise, timeoutPromise]);
      } catch (error) {
        if (error.code === 4001 || error.message?.includes("User denied")) {
          throw new Error("You rejected the wallet connection in MetaMask");
        }
        if (error.message?.includes("timed out")) {
          throw new Error("MetaMask took too long to respond. Please make sure MetaMask is unlocked.");
        }
        throw new Error(`MetaMask error: ${error.message || error}`);
      }

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in MetaMask. Please add an account.");
      }

      // Get signer
      let signer;
      try {
        signer = await this.provider.getSigner();
      } catch (error) {
        throw new Error(`Failed to get signer: ${error.message}`);
      }

      this.signer = signer;

      // Initialize contract with signer
      if (!this.contractAddress || !this.contractAddress.startsWith("0x")) {
        throw new Error("Contract address not configured properly");
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        TaskMarketplaceABI.abi,
        this.signer
      );

      // Part 2: Accessing general account information (address, balance)
      let address;
      try {
        address = await this.signer.getAddress();
      } catch (error) {
        throw new Error(`Failed to get address: ${error.message}`);
      }

      let balance;
      try {
        balance = await this.provider.getBalance(address);
      } catch (error) {
        throw new Error(`Failed to get balance: ${error.message}`);
      }

      return {
        address,
        balance: ethers.formatEther(balance),
        success: true,
      };
    } catch (error) {
      console.error("Error connecting wallet:", error);
      return {
        success: false,
        error: error.message || "Failed to connect wallet. Please ensure MetaMask is installed, unlocked, and try again.",
      };
    }
  }

  /**
   * Get account balance
   * Part 2: Accessing account balance
   */
  async getBalance(address) {
    try {
      if (!address) {
        address = await this.signer.getAddress();
      }
      const balance = await this.provider.getBalance(address);
      return {
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
        success: true,
      };
    } catch (error) {
      console.error("Error getting balance:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's withdrawable balance from contract
   */
  async getContractBalance(address) {
    try {
      if (!address) {
        address = await this.signer.getAddress();
      }
      const balance = await this.contract.getBalance(address);
      return {
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
        success: true,
      };
    } catch (error) {
      console.error("Error getting contract balance:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new task with ETH reward
   * Part 2: Initiating transactions and calling functions
   * Demonstrates: Gas estimation, transaction state control, error handling
   */
  async createTask(title, description, deadlineTimestamp, rewardEth) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      const rewardWei = ethers.parseEther(rewardEth.toString());

      // Gas estimation - Part 2 requirement
      const estimatedGas = await this.contract.createTask.estimateGas(
        title,
        description,
        deadlineTimestamp,
        { value: rewardWei }
      );

      console.log(`Estimated gas: ${estimatedGas.toString()}`);

      // Set gas limit with buffer (20% extra)
      const gasLimit = (estimatedGas * 120n) / 100n;

      // Initiate transaction - Part 2 requirement
      const tx = await this.contract.createTask(
        title,
        description,
        deadlineTimestamp,
        {
          value: rewardWei,
          gasLimit: gasLimit,
        }
      );

      console.log(`Transaction hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");

      // Transaction state control - Part 2 requirement
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Parse event from transaction receipt
      const event = receipt.logs
        .map((log) => {
          try {
            return this.contract.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .find((e) => e && e.name === "TaskCreated");

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        taskId: event ? event.args[0].toString() : null,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice
          ? receipt.gasPrice.toString()
          : "N/A",
      };
    } catch (error) {
      console.error("Error creating task:", error);

      // Enhanced error handling - Part 2 requirement
      let errorMessage = "Unknown error occurred";

      if (error.code === "ACTION_REJECTED") {
        errorMessage = "Transaction rejected by user";
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        errorMessage = "Insufficient funds for transaction";
      } else if (error.message.includes("user rejected")) {
        errorMessage = "Transaction rejected by user";
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        code: error.code,
      };
    }
  }

  /**
   * Take an available task
   * Part 2: Initiating transactions with gas estimation and error handling
   */
  async takeTask(taskId) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      // Gas estimation
      const estimatedGas = await this.contract.takeTask.estimateGas(taskId);
      const gasLimit = (estimatedGas * 120n) / 100n;

      const tx = await this.contract.takeTask(taskId, { gasLimit });

      console.log(`Transaction hash: ${tx.hash}`);

      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("Error taking task:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Submit work for a task (worker calls this)
   */
  async submitWork(taskId) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }
      if (!this.signer) {
        throw new Error("No signer available. Please reconnect your wallet.");
      }

      const estimatedGas = await this.contract.submitWork.estimateGas(taskId);
      const gasLimit = (estimatedGas * 120n) / 100n;

      const tx = await this.contract.submitWork(taskId, { gasLimit });
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("Error submitting work:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Approve work and release payment (creator calls this)
   */
  async approveWork(taskId) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      const estimatedGas = await this.contract.approveWork.estimateGas(taskId);
      const gasLimit = (estimatedGas * 120n) / 100n;

      const tx = await this.contract.approveWork(taskId, { gasLimit });
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("Error approving work:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Complete a task (deprecated - use submitWork + approveWork for escrow)
   */
  async completeTask(taskId) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      const estimatedGas = await this.contract.completeTask.estimateGas(taskId);
      const gasLimit = (estimatedGas * 120n) / 100n;

      const tx = await this.contract.completeTask(taskId, { gasLimit });
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("Error completing task:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      const estimatedGas = await this.contract.cancelTask.estimateGas(taskId);
      const gasLimit = (estimatedGas * 120n) / 100n;

      const tx = await this.contract.cancelTask(taskId, { gasLimit });
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("Error cancelling task:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Withdraw available balance
   */
  async withdraw() {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      const estimatedGas = await this.contract.withdraw.estimateGas();
      const gasLimit = (estimatedGas * 120n) / 100n;

      const tx = await this.contract.withdraw({ gasLimit });
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("Error withdrawing:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Get task details
   * Part 2: Reading contract data
   */
  async getTask(taskId) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      const task = await this.contract.getTask(taskId);

      return {
        success: true,
        task: {
          id: task.id.toString(),
          creator: task.creator,
          worker: task.worker,
          title: task.title,
          description: task.description,
          reward: ethers.formatEther(task.reward),
          rewardWei: task.reward.toString(),
          status: Number(task.status),
          statusText: this._getStatusText(Number(task.status)),
          createdAt: Number(task.createdAt),
          deadline: Number(task.deadline),
        },
      };
    } catch (error) {
      console.error("Error getting task:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Get all open tasks
   */
  async getAllOpenTasks() {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      const tasks = await this.contract.getAllOpenTasks();

      return {
        success: true,
        tasks: tasks.map((task) => ({
          id: task.id.toString(),
          creator: task.creator,
          worker: task.worker,
          title: task.title,
          description: task.description,
          reward: ethers.formatEther(task.reward),
          rewardWei: task.reward.toString(),
          status: Number(task.status),
          statusText: this._getStatusText(Number(task.status)),
          createdAt: Number(task.createdAt),
          deadline: Number(task.deadline),
        })),
      };
    } catch (error) {
      console.error("Error getting open tasks:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Get tasks created by a user
   */
  async getTasksByCreator(address) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      if (!address) {
        address = await this.signer.getAddress();
      }

      const taskIds = await this.contract.getTasksByCreator(address);
      const tasks = [];

      for (let i = 0; i < taskIds.length; i++) {
        const taskResult = await this.getTask(taskIds[i].toString());
        if (taskResult.success) {
          tasks.push(taskResult.task);
        }
      }

      return {
        success: true,
        tasks,
      };
    } catch (error) {
      console.error("Error getting tasks by creator:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Get tasks taken by a worker
   */
  async getTasksByWorker(address) {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Connect wallet first.");
      }

      if (!address) {
        address = await this.signer.getAddress();
      }

      const taskIds = await this.contract.getTasksByWorker(address);
      const tasks = [];

      for (let i = 0; i < taskIds.length; i++) {
        const taskResult = await this.getTask(taskIds[i].toString());
        if (taskResult.success) {
          tasks.push(taskResult.task);
        }
      }

      return {
        success: true,
        tasks,
      };
    } catch (error) {
      console.error("Error getting tasks by worker:", error);
      return {
        success: false,
        error: this._parseError(error),
      };
    }
  }

  /**
   * Listen for events - Observer Pattern - Part 2 requirement
   */
  listenForEvents(eventName, callback) {
    if (!this.contract) {
      // Silently return if contract doesn't exist yet
      return;
    }

    this.contract.on(eventName, (...args) => {
      console.log(`Event ${eventName} received:`, args);
      callback(...args);
    });
  }

  /**
   * Remove event listeners
   */
  removeEventListeners(eventName) {
    if (!this.contract) {
      return;
    }

    this.contract.removeAllListeners(eventName);
  }

  /**
   * Listen for TaskCreated events
   */
  onTaskCreated(callback) {
    this.listenForEvents("TaskCreated", (taskId, creator, reward, deadline, event) => {
      callback({
        taskId: taskId.toString(),
        creator,
        reward: ethers.formatEther(reward),
        deadline: Number(deadline),
        event,
      });
    });
  }

  /**
   * Listen for TaskTaken events
   */
  onTaskTaken(callback) {
    this.listenForEvents("TaskTaken", (taskId, worker, event) => {
      callback({
        taskId: taskId.toString(),
        worker,
        event,
      });
    });
  }

  /**
   * Listen for TaskCompleted events
   */
  onTaskCompleted(callback) {
    this.listenForEvents("TaskCompleted", (taskId, worker, reward, event) => {
      callback({
        taskId: taskId.toString(),
        worker,
        reward: ethers.formatEther(reward),
        event,
      });
    });
  }

  /**
   * Listen for TaskCancelled events
   */
  onTaskCancelled(callback) {
    this.listenForEvents("TaskCancelled", (taskId, event) => {
      callback({
        taskId: taskId.toString(),
        event,
      });
    });
  }

  /**
   * Helper to parse error messages
   */
  _parseError(error) {
    if (error.code === "ACTION_REJECTED") {
      return "Transaction rejected by user";
    } else if (error.code === "INSUFFICIENT_FUNDS") {
      return "Insufficient funds for transaction";
    } else if (error.message?.includes("user rejected")) {
      return "Transaction rejected by user";
    } else if (error.message) {
      return error.message;
    }
    return "Unknown error occurred";
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    if (!this.contract) {
      // Silently return if contract doesn't exist yet
      return;
    }
    this.contract.removeAllListeners();
  }

  /**
   * Helper to get status text
   */
  _getStatusText(status) {
    const statuses = ["Open", "InProgress", "PendingApproval", "Completed", "Cancelled"];
    return statuses[status] || "Unknown";
  }

  /**
   * Get network information
   */
  async getNetworkInfo() {
    try {
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }

      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      return {
        success: true,
        chainId: network.chainId.toString(),
        name: network.name,
        blockNumber,
      };
    } catch (error) {
      console.error("Error getting network info:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default TaskMarketplaceUtils;
