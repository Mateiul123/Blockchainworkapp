import { useEffect, useState } from "react";
import "./App.css";
import { connectWallet, getCounterValue, incrementCounter } from "./utils/CounterEthersUtils.jsx";

function App() {
  const [account, setAccount] = useState(null);
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadValue = async () => {
    try {
      setError("");
      const v = await getCounterValue();
      setValue(v);
    } catch (e) {
      console.error(e);
      setError("Failed to load counter value");
    }
  };

  useEffect(() => {
    // try to load value on start (will fail if not deployed or no provider)
    loadValue().catch(() => {});
  }, []);

  const handleConnect = async () => {
    try {
      setError("");
      const acc = await connectWallet();
      setAccount(acc);
      await loadValue();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to connect wallet");
    }
  };

  const handleIncrement = async () => {
    try {
      setLoading(true);
      setError("");
      await incrementCounter();
      await loadValue();
    } catch (e) {
      console.error(e);
      setError("Failed to send transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <h1>Simple Counter Dapp</h1>
      <button onClick={handleConnect}>
        {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect MetaMask"}
      </button>

      <div style={{ marginTop: "1rem" }}>
        <p>Counter value on chain: {value === null ? "?" : value}</p>
      </div>

      <button onClick={handleIncrement} disabled={!account || loading}>
        {loading ? "Incrementing..." : "Increment"}
      </button>

      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>
      )}
    </div>
  );
}

export default App;
