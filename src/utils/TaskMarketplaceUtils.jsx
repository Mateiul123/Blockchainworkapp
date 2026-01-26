import { ethers } from "ethers";
import TaskMarketplaceArtifact from "../contracts/TaskMarketplace.json";

const ABI = TaskMarketplaceArtifact.abi;

// TaskStatus order assumed from contract enum:
// Open(0), InProgress(1), PendingApproval(2), Completed(3), Cancelled(4), Expired(5)
const STATUS_TEXT = {
  0: "Open",
  1: "InProgress",
  2: "PendingApproval",
  3: "Completed",
  4: "Cancelled",
  5: "Expired",
};

export default class TaskMarketplaceUtils {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.provider = null;
    this.signer = null;
    this.contractRead = null;
    this.contractWrite = null;
    this._listeners = [];
  }

  isConnected() {
    return Boolean(this.provider && this.signer && this.contractRead && this.contractWrite);
  }

  removeAllListeners() {
    try {
      for (const { event, handler } of this._listeners) {
        this.contractRead?.off?.(event, handler);
      }
    } catch (_) {
      // ignore
    }
    this._listeners = [];
  }

  _on(event, handler) {
    if (!this.contractRead?.on) return;
    this.contractRead.on(event, handler);
    this._listeners.push({ event, handler });
  }

  // ---- Connection / info ----
  async connectWallet() {
    try {
      if (!window.ethereum) return { success: false, error: "MetaMask not found" };

      this.provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await this.provider.send("eth_requestAccounts", []);
      const address = accounts?.[0];
      if (!address) return { success: false, error: "No account" };

      this.signer = await this.provider.getSigner();

      this.contractRead = new ethers.Contract(this.contractAddress, ABI, this.provider);
      this.contractWrite = new ethers.Contract(this.contractAddress, ABI, this.signer);

      const balanceWei = await this.provider.getBalance(address);
      return { success: true, address, balance: ethers.formatEther(balanceWei) };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  async getNetworkInfo() {
    try {
      if (!this.provider) return { success: false, error: "Not connected" };
      const net = await this.provider.getNetwork();
      return { success: true, chainId: String(net.chainId), name: net.name };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  async getBalance(address) {
    try {
      if (!this.provider) return { success: false, error: "Not connected" };
      const balWei = await this.provider.getBalance(address);
      return { success: true, balance: ethers.formatEther(balWei) };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  // contract withdrawable balance (userBalances mapping)
  async getContractBalance(address) {
    try {
      if (!this.contractRead) return { success: false, error: "Not connected" };
      const balWei = await this.contractRead.getBalance(address);
      return { success: true, balance: ethers.formatEther(balWei) };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  // ---- Events (used by App.jsx) ----
  onTaskCreated(cb) {
    this._on("TaskCreated", cb);
  }
  onTaskTaken(cb) {
    // V2: worker accepted
    this._on("WorkerAccepted", cb);
  }
  onWorkSubmitted(cb) {
    this._on("WorkSubmitted", cb);
  }
  onTaskApproved(cb) {
    this._on("WorkApproved", cb);
    this._on("WorkAutoApproved", cb);
  }
  onTaskCancelled(cb) {
    this._on("TaskCancelled", cb);
    this._on("TaskExpired", cb);
  }
  onTaskComment(cb) {
    this._on("TaskComment", (taskId, author, message, timestamp) => {
      cb({ taskId: Number(taskId), author, message, timestamp: Number(timestamp) });
    });
  }

  // ---- Helpers ----
  _normalizeTask(raw) {
    const statusNum = Number(raw.status);
    const statusText = STATUS_TEXT[statusNum] ?? String(statusNum);

    return {
      id: Number(raw.id),
      creator: raw.creator,
      worker: raw.worker,
      title: raw.title,
      // In V2 the "description" lives in metadataCID (could be an IPFS CID or plain text)
      description: raw.metadataCID,
      metadataCID: raw.metadataCID,
      submissionCID: raw.submissionCID,
      reward: ethers.formatEther(raw.reward),
      rewardWei: raw.reward,
      status: statusNum,
      statusText,
      createdAt: Number(raw.createdAt),
      applyDeadline: Number(raw.applyDeadline),
      deliveryDeadline: Number(raw.deliveryDeadline),
      deadline: Number(raw.deliveryDeadline),
      reviewDeadline: Number(raw.reviewDeadline),
      acceptedAt: Number(raw.acceptedAt),
      completedAt: Number(raw.completedAt),
      category: Number(raw.category),
      tagsHash: raw.tagsHash,
    };
  }

  async getTask(taskId) {
    try {
      if (!this.contractRead) return { success: false, error: "Not connected" };
      const t = await this.contractRead.getTask(BigInt(taskId));
      return { success: true, task: this._normalizeTask(t) };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  async getApplicants(taskId) {
    try {
      if (!this.contractRead) return { success: false, error: "Not connected" };
      const arr = await this.contractRead.getApplicants(BigInt(taskId));
      return { success: true, applicants: arr };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  async _getTasksFromIds(ids) {
    const tasks = [];
    for (const id of ids) {
      const t = await this.contractRead.getTask(BigInt(id));
      tasks.push(this._normalizeTask(t));
    }
    // newest first
    tasks.sort((a, b) => Number(b.id) - Number(a.id));
    return tasks;
  }

  async getTasksByCreator(creator) {
    try {
      if (!this.contractRead) return { success: false, error: "Not connected" };
      const ids = await this.contractRead.getTasksByCreator(creator);
      const tasks = await this._getTasksFromIds(ids);
      return { success: true, tasks };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  async getTasksByWorker(worker) {
    try {
      if (!this.contractRead) return { success: false, error: "Not connected" };
      const ids = await this.contractRead.getTasksByWorker(worker);
      const tasks = await this._getTasksFromIds(ids);
      return { success: true, tasks };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  async getAllOpenTasks() {
    try {
      if (!this.contractRead) return { success: false, error: "Not connected" };
      const total = await this.contractRead.getTotalTasks();
      const n = Number(total);
      const tasks = [];
      for (let id = 1; id <= n; id++) {
        const t = await this.contractRead.getTask(BigInt(id));
        const norm = this._normalizeTask(t);
        if (norm.status === 0) tasks.push(norm);
      }
      tasks.sort((a, b) => Number(b.id) - Number(a.id));
      return { success: true, tasks };
    } catch (e) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  // ---- Actions ----
  // Backward-compatible helper: App.jsx calls createTask(title, description, deliveryDeadlineTs, rewardEth)
  // We map to V2 createTask(title, metadataCID, category, tagsHash, applyDeadline, deliveryDeadline)
  async createTask(title, descriptionOrCid, deliveryDeadlineTs, rewardEth) {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };

      const now = Math.floor(Date.now() / 1000);
      const delivery = Number(deliveryDeadlineTs);
      if (!Number.isFinite(delivery) || delivery <= now) {
        return { success: false, error: "Delivery deadline must be in the future" };
      }

      // apply deadline: at most delivery - 1 hour, but at least now + 10 minutes
      const apply = Math.max(now + 600, Math.min(delivery - 3600, delivery - 600));

      const value = ethers.parseEther(String(rewardEth));
      const tagsHash = "0x" + "0".repeat(64);
      const category = 0;

      const tx = await this.contractWrite.createTask(
        title,
        String(descriptionOrCid ?? ""),
        Number(category),
        tagsHash,
        BigInt(apply),
        BigInt(delivery),
        { value }
      );

      const receipt = await tx.wait();
      // Try to read TaskCreated(taskId, ...) from logs for nicer UI messages
      let taskId = null;
      try {
        for (const log of receipt?.logs || []) {
          const parsed = this.contractRead?.interface?.parseLog?.(log);
          if (parsed?.name === "TaskCreated") {
            taskId = Number(parsed.args?.[0]);
            break;
          }
        }
      } catch {
        // ignore
      }

      return {
        success: true,
        taskId,
        hash: tx.hash,
        gasUsed: receipt?.gasUsed?.toString?.(),
      };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

  // App.jsx expects "takeTask". In V2, workers "apply".
  async takeTask(taskId) {
    return this.applyToTask(taskId);
  }

  async applyToTask(taskId) {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };
      const tx = await this.contractWrite.applyToTask(BigInt(taskId));
      const r = await tx.wait();
      return { success: true, hash: tx.hash, gasUsed: r?.gasUsed?.toString?.() };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

  async acceptWorker(taskId, workerAddress) {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };
      const tx = await this.contractWrite.acceptWorker(BigInt(taskId), workerAddress);
      const r = await tx.wait();
      return { success: true, hash: tx.hash, gasUsed: r?.gasUsed?.toString?.() };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

  async submitWork(taskId, submissionCID) {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };
      const tx = await this.contractWrite.submitWork(BigInt(taskId), String(submissionCID ?? ""));
      const r = await tx.wait();
      return { success: true, hash: tx.hash, gasUsed: r?.gasUsed?.toString?.() };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

  async approveWork(taskId) {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };
      const tx = await this.contractWrite.approveWork(BigInt(taskId));
      const r = await tx.wait();
      return { success: true, hash: tx.hash, gasUsed: r?.gasUsed?.toString?.() };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

  async autoApprove(taskId) {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };
      const tx = await this.contractWrite.autoApprove(BigInt(taskId));
      const r = await tx.wait();
      return { success: true, hash: tx.hash, gasUsed: r?.gasUsed?.toString?.() };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

  async cancelTask(taskId) {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };
      const tx = await this.contractWrite.cancelTask(BigInt(taskId));
      const r = await tx.wait();
      return { success: true, hash: tx.hash, gasUsed: r?.gasUsed?.toString?.() };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

  async withdraw() {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };
      const tx = await this.contractWrite.withdraw();
      const r = await tx.wait();
      return { success: true, hash: tx.hash, gasUsed: r?.gasUsed?.toString?.() };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

  async addComment(taskId, message) {
    try {
      if (!this.contractWrite) return { success: false, error: "Not connected" };
      const tx = await this.contractWrite.addComment(BigInt(taskId), message);
      const r = await tx.wait();
      return { success: true, hash: tx.hash, gasUsed: r?.gasUsed?.toString?.() };
    } catch (e) {
      return { success: false, error: e?.shortMessage || e?.message || String(e) };
    }
  }

    async getCommentsForTask(taskId) {
    try {
      const filter = this.contractRead.filters.TaskComment(taskId);
      const events = await this.contractRead.queryFilter(filter);

      return {
        success: true,
        comments: events.map(e => ({
          taskId: Number(e.args.taskId),
          author: e.args.author,
          message: e.args.message,
          timestamp: Number(e.args.timestamp),
        }))
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

}


