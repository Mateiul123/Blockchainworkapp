// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import TaskMarketplaceUtils from "./utils/TaskMarketplaceUtils";
import "./App.css";

// ✅ update this after deploy
const SEPOLIA_CONTRACT_ADDRESS = "0xB12210a69c508AaA54504908e09c5a4383f026c8";
const SEPOLIA_CHAIN_ID = "11155111";

// status mapping must match your contract enum order
const STATUS = {
  Open: 0,
  InProgress: 1,
  PendingApproval: 2,
  Completed: 3,
  Cancelled: 4,
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export default function App() {
  const [utils, setUtils] = useState(null);

  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("0");
  const [withdrawable, setWithdrawable] = useState("0");
  const [networkInfo, setNetworkInfo] = useState(null);

  // tasks
  const [openTasks, setOpenTasks] = useState([]);
  const [myCreatedTasks, setMyCreatedTasks] = useState([]);
  const [myWorkerTasks, setMyWorkerTasks] = useState([]);

  // ui state
  const [currentView, setCurrentView] = useState("marketplace"); // marketplace | myTasks | create
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // search / filters (Marketplace)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | open | inprogress | pendingapproval | completed | cancelled
  const [sortBy, setSortBy] = useState("newest"); // newest | rewardHigh | rewardLow | deadlineSoon

  // comments (optional, if supported by your utils + contract)
  const [comments, setComments] = useState({}); // { [taskId]: [{taskId, author, message, timestamp}] }
  const [commentInput, setCommentInput] = useState({}); // { [taskId]: "..." }

  // form
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    reward: "",
    deadline: "",
  });

  // init utils
  useEffect(() => {
    setUtils(new TaskMarketplaceUtils(SEPOLIA_CONTRACT_ADDRESS));
  }, []);

  // helpers
  const isConnected = useMemo(
    () => Boolean(account && utils?.isConnected?.()),
    [account, utils]
  );

  const wrongNetwork =
    networkInfo?.chainId && networkInfo.chainId !== SEPOLIA_CHAIN_ID;

  const normalize = (s) => (s ?? "").toString().toLowerCase().trim();

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "-";
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  const formatAddress = (addr) => {
    if (!addr) return "-";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const clearMessagesSoon = () => {
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
  };

  const statusKeyFromTask = (task) => {
    const s = normalize(task?.statusText);
    if (s) return s;

    switch (task?.status) {
      case STATUS.Open:
        return "open";
      case STATUS.InProgress:
        return "inprogress";
      case STATUS.PendingApproval:
        return "pendingapproval";
      case STATUS.Completed:
        return "completed";
      case STATUS.Cancelled:
        return "cancelled";
      default:
        return "all";
    }
  };

  const matchesSearch = (task, q) => {
    const query = normalize(q);
    if (!query) return true;

    const hay = [
      task?.id,
      task?.title,
      task?.description,
      task?.creator,
      task?.worker,
      task?.statusText,
    ]
      .map((x) => normalize(x))
      .join(" ");

    return hay.includes(query);
  };

  const applyFiltersAndSort = (tasks) => {
    const q = searchQuery;

    let filtered = (tasks ?? []).filter((t) => {
      const okSearch = matchesSearch(t, q);
      const key = statusKeyFromTask(t);
      const okStatus = statusFilter === "all" ? true : key === statusFilter;
      return okSearch && okStatus;
    });

    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    filtered = filtered.slice().sort((a, b) => {
      if (sortBy === "rewardHigh") return toNum(b.reward) - toNum(a.reward);
      if (sortBy === "rewardLow") return toNum(a.reward) - toNum(b.reward);
      if (sortBy === "deadlineSoon") return toNum(a.deadline) - toNum(b.deadline);
      return toNum(b.id) - toNum(a.id); // newest
    });

    return filtered;
  };

  // ✅ compute once per render
  const filteredOpen = useMemo(
    () => applyFiltersAndSort(openTasks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openTasks, searchQuery, statusFilter, sortBy]
  );

  const handleDisconnect = () => {
    utils?.removeAllListeners?.();
    setAccount("");
    setBalance("0");
    setWithdrawable("0");
    setNetworkInfo(null);
    setOpenTasks([]);
    setMyCreatedTasks([]);
    setMyWorkerTasks([]);
    setCurrentView("marketplace");
    setSuccess("Wallet disconnected in UI. Reconnect to continue.");
    clearMessagesSoon();
  };

  // MetaMask account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        handleDisconnect();
        return;
      }

      const next = accounts[0];
      if (next?.toLowerCase?.() !== account?.toLowerCase?.()) {
        setAccount(next);
        setSuccess("Account switched. Reloading data...");
        clearMessagesSoon();

        if (utils) {
          const res = await utils.connectWallet();
          if (res.success) {
            setAccount(res.address);
            setBalance(res.balance);
            await loadBalances(res.address);
            await loadTasks(res.address);
          }
        }
      }
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", onAccountsChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, utils]);

  // event listeners
  useEffect(() => {
    if (!utils || !isConnected) return;

    utils.removeAllListeners();

    utils.onTaskCreated?.(() => {
      setSuccess("Task created!");
      clearMessagesSoon();
      setTimeout(() => loadTasks(account), 1200);
    });

    utils.onTaskTaken?.(() => {
      setSuccess("Task taken!");
      clearMessagesSoon();
      setTimeout(() => loadTasks(account), 1200);
    });

    utils.onWorkSubmitted?.(() => {
      setSuccess("Work submitted. Waiting creator approval.");
      clearMessagesSoon();
      setTimeout(() => loadTasks(account), 1200);
    });

    utils.onTaskApproved?.(() => {
      setSuccess("Work approved. Reward is now withdrawable.");
      clearMessagesSoon();
      setTimeout(async () => {
        await loadTasks(account);
        await loadBalances(account);
      }, 1200);
    });

    utils.onTaskCancelled?.(() => {
      setSuccess("Task cancelled. Funds are withdrawable (if you were the creator).");
      clearMessagesSoon();
      setTimeout(async () => {
        await loadTasks(account);
        await loadBalances(account);
      }, 1200);
    });

    // optional: comments event
    utils.onTaskComment?.((c) => {
      // expecting: { taskId, author, message, timestamp }
      setComments((prev) => ({
        ...prev,
        [c.taskId]: [...(prev[c.taskId] || []), c],
      }));
    });

    return () => utils.removeAllListeners?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utils, isConnected, account]);

  // core loaders
  const loadBalances = async (addr = account) => {
    if (!utils || !addr) return;

    const bal = await utils.getBalance(addr);
    if (bal.success) setBalance(bal.balance);

    const w = await utils.getContractBalance(addr);
    if (w.success) setWithdrawable(w.balance);
  };

  const loadTasks = async (addr = account) => {
    if (!utils || !addr) return;

    const openRes = await utils.getAllOpenTasks();
    if (openRes.success) setOpenTasks(openRes.tasks);

    const createdRes = await utils.getTasksByCreator(addr);
    if (createdRes.success) {
      const filtered = createdRes.tasks.filter(
        (t) => t.creator?.toLowerCase?.() === addr.toLowerCase()
      );
      setMyCreatedTasks(filtered);
    }

    const workerRes = await utils.getTasksByWorker(addr);
    if (workerRes.success) {
      const filtered = workerRes.tasks.filter(
        (t) => t.worker?.toLowerCase?.() === addr.toLowerCase()
      );
      setMyWorkerTasks(filtered);
    }

    // ✅ load comments from chain (so they persist after refresh)
    if (utils.getCommentsForTask) {
      try {
        const allTasks = [
          ...(openRes.success ? openRes.tasks : []),
          ...(createdRes.success ? createdRes.tasks : []),
          ...(workerRes.success ? workerRes.tasks : []),
        ];

        const ids = Array.from(new Set(allTasks.map((t) => t?.id).filter((x) => x != null)));
        const pairs = await Promise.all(
          ids.map(async (id) => {
            const res = await utils.getCommentsForTask(id);
            return [id, res.success ? res.comments : null];
          })
        );

        setComments((prev) => {
          const next = { ...prev };
          for (const [id, list] of pairs) {
            if (Array.isArray(list)) next[id] = list;
          }
          return next;
        });
      } catch (_) {
        // ignore comment loading errors
      }
    }
  };

  const connectWallet = async () => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    if (!window.ethereum) {
      setError("MetaMask is not installed. Install it from https://metamask.io/");
      setLoading(false);
      return;
    }

    const res = await utils.connectWallet();
    if (!res.success) {
      setError(`Connection failed: ${res.error}`);
      setLoading(false);
      return;
    }

    const net = await utils.getNetworkInfo();
    if (net.success) {
      setNetworkInfo(net);
      if (net.chainId !== SEPOLIA_CHAIN_ID) {
        setError(
          `Wrong network (Chain ID ${net.chainId}). Switch MetaMask to Sepolia (11155111) and reconnect.`
        );
        setAccount(res.address);
        setBalance(res.balance);
        setLoading(false);
        return;
      }
    }

    setAccount(res.address);
    setBalance(res.balance);

    await loadBalances(res.address);
    await loadTasks(res.address);

    setSuccess("Wallet connected to Sepolia ✅");
    clearMessagesSoon();
    setLoading(false);
  };

  // actions
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const deadlineTimestamp = Math.floor(new Date(newTask.deadline).getTime() / 1000);

      const res = await utils.createTask(
        newTask.title,
        newTask.description,
        deadlineTimestamp,
        newTask.reward
      );

      if (!res.success) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setSuccess(`Task created${res.taskId != null ? ` (#${res.taskId})` : ""}!`);
      clearMessagesSoon();

      setNewTask({ title: "", description: "", reward: "", deadline: "" });
      setCurrentView("marketplace");

      await loadTasks(account);
      await loadBalances(account);
    } catch (err) {
      setError(err?.message || String(err));
    }

    setLoading(false);
  };

  const handleTakeTask = async (taskId) => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const res = await utils.takeTask(taskId);
    if (res.success) {
      setSuccess(`Task #${taskId} taken!`);
      clearMessagesSoon();
      await loadTasks(account);
    } else {
      setError(res.error);
    }

    setLoading(false);
  };

  const handleSubmitWork = async (taskId) => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const res = await utils.submitWork(taskId);
    if (res.success) {
      setSuccess(`Work submitted for Task #${taskId}. Waiting approval...`);
      clearMessagesSoon();
      await loadTasks(account);
    } else {
      setError(res.error);
    }

    setLoading(false);
  };

  const handleApproveWork = async (taskId) => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const res = await utils.approveWork(taskId);
    if (res.success) {
      setSuccess(`Approved Task #${taskId}. Worker can withdraw reward now.`);
      clearMessagesSoon();
      await loadTasks(account);
      await loadBalances(account);
    } else {
      setError(res.error);
    }

    setLoading(false);
  };

  const handleCancelTask = async (taskId) => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const res = await utils.cancelTask(taskId);
    if (res.success) {
      setSuccess(`Task #${taskId} cancelled.`);
      clearMessagesSoon();
      await loadTasks(account);
      await loadBalances(account);
    } else {
      setError(res.error);
    }

    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!utils) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const res = await utils.withdraw();
    if (res.success) {
      setSuccess("Withdrawal successful!");
      clearMessagesSoon();
      await loadBalances(account);
    } else {
      setError(res.error);
    }

    setLoading(false);
  };

  // optional: add comment (only if utils.addComment exists)
  const handleAddComment = async (taskId) => {
    const msg = commentInput[taskId];
    if (!msg || !utils?.addComment) return;

    try {
      setLoading(true);
      const res = await utils.addComment(taskId, msg);
      if (!res?.success) throw new Error(res?.error || "Failed to add comment");

      // Clear input immediately
      setCommentInput((prev) => ({ ...prev, [taskId]: "" }));

      // ✅ refresh comments for this task so UI updates even if the event doesn't fire
      if (utils.getCommentsForTask) {
        const c = await utils.getCommentsForTask(taskId);
        if (c.success) {
          setComments((prev) => ({ ...prev, [taskId]: c.comments }));
        }
      }
    } catch (e) {
      setError(e?.message || String(e));
      clearMessagesSoon();
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------

  if (!account) {
    return (
      <div className="app connect-page">
        <div className="connect-container">
          <h1>🎯 Task Marketplace</h1>
          <p>A decentralized task platform on Sepolia (escrow + approvals)</p>

          <button onClick={connectWallet} disabled={loading} className="btn-primary">
            {loading ? "Connecting..." : "Connect Wallet"}
          </button>

          {error && <div className="error">{error}</div>}

          {!SEPOLIA_CONTRACT_ADDRESS?.startsWith("0x") && (
            <div className="warning">
              ⚠️ Contract address not configured. Update SEPOLIA_CONTRACT_ADDRESS in App.jsx
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🎯 Task Marketplace</h1>

          <div className="account-info">
            <div className="info-item">
              <span className="label">Account:</span>
              <span className="value">{formatAddress(account)}</span>
              <button
                onClick={handleDisconnect}
                className="btn-disconnect"
                title="Clear UI connection (for switching accounts)"
              >
                🔄 Switch
              </button>
            </div>

            <div className="info-item">
              <span className="label">Balance:</span>
              <span className="value">{Number(balance).toFixed(4)} ETH</span>
            </div>

            <div className="info-item">
              <span className="label">Withdrawable:</span>
              <span className="value">{Number(withdrawable).toFixed(4)} ETH</span>
              {Number(withdrawable) > 0 && (
                <button onClick={handleWithdraw} className="btn-small" disabled={loading}>
                  Withdraw
                </button>
              )}
            </div>

            {networkInfo && (
              <div className="info-item">
                <span className="label">Network:</span>
                <span className="value">
                  {networkInfo.name} (Chain ID {networkInfo.chainId})
                </span>
              </div>
            )}
          </div>
        </header>

        {wrongNetwork && (
          <div className="error">❌ Wrong network! Switch MetaMask to Sepolia (Chain ID 11155111).</div>
        )}

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

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <main className="main">
          {/* Marketplace */}
          {currentView === "marketplace" && (
            <div className="marketplace">
              <h2>Open Tasks</h2>

              <div className="filters-bar">
                <div className="search-wrap">
                  <span className="search-icon">🔎</span>
                  <input
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, description, creator, worker, id..."
                  />
                  {searchQuery && (
                    <button
                      className="chip-btn"
                      type="button"
                      onClick={() => setSearchQuery("")}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  className="select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  title="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="inprogress">In Progress</option>
                  <option value="pendingapproval">Pending Approval</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  className="select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  title="Sort"
                >
                  <option value="newest">Newest</option>
                  <option value="deadlineSoon">Deadline soon</option>
                  <option value="rewardHigh">Reward high → low</option>
                  <option value="rewardLow">Reward low → high</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  className="btn-small"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    await loadTasks(account);
                    await loadBalances(account);
                    setLoading(false);
                  }}
                >
                  🔄 Refresh
                </button>
              </div>

              {openTasks.length === 0 ? (
                <p className="empty-state">No open tasks available</p>
              ) : filteredOpen.length === 0 ? (
                <p className="empty-state">No results for your search/filter 😭</p>
              ) : (
                <div className="tasks-grid">
                  {filteredOpen.map((task) => {
                    const isCreator = task.creator?.toLowerCase?.() === account.toLowerCase();
                    const isOpen = task.status === STATUS.Open;

                    return (
                      <div key={task.id} className="task-card">
                        <div className="task-header">
                          <h3>{task.title}</h3>
                          <span className="reward">💰 {task.reward} ETH</span>
                        </div>

                        <p className="description">{task.description}</p>

                        <div className="task-meta">
                          <span>📅 Deadline: {formatDateTime(task.deadline)}</span>
                          <span>👤 Creator: {formatAddress(task.creator)}</span>
                        </div>

                        {/* Optional: COMMENTS (only shows send button if utils.addComment exists) */}
                        <div className="comments">
                          {(comments[task.id] || []).length === 0 ? (
                            <div className="comments-empty">No comments yet</div>
                          ) : (
                            (comments[task.id] || []).map((c, i) => (
                              <div key={i} className="comment">
                                <b>{formatAddress(c.author)}</b>: {c.message}
                              </div>
                            ))
                          )}

                          <div className="comment-input">
                            <input
                              placeholder="Write a comment..."
                              value={commentInput[task.id] || ""}
                              onChange={(e) =>
                                setCommentInput((prev) => ({
                                  ...prev,
                                  [task.id]: e.target.value,
                                }))
                              }
                            />
                            {utils?.addComment && (
                              <button
                                type="button"
                                className="btn-small"
                                disabled={loading || wrongNetwork}
                                onClick={() => handleAddComment(task.id)}
                              >
                                Send
                              </button>
                            )}
                          </div>
                        </div>

                        {isCreator ? (
                          <button
                            onClick={() => handleCancelTask(task.id)}
                            disabled={loading || !isOpen || wrongNetwork}
                            className="btn-danger"
                          >
                            Cancel Task
                          </button>
                        ) : (
                          <button
                            onClick={() => handleTakeTask(task.id)}
                            disabled={loading || !isOpen || wrongNetwork}
                            className="btn-primary"
                          >
                            Take Task
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* My Tasks */}
          {currentView === "myTasks" && (
            <div className="my-tasks">
              <section>
                <h2>Tasks I Created</h2>

                {myCreatedTasks.length === 0 ? (
                  <p className="empty-state">You haven't created any tasks yet</p>
                ) : (
                  <div className="tasks-grid">
                    {myCreatedTasks.map((task) => {
                      const workerSet =
                        task.worker && task.worker.toLowerCase() !== ZERO_ADDR.toLowerCase();

                      return (
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
                            <span>📅 Deadline: {formatDateTime(task.deadline)}</span>
                            {workerSet && <span>👷 Worker: {formatAddress(task.worker)}</span>}
                          </div>

                          {task.status === STATUS.Open && (
                            <div className="button-group">
                              <button
                                onClick={() => handleCancelTask(task.id)}
                                disabled={loading || wrongNetwork}
                                className="btn-danger"
                              >
                                Cancel Task
                              </button>
                            </div>
                          )}

                          {task.status === STATUS.PendingApproval && (
                            <div className="button-group">
                              <button
                                onClick={() => handleApproveWork(task.id)}
                                disabled={loading || wrongNetwork}
                                className="btn-success"
                              >
                                ✅ Approve Work & Release Payment
                              </button>
                            </div>
                          )}

                          {task.status === STATUS.InProgress && (
                            <div className="pending-approval">⏳ In progress (waiting for submit)</div>
                          )}

                          {task.status === STATUS.Completed && (
                            <div className="completion-message">✅ Completed & approved</div>
                          )}

                          {task.status === STATUS.Cancelled && (
                            <div className="completion-message">🚫 Cancelled</div>
                          )}
                        </div>
                      );
                    })}
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
                          <span>📅 Deadline: {formatDateTime(task.deadline)}</span>
                          <span>👤 Creator: {formatAddress(task.creator)}</span>
                        </div>

                        {task.status === STATUS.InProgress && (
                          <button
                            onClick={() => handleSubmitWork(task.id)}
                            disabled={loading || wrongNetwork}
                            className="btn-success"
                          >
                            ✅ Submit Work for Review
                          </button>
                        )}

                        {task.status === STATUS.PendingApproval && (
                          <div className="pending-approval">⏳ Waiting for creator approval...</div>
                        )}

                        {task.status === STATUS.Completed && (
                          <div className="completion-message">✅ Approved! Reward is withdrawable.</div>
                        )}

                        {task.status === STATUS.Cancelled && (
                          <div className="completion-message">🚫 Cancelled</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Create */}
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
                    placeholder="e.g., Make a landing page"
                    disabled={wrongNetwork}
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
                    placeholder="Describe what needs to be done..."
                    disabled={wrongNetwork}
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
                      placeholder="0.05"
                      disabled={wrongNetwork}
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
                      disabled={wrongNetwork}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading || wrongNetwork} className="btn-primary">
                  {loading ? "Creating..." : "Create Task"}
                </button>

                {wrongNetwork && (
                  <div className="warning" style={{ marginTop: 12 }}>
                    Switch MetaMask to Sepolia to create tasks.
                  </div>
                )}
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
