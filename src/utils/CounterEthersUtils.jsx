import { ethers } from "ethers";
import deployedAddresses from "../contracts/addresses.json";
import CounterArtifact from "../contracts/Counter.json";

const COUNTER_ADDRESS = deployedAddresses.counter;
const COUNTER_ABI = CounterArtifact.abi;

let provider;

if (typeof window !== "undefined" && window.ethereum) {
  provider = new ethers.BrowserProvider(window.ethereum);
}

export async function connectWallet() {
  if (!provider) {
    throw new Error("MetaMask not found");
  }
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

export async function getCounterValue() {
  if (!provider) {
    throw new Error("No provider");
  }
  const contract = new ethers.Contract(COUNTER_ADDRESS, COUNTER_ABI, provider);
  const value = await contract.x();
  return Number(value);
}

export async function incrementCounter() {
  if (!provider) {
    throw new Error("No provider");
  }
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(COUNTER_ADDRESS, COUNTER_ABI, signer);
  const tx = await contract.inc();
  await tx.wait();
}
