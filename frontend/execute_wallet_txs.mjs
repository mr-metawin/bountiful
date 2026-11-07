import { createWalletClient, createPublicClient, http, parseEther, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';

// Contract configuration
const addressData = JSON.parse(fs.readFileSync('./src/contracts/address.json', 'utf8'));
const bountifulAddress = addressData.address;
const bountifulAbi = JSON.parse(fs.readFileSync('./src/contracts/Bountiful.json', 'utf8'));

const botTestnet = defineChain({
  id: 968,
  name: 'BOT Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'BOT',
    symbol: 'BOT',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.bohr.life'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BohrScan',
      url: 'https://scan.bohr.life',
    },
  },
});

// Parse ../.env
const envContent = fs.readFileSync('../.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [k, ...v] = trimmed.split('=');
    env[k.trim()] = v.join('=').trim();
  }
}

const w1Account = privateKeyToAccount(env.WALLET_1_PRIVATE_KEY);
const w2Account = privateKeyToAccount(env.WALLET_2_PRIVATE_KEY);
const w3Account = privateKeyToAccount(env.WALLET_3_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: botTestnet,
  transport: http('https://rpc.bohr.life'),
});

function getWalletClient(account) {
  return createWalletClient({
    account,
    chain: botTestnet,
    transport: http('https://rpc.bohr.life'),
  });
}

const w1Client = getWalletClient(w1Account);
const w2Client = getWalletClient(w2Account);
const w3Client = getWalletClient(w3Account);

console.log('=== Executing 24 Transactions on BOT Testnet for Bountiful ===');
console.log(`Bountiful Address: ${bountifulAddress}`);
console.log(`Wallet 1: ${w1Account.address}`);
console.log(`Wallet 2: ${w2Account.address}`);
console.log(`Wallet 3: ${w3Account.address}\n`);

const summary = {
  contract: bountifulAddress,
  chainId: 968,
  network: 'BOT Testnet',
  wallets: {
    wallet1: { address: w1Account.address, txs: [] },
    wallet2: { address: w2Account.address, txs: [] },
    wallet3: { address: w3Account.address, txs: [] },
  },
  allTransactions: [],
};

async function runTx(walletNum, client, account, description, writeCall) {
  console.log(`[W${walletNum}] Action: ${description}...`);
  let attempts = 0;
  while (attempts < 5) {
    try {
      const hash = await writeCall();
      console.log(`  Tx sent: ${hash}. Waiting for confirmation...`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`Tx reverted onchain: ${hash}`);
      }
      console.log(`  Confirmed in block ${receipt.blockNumber} (gasUsed: ${receipt.gasUsed})`);

      const txRecord = {
        wallet: `Wallet ${walletNum}`,
        address: account.address,
        action: description,
        hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: Number(receipt.gasUsed),
        explorerUrl: `https://scan.bohr.life/tx/${hash}`,
      };

      summary.wallets[`wallet${walletNum}`].txs.push(txRecord);
      summary.allTransactions.push(txRecord);
      return receipt;
    } catch (err) {
      attempts++;
      console.error(`  Attempt ${attempts} failed: ${err.message}`);
      if (attempts >= 5) throw err;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

async function main() {
  // --- Cycle 1: Bounty #1 ---
  console.log('\n--- Bounty 1 Cycle ---');
  await runTx(1, w1Client, w1Account, '1. createBounty: Write BOT Testnet Validator Guide (0.005 BOT)', async () => {
    return w1Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'createBounty',
      args: ['Write BOT Testnet Validator Guide', 'Step-by-step tutorial for spinning up a node on BOT Testnet', 7, 3],
      value: parseEther('0.005'),
    });
  });

  await runTx(2, w2Client, w2Account, '1. submit: Solution to Bounty #1 (W2)', async () => {
    return w2Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'submit',
      args: [1n, 'Guide submitted: Complete guide with systemd setup and RPC endpoints at https://gist.github.com/bot-validator-guide'],
    });
  });

  await runTx(3, w3Client, w3Account, '1. submit: Solution to Bounty #1 (W3)', async () => {
    return w3Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'submit',
      args: [1n, 'Alternative guide submitted: Docker-compose setup with automated telemetry and alerts at https://github.com/bot-docker'],
    });
  });

  await runTx(1, w1Client, w1Account, '2. selectWinner: Award Bounty #1 to W2', async () => {
    return w1Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'selectWinner',
      args: [1n, 0n],
    });
  });

  await runTx(2, w2Client, w2Account, '2. withdraw: Claim Bounty #1 Reward (W2)', async () => {
    return w2Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'withdraw',
    });
  });

  // --- Cycle 2: Bounty #2 ---
  console.log('\n--- Bounty 2 Cycle ---');
  await runTx(2, w2Client, w2Account, '3. createBounty: Design BOT Ecosystem Vector Icon Pack (0.005 BOT)', async () => {
    return w2Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'createBounty',
      args: ['Design BOT Ecosystem Vector Icon Pack', 'Set of 10 SVG icons representing DeFi and staking on BOT Chain', 5, 2],
      value: parseEther('0.005'),
    });
  });

  await runTx(1, w1Client, w1Account, '3. submit: Solution to Bounty #2 (W1)', async () => {
    return w1Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'submit',
      args: [2n, 'Icon pack deliverable: 10 clean SVGs with dark/light mode variants at https://figma.com/@bot-icons'],
    });
  });

  await runTx(3, w3Client, w3Account, '2. submit: Solution to Bounty #2 (W3)', async () => {
    return w3Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'submit',
      args: [2n, 'Submitting high-contrast minimalist glyphs in SVG and PNG formats at https://drive.google.com/bot-glyphs'],
    });
  });

  await runTx(2, w2Client, w2Account, '4. selectWinner: Award Bounty #2 to W3', async () => {
    return w2Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'selectWinner',
      args: [2n, 1n],
    });
  });

  await runTx(3, w3Client, w3Account, '3. withdraw: Claim Bounty #2 Reward (W3)', async () => {
    return w3Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'withdraw',
    });
  });

  // --- Cycle 3: Bounty #3 ---
  console.log('\n--- Bounty 3 Cycle ---');
  await runTx(3, w3Client, w3Account, '4. createBounty: Foundry Fuzz Testing Suite for DEX Router (0.005 BOT)', async () => {
    return w3Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'createBounty',
      args: ['Foundry Fuzz Testing Suite for DEX Router', 'Implement 500-run invariant tests for automated market maker router', 6, 4],
      value: parseEther('0.005'),
    });
  });

  await runTx(1, w1Client, w1Account, '4. submit: Solution to Bounty #3 (W1)', async () => {
    return w1Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'submit',
      args: [3n, 'Audit test suite delivered: Echidna and Foundry invariant tests covering k=x*y conservation at https://github.com/bot-dex-invariants'],
    });
  });

  await runTx(2, w2Client, w2Account, '5. submit: Solution to Bounty #3 (W2)', async () => {
    return w2Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'submit',
      args: [3n, 'Delivered comprehensive test repo with Medusa and symbolic execution reports at https://github.com/bot-router-fuzz'],
    });
  });

  await runTx(3, w3Client, w3Account, '5. selectWinner: Award Bounty #3 to W1', async () => {
    return w3Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'selectWinner',
      args: [3n, 0n],
    });
  });

  await runTx(1, w1Client, w1Account, '5. withdraw: Claim Bounty #3 Reward (W1)', async () => {
    return w1Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'withdraw',
    });
  });

  // --- Cycle 4: Bounty #4 (Cancellation Test) ---
  console.log('\n--- Bounty 4 Cycle ---');
  await runTx(1, w1Client, w1Account, '6. createBounty: Draft Community Governance Proposal RFC-04 (0.004 BOT)', async () => {
    return w1Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'createBounty',
      args: ['Draft Community Governance Proposal RFC-04', 'Draft RFC for quadratic funding grant round on BOT Chain', 5, 2],
      value: parseEther('0.004'),
    });
  });

  await runTx(1, w1Client, w1Account, '7. cancelBounty: Cancel Bounty #4 with 0 Submissions', async () => {
    return w1Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'cancelBounty',
      args: [4n],
    });
  });

  await runTx(1, w1Client, w1Account, '8. withdraw: Reclaim Cancelled Bounty #4 Refund (W1)', async () => {
    return w1Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'withdraw',
    });
  });

  // --- Cycle 5: Bounty #5 ---
  console.log('\n--- Bounty 5 Cycle ---');
  await runTx(2, w2Client, w2Account, '6. createBounty: Telegram Alert Bot for BohrScan Blocks (0.005 BOT)', async () => {
    return w2Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'createBounty',
      args: ['Telegram Alert Bot for BohrScan Blocks', 'Lightweight python bot sending block and gas notifications', 4, 3],
      value: parseEther('0.005'),
    });
  });

  await runTx(3, w3Client, w3Account, '6. submit: Solution to Bounty #5 (W3)', async () => {
    return w3Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'submit',
      args: [5n, 'Bot created and live: @BohrScanAlertsBot on Telegram running on serverless lambda'],
    });
  });

  await runTx(2, w2Client, w2Account, '7. selectWinner: Award Bounty #5 to W3', async () => {
    return w2Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'selectWinner',
      args: [5n, 0n],
    });
  });

  await runTx(3, w3Client, w3Account, '7. withdraw: Claim Bounty #5 Reward (W3)', async () => {
    return w3Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'withdraw',
    });
  });

  // --- Cycle 6: Bounty #6 ---
  console.log('\n--- Bounty 6 Cycle ---');
  await runTx(3, w3Client, w3Account, '8. createBounty: Curate Top 10 BOT Ecosystem Projects (0.005 BOT)', async () => {
    return w3Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'createBounty',
      args: ['Curate Top 10 BOT Ecosystem Projects', 'Write an analytical summary thread reviewing top protocols on BOT Chain', 5, 2],
      value: parseEther('0.005'),
    });
  });

  await runTx(2, w2Client, w2Account, '8. submit: Solution to Bounty #6 (W2)', async () => {
    return w2Client.writeContract({
      address: bountifulAddress,
      abi: bountifulAbi,
      functionName: 'submit',
      args: [6n, 'Thread submitted: Comprehensive 12-tweet breakdown covering DEXs, Bridges, and Tooling with charts'],
    });
  });

  console.log('\n=== All 24 Transactions Successfully Completed! ===');
  console.log(`Wallet 1: ${summary.wallets.wallet1.txs.length} txs`);
  console.log(`Wallet 2: ${summary.wallets.wallet2.txs.length} txs`);
  console.log(`Wallet 3: ${summary.wallets.wallet3.txs.length} txs`);

  fs.writeFileSync('../transactions_summary.json', JSON.stringify(summary, null, 2));
  fs.writeFileSync('./transactions_summary.json', JSON.stringify(summary, null, 2));
  console.log('Saved to transactions_summary.json');
}

main().catch((err) => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
