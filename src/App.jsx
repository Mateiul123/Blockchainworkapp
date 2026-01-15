import { useState, useEffect } from "react";
import TaskMarketplaceUtils from "./utils/TaskMarketplaceUtils";
import "./App.css";

// Sepolia network contract address - Updated after deployment
const SEPOLIA_CONTRACT_ADDRESS = "0xb8C33d85C8Ba7464165D20d389190121B1f9472C";
const SEPOLIA_CHAIN_ID = "11155111";

function App() {
  const [utils, setUtils] = useState(null);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("0");
  const [contractBalance, setContractBalance] = useState("0");
  const [networkInfo, setNetworkInfo] = useState(null);

  // Task state
  const [openTasks, setOpenTasks] = useState([]);
  const [myCreatedTasks, setMyCreatedTasks] = useState([]);
  const [myWorkerTasks, setMyWorkerTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    reward: "",
    deadline: "",
  });

  // Current view state
  const [currentView, setCurrentView] = useState("marketplace"); // marketplace, myTasks, create

  useEffect(() => {
    const utilsInstance = new TaskMarketplaceUtils(SEPOLIA_CONTRACT_ADDRESS);
    setUtils(utilsInstance);
  }, []);

  // Listen for account changes in MetaMask
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        // User disconnected wallet
        handleDisconnect();
      } else if (accounts[0] !== account) {
        // User switched accounts
        setAccount(accounts[0]);
        setSuccess("Account switched! Reloading data...");
        // Reconnect with new account
        if (utils) {
          const result = await utils.connectWallet();
          if (result.success) {
            setAccount(result.address);
            setBalance(result.balance);
            // Reload all data for new account
            setTimeout(() => {
              loadTasks();
              loadBalances();
            }, 500);
          }
        }
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [account, utils]);

  // Setup event listeners when utils is ready AND wallet is connected
  useEffect(() => {
    if (!utils || !account || !utils.isConnected()) return;

    // Remove any existing listeners first to prevent duplicates
    utils.removeAllListeners();

    // Listen for TaskCreated events
    utils.onTaskCreated((data) => {
      console.log("Task created:", data);
      setSuccess(`Task #${data.taskId} created successfully!`);
      setTimeout(() => loadTasks(), 2000);
    });

    // Listen for TaskTaken events
    utils.onTaskTaken((data) => {
      console.log("Task taken:", data);
      setSuccess(`Task #${data.taskId} taken successfully!`);
      setTimeout(() => loadTasks(), 2000);
    });

    // Listen for TaskCompleted events
    utils.onTaskCompleted((data) => {
      console.log("Task completed:", data);
      setSuccess(`Task #${data.taskId} completed! Reward: ${data.reward} ETH`);
      setTimeout(() => {
        loadTasks();
        loadBalances();
      }, 2000);
    });

    // Listen for TaskCancelled events
    utils.onTaskCancelled((data) => {
      console.log("Task cancelled:", data);
      setSuccess(`Task #${data.taskId} cancelled`);
      setTimeout(() => loadTasks(), 2000);
    });

    return () => {
      // Clean up all event listeners when component unmounts or deps change
      utils.removeAllListeners();
    };
  }, [utils, account]);

  // Reload tasks when account changes (only if wallet is connected)
  useEffect(() => {
    if (account && utils && utils.isConnected()) {
      console.log("Account changed, reloading tasks for:", account);
      loadTasks();
      loadBalances();
    }
  }, [account]);

  const handleDisconnect = () => {
    setAccount("");
    setBalance("0");
    setContractBalance("0");
    setOpenTasks([]);
    setMyCreatedTasks([]);
    setMyWorkerTasks([]);
    setSuccess("Wallet disconnected. Connect to switch accounts.");
  };

  const connectWallet = async () => {
    if (!utils) return;

    setLoading(true);
    setError("");

    // Ensure MetaMask is available
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install it from https://metamask.io/");
      setLoading(false);
      return;
    }

    // Try to connect
    const result = await utils.connectWallet();

    if (result.success) {
      setAccount(result.address);
      setBalance(result.balance);

      // Get network info
      const networkResult = await utils.getNetworkInfo();
      if (networkResult.success) {
        setNetworkInfo(networkResult);
        // Check if on correct network
        if (networkResult.chainId !== SEPOLIA_CHAIN_ID) {
          setError(`❌ Wrong network! You are on Chain ID ${networkResult.chainId}. Please switch to Sepolia (Chain ID 11155111) in MetaMask and try again.`);
          setLoading(false);
          return;
        }
      }

      // Load contract balance
      const contractBalResult = await utils.getContractBalance(result.address);
      if (contractBalResult.success) {
        setContractBalance(contractBalResult.balance);
      }

      // Load tasks
      await loadTasks();
      setSuccess("✅ Wallet connected to Sepolia network!");
    } else {
      setError(`❌ Connection failed: ${result.error}`);
    }

    setLoading(false);
  };

  const loadBalances = async () => {
    if (!utils || !account) return;

    const balResult = await utils.getBalance(account);
    if (balResult.success) {
      setBalance(balResult.balance);
    }

    const contractBalResult = await utils.getContractBalance(account);
    if (contractBalResult.success) {
      setContractBalance(contractBalResult.balance);
    }
  };

  const loadTasks = async () => {
    if (!utils || !account) return;

    console.log("Loading tasks for account:", account);

    // Load open tasks
    const openResult = await utils.getAllOpenTasks();
    if (openResult.success) {
      setOpenTasks(openResult.tasks);
      console.log("Open tasks:", openResult.tasks.length);
    }

    // Load my created tasks
    const createdResult = await utils.getTasksByCreator(account);
    if (createdResult.success) {
      // Filter to ensure only tasks created by this account
      const filteredCreated = createdResult.tasks.filter(
        task => task.creator.toLowerCase() === account.toLowerCase()
      );
      setMyCreatedTasks(filteredCreated);
      console.log("Created tasks:", filteredCreated.length, "for", account);
    }

    // Load my worker tasks
    const workerResult = await utils.getTasksByWorker(account);
    if (workerResult.success) {
      // Filter to ensure only tasks where this account is the worker
      const filteredWorker = workerResult.tasks.filter(
        task => task.worker.toLowerCase() === account.toLowerCase()
      );
      setMyWorkerTasks(filteredWorker);
      console.log("Worker tasks:", filteredWorker.length, "for", account);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const deadlineTimestamp = Math.floor(new Date(newTask.deadline).getTime() / 1000);

    const result = await utils.createTask(
      newTask.title,
      newTask.description,
      deadlineTimestamp,
      newTask.reward
    );

    if (result.success) {
      setSuccess(`Task created! Gas used: ${result.gasUsed}`);
      setNewTask({ title: "", description: "", reward: "", deadline: "" });
      setCurrentView("marketplace");
      await loadTasks();
      await loadBalances();
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleTakeTask = async (taskId) => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const result = await utils.takeTask(taskId);

    if (result.success) {
      setSuccess(`Task taken! Gas used: ${result.gasUsed}`);
      await loadTasks();
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleCompleteTask = async (taskId) => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    // Use submitWork for the new escrow system
    const result = await utils.submitWork(taskId);

    if (result.success) {
      setSuccess(`Work submitted! Waiting for creator approval...`);
      await loadTasks();
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleApproveWork = async (taskId) => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const result = await utils.approveWork(taskId);

    if (result.success) {
      setSuccess(`Work approved! Reward transferred to worker. Gas used: ${result.gasUsed}`);
      await loadTasks();
      await loadBalances();
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleCancelTask = async (taskId) => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const result = await utils.cancelTask(taskId);

    if (result.success) {
      setSuccess(`Task cancelled! Gas used: ${result.gasUsed}`);
      await loadTasks();
      await loadBalances();
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const result = await utils.withdraw();

    if (result.success) {
      setSuccess(`Withdrawal successful! Gas used: ${result.gasUsed}`);
      await loadBalances();
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  if (!account) {
    return (
      <div className="app">
        <div className="connect-container">
          <h1>🎯 Task Marketplace</h1>
          <p>A decentralized platform for creating and completing tasks on Sepolia</p>
          <button onClick={connectWallet} disabled={loading} className="btn-primary">
            {loading ? "Connecting..." : "Connect Wallet"}
          </button>
          {error && <div className="error">{error}</div>}
          {!SEPOLIA_CONTRACT_ADDRESS.startsWith("0x") && (
            <div className="warning">
              ⚠️ Contract address not configured. Please deploy the contract and update SEPOLIA_CONTRACT_ADDRESS in App.jsx
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>🎯 Task Marketplace</h1>
        <div className="account-info">
          <div className="info-item">
            <span className="label">Account:</span>
            <span className="value">{formatAddress(account)}</span>            <button onClick={handleDisconnect} className="btn-disconnect" title="Disconnect wallet to switch accounts">
              🔄 Switch
            </button>          </div>
          <div className="info-item">
            <span className="label">Balance:</span>
            <span className="value">{parseFloat(balance).toFixed(4)} ETH</span>
          </div>
          <div className="info-item">
            <span className="label">Available to Withdraw:</span>
            <span className="value">{parseFloat(contractBalance).toFixed(4)} ETH</span>
            {parseFloat(contractBalance) > 0 && (
              <button onClick={handleWithdraw} className="btn-small" disabled={loading}>
                Withdraw
              </button>
            )}
          </div>
          {networkInfo && (
            <div className="info-item">
              <span className="label">Network:</span>
              <span className="value">Sepolia (Chain ID {networkInfo.chainId})</span>
            </div>
          )}
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav">
        <button
          className={currentView === "marketplace" ? "active" : ""}
          onClick={() => setCurrentView("marketplace")}
        >
          🏪 Marketplace
        </button>
        <button
          className={currentView === "myTasks" ? "active" : ""}
          onClick={() => setCurrentView("myTasks")}
        >
          📋 My Tasks
        </button>
        <button
          className={currentView === "create" ? "active" : ""}
          onClick={() => setCurrentView("create")}
        >
          ➕ Create Task
        </button>
      </nav>

      {/* Messages */}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* Main Content */}
      <main className="main">
        {currentView === "marketplace" && (
          <div className="marketplace">
            <h2>Open Tasks</h2>
            {openTasks.length === 0 ? (
              <p className="empty-state">No open tasks available</p>
            ) : (
              <div className="tasks-grid">
                {openTasks.map((task) => (
                  <div key={task.id} className="task-card">
                    <div className="task-header">
                      <h3>{task.title}</h3>
                      <span className="reward">💰 {task.reward} ETH</span>
                    </div>
                    <p className="description">{task.description}</p>
                    <div className="task-meta">
                      <span>📅 Deadline: {formatDate(task.deadline)}</span>
                      <span>👤 Creator: {formatAddress(task.creator)}</span>
                    </div>
                    {task.creator.toLowerCase() !== account.toLowerCase() && (
                      <button
                        onClick={() => handleTakeTask(task.id)}
                        disabled={loading}
                        className="btn-primary"
                      >
                        Take Task
                      </button>
                    )}
                    {task.creator.toLowerCase() === account.toLowerCase() && (
                      <button
                        onClick={() => handleCancelTask(task.id)}
                        disabled={loading}
                        className="btn-danger"
                      >
                        Cancel Task
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === "myTasks" && (
          <div className="my-tasks">
            <section>
              <h2>Tasks I Created</h2>
              {myCreatedTasks.length === 0 ? (
                <p className="empty-state">You haven't created any tasks yet</p>
              ) : (
                <div className="tasks-grid">
                  {myCreatedTasks.map((task) => (
                    <div key={task.id} className="task-card">
                      <div className="task-header">
                        <h3>{task.title}</h3>
                        <span className={`status status-${task.statusText.toLowerCase()}`}>
                          {task.statusText}
                        </span>
                      </div>
                      <p className="description">{task.description}</p>
                      <div className="task-meta">
                        <span>💰 Reward: {task.reward} ETH</span>
                        <span>📅 Deadline: {formatDate(task.deadline)}</span>
                        {task.worker !== "0x0000000000000000000000000000000000000000" && (
                          <span>👷 Worker: {formatAddress(task.worker)}</span>
                        )}
                      </div>
                      {task.status === 1 && (
                        <div className="button-group">
                          <button
                            onClick={() => handleCancelTask(task.id)}
                            disabled={loading}
                            className="btn-danger"
                          >
                            Cancel Task
                          </button>
                        </div>
                      )}
                      {task.status === 2 && (
                        <div className="button-group">
                          <button
                            onClick={() => handleApproveWork(task.id)}
                            disabled={loading}
                            className="btn-success"
                          >
                            ✅ Approve Work & Release Payment
                          </button>
                        </div>
                      )}
                      {task.status === 3 && (
                        <div className="completion-message">
                          ✅ Work completed and approved
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2>Tasks I'm Working On</h2>
              {myWorkerTasks.length === 0 ? (
                <p className="empty-state">You haven't taken any tasks yet</p>
              ) : (
                <div className="tasks-grid">
                  {myWorkerTasks.map((task) => (
                    <div key={task.id} className="task-card">
                      <div className="task-header">
                        <h3>{task.title}</h3>
                        <span className={`status status-${task.statusText.toLowerCase()}`}>
                          {task.statusText}
                        </span>
                      </div>
                      <p className="description">{task.description}</p>
                      <div className="task-meta">
                        <span>💰 Reward: {task.reward} ETH</span>
                        <span>📅 Deadline: {formatDate(task.deadline)}</span>
                        <span>👤 Creator: {formatAddress(task.creator)}</span>
                      </div>
                      {task.status === 1 && (
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={loading}
                          className="btn-success"
                        >
                          ✅ Submit Work for Review
                        </button>
                      )}
                      {task.status === 2 && (
                        <div className="pending-approval">
                          ⏳ Waiting for creator approval...
                        </div>
                      )}
                      {task.status === 3 && (
                        <div className="completion-message">
                          ✅ Task approved! Reward received.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {currentView === "create" && (
          <div className="create-task">
            <h2>Create New Task</h2>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label htmlFor="title">Task Title *</label>
                <input
                  type="text"
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  required
                  maxLength={100}
                  placeholder="e.g., Build a website"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  required
                  maxLength={1000}
                  rows={4}
                  placeholder="Describe the task in detail..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reward">Reward (ETH) *</label>
                  <input
                    type="number"
                    id="reward"
                    value={newTask.reward}
                    onChange={(e) => setNewTask({ ...newTask, reward: e.target.value })}
                    required
                    step="0.001"
                    min="0.001"
                    placeholder="0.1"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="deadline">Deadline *</label>
                  <input
                    type="datetime-local"
                    id="deadline"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Creating..." : "Create Task"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
