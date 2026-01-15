# Task Marketplace - Deployment & Setup Guide

## 📋 Prerequisites

- Node.js 18+ installed
- MetaMask browser extension
- Sepolia testnet ETH (get from faucet)
- Git (optional)

## 🔧 Environment Setup

### 1. Install Dependencies

```bash
# Navigate to project root
cd Blockchainworkapp

# Install root dependencies
npm install

# Install contract dependencies
cd contracts
npm install
```

### 2. Configure Environment Variables

Create `.env` file in the `contracts` directory:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
SEPOLIA_PRIVATE_KEY=your_private_key_here
```

**Get Infura Key:**
1. Visit https://infura.io
2. Sign up for free
3. Create new Sepolia project
4. Copy the RPC URL

**Get Private Key:**
1. Open MetaMask
2. Click account → Settings → Security & Privacy → Reveal Secret Recovery Phrase
3. Derive private key (or use account export feature)

⚠️ **NEVER commit .env file to version control**

## 🚀 Deployment Steps

### 1. Compile Contracts

```bash
cd contracts
npx hardhat compile
```

Expected output:
```
Compiled 3 Solidity files successfully
```

### 2. Run Tests (Optional but Recommended)

```bash
npx hardhat test test/TaskMarketplace.ts
```

Expected output:
```
28 passing
```

### 3. Deploy to Sepolia

```bash
npx hardhat run ./scripts/deploy-taskmarketplace.ts --network sepolia
```

Expected output:
```
Deploying TaskMarketplace...
TaskMarketplace deployed to: 0x09033f764A3e2369Ae728fd001F1688aB88b8Fbc
Deployment info saved to deployed-addresses.json
```

### 4. Update Frontend Configuration

Copy the deployed contract address and update `src/App.jsx`:

```javascript
const SEPOLIA_CONTRACT_ADDRESS = "0x09033f764A3e2369Ae728fd001F1688aB88b8Fbc";
```

## 🎨 Frontend Setup

### 1. Install Frontend Dependencies

```bash
# From root directory
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Expected output:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 3. Open Application

1. Open browser to `http://localhost:5173`
2. You should see the "🎯 Task Marketplace" connect screen

## 🔌 Connect MetaMask

1. **Ensure Sepolia Network Selected**
   - MetaMask → Network dropdown → Sepolia

2. **Get Sepolia ETH**
   - Faucet: https://sepoliafaucet.com/
   - Alchemy: https://www.alchemy.com/faucets/ethereum-sepolia

3. **Click "Connect Wallet"**
   - Approve MetaMask connection
   - Grant permission to view account

4. **Verify Connection**
   - Should see "Connected to Sepolia network"
   - Account address displayed
   - ETH balance shown

## 📝 Usage Guide

### Creating a Task

1. Navigate to **➕ Create Task** tab
2. Fill in the form:
   - **Title**: Task name (max 100 chars)
   - **Description**: Detailed task description (max 1000 chars)
   - **Reward**: Amount in ETH (e.g., 0.1)
   - **Deadline**: Future date/time
3. Click **Create Task**
4. MetaMask will prompt for transaction approval
5. Task created! Check **🏪 Marketplace** to see it

### Taking a Task

1. Go to **🏪 Marketplace** tab
2. View all open tasks
3. Click **Take Task** on the task you want to do
4. MetaMask approval required
5. Task status changes to "InProgress"
6. Find it in **📋 My Tasks → Tasks I'm Working On**

### Completing a Task

1. Go to **📋 My Tasks**
2. In **Tasks I Created** section, find task with worker
3. Click **Mark Complete**
4. MetaMask approval required
5. Worker receives reward (minus 2% platform fee)

### Withdrawing Earnings

1. Completed tasks show in **Available to Withdraw**
2. Click **Withdraw** button in header
3. MetaMask approval required
4. Funds transferred to your wallet

## 🔍 Verifying Transactions

### View Transaction on Sepolia Etherscan

1. Get transaction hash from success message
2. Visit: https://sepolia.etherscan.io/
3. Paste transaction hash in search bar
4. View transaction details

### Check Contract on Etherscan

1. Visit: https://sepolia.etherscan.io/address/0x09033f764A3e2369Ae728fd001F1688aB88b8Fbc
2. View contract code and interactions
3. Monitor events in "Events" tab

## 🐛 Troubleshooting

### Issue: "MetaMask not installed!"
**Solution**: Install MetaMask extension from https://metamask.io/

### Issue: "Please switch to Sepolia network"
**Solution**: 
- Open MetaMask
- Click network dropdown at top
- Select "Sepolia" from list
- Refresh the page

### Issue: "Insufficient funds"
**Solution**: 
- Get Sepolia ETH from faucet
- https://sepoliafaucet.com/
- or https://www.alchemy.com/faucets/ethereum-sepolia

### Issue: "Transaction rejected by user"
**Solution**: Approve transaction in MetaMask popup

### Issue: "Contract address not configured"
**Solution**: Ensure you updated SEPOLIA_CONTRACT_ADDRESS in src/App.jsx with deployed address

### Issue: Network connection errors
**Solution**:
- Check internet connection
- Verify RPC URL in .env file
- Try refreshing the page
- Restart development server

## 📊 Monitoring Gas Costs

Each transaction displays gas used:
- **Task Creation**: ~120,000-150,000 gas
- **Taking Task**: ~70,000-90,000 gas
- **Completing Task**: ~85,000-110,000 gas
- **Withdrawal**: ~30,000-40,000 gas

Current Sepolia gas prices vary. Monitor at:
- https://sepolia.etherscan.io/gastracker

## 🔐 Security Notes

⚠️ **Never Share**:
- Private keys
- Seed phrases
- Secret recovery phrases
- Environment variables

✅ **Best Practices**:
- Use separate wallets for testing
- Never deploy from production accounts
- Verify contract addresses before interaction
- Test on testnet before mainnet
- Keep .env file in .gitignore

## 📚 Additional Resources

### Documentation
- Hardhat: https://hardhat.org/docs
- ethers.js: https://docs.ethers.org/v6/
- Solidity: https://docs.soliditylang.org/
- OpenZeppelin: https://docs.openzeppelin.com/

### Tools
- Sepolia Etherscan: https://sepolia.etherscan.io/
- MetaMask: https://metamask.io/
- Hardhat Plugins: https://hardhat.org/plugins
- OpenZeppelin Contracts: https://www.openzeppelin.com/contracts

## 🎓 Learning Path

1. **Week 1**: Smart contracts basics
   - Understand Solidity syntax
   - Study event-driven architecture
   - Learn about gas optimization

2. **Week 2**: Web3 integration
   - Learn ethers.js library
   - Understand provider/signer pattern
   - Study transaction handling

3. **Week 3**: Testing & Deployment
   - Write comprehensive tests
   - Deploy to testnet
   - Monitor on block explorer

4. **Week 4**: Frontend integration
   - Build React components
   - Implement wallet connection
   - Create user interface

## 💬 Support

For issues or questions:
1. Check troubleshooting section
2. Review contract code comments
3. Check Hardhat/ethers.js documentation
4. Debug using browser console
5. Check MetaMask logs

---

**Last Updated**: January 2026
**Network**: Sepolia Testnet
**Contract**: TaskMarketplace
