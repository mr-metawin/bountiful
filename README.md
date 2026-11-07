# Bountiful

> **Post a task. Pay the best answer.**

Bountiful is a decentralized, trustless bounty board operating on the BOT Testnet. A poster creates a task and locks a native BOT reward in the smart contract. Anyone (except the poster) can submit a solution. The poster picks the best submission, and the winner gets the reward.

Fairness and balance protection are mathematically guaranteed onchain:
- **No rugging workers:** The poster can only cancel while there are zero submissions. Once anyone submits work, the poster cannot cancel.
- **Abandonment protection:** If the poster goes silent after receiving submissions, the reward is automatically split equally among all submitters after the review deadline. Work is never left unpaid.
- **Pull payouts:** Rewards and refunds are credited to `pendingBalance`. Funds leave only via `withdraw()`, protecting everyone from malicious or rejecting recipients.
- **Zero fees:** 100% of the locked reward goes directly to workers.
- **Pure text:** Everything is stored onchain as plain text. No IPFS, no backend, no file uploads.

---

## Network & Deployed Contract

- **Network:** BOT Testnet
- **Chain ID:** `968`
- **Native Currency:** `BOT` (18 decimals)
- **RPC Endpoint:** `https://rpc.bohr.life`
- **Explorer:** [https://scan.bohr.life/](https://scan.bohr.life/)
- **Deployed Contract Address:** [`0x9D67fFa376b94b44804b75d0006D37e6C8a5Cab2`](https://scan.bohr.life/address/0x9D67fFa376b94b44804b75d0006D37e6C8a5Cab2)
- **Explorer Contract Verification:** [Verified on BohrScan](https://scan.bohr.life/address/0x9d67ffa376b94b44804b75d0006d37e6c8a5cab2)

---

## Roles and Responsibilities

| Role | Permissions & Capabilities |
| :--- | :--- |
| **Poster** | Creates the task, locks the native BOT reward, sets the submission window (1–90 days) and review window (1–14 days). May pick a winner at any time before the review deadline. Can cancel only if `submissionCount == 0`. |
| **Worker** | Anyone other than the poster. Can submit exactly one plain-text solution per bounty while submissions are open (up to `MAX_SUBMISSIONS = 50`). If selected as winner, receives 100% of the reward. |
| **Anyone (Community)** | If the poster abandons the bounty and fails to select a winner past the review deadline, any caller can trigger `splitIfAbandoned` to distribute the reward equally among all submitters. |

---

## Lifecycle States

```text
               ┌───────────────┐
               │ createBounty  │
               └───────┬───────┘
                       ▼
                 ┌───────────┐
      ┌──────────┤   Open    ├──────────┐
      │          └─────┬─────┘          │
      │ cancelBounty   │ selectWinner   │ splitIfAbandoned
(only if 0 subs)       │ (poster picks) │ (now > reviewDeadline)
      │                │                │
      ▼                ▼                ▼
┌───────────┐    ┌───────────┐    ┌───────────┐
│ Cancelled │    │  Awarded  │    │   Split   │
└───────────┘    └───────────┘    └───────────┘
```

1. **Open (Accepting Submissions):** Workers submit answers. Poster can award early if an outstanding solution arrives. Poster can cancel *only* if 0 submissions exist.
2. **Open (In Review):** Submissions are closed (`now > submissionDeadline`). Poster has until `reviewDeadline` to select the winning submission.
3. **Awarded (Terminal):** Poster chose a winning submission. Full reward credited to the winner's `pendingBalance`. All further actions blocked.
4. **Cancelled (Terminal):** Poster cancelled before any submissions arrived. Full reward refunded to poster's `pendingBalance`.
5. **Split (Terminal):** Review deadline expired without poster action. Reward split equally across all submitters (remainder to 1st worker).

---

## Setup, Test, Deploy, and Run

### 1. Prerequisites
- **Foundry:** `forge` and `cast` installed.
- **Node.js:** v18+ and `npm`.

### 2. Smart Contract Tests (`contracts/`)
Run the test suite including 41 unit/fuzz tests and invariant tests:
```bash
cd contracts
forge test
```
To run tests with full trace output:
```bash
forge test -vvv
```

### 3. Contract Deployment
Deploy using a cast keystore wallet:
```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.bohr.life \
  --account bountiful \
  --password-file <path-to-password-file> \
  --broadcast
```

### 4. Running the Frontend (`frontend/`)
Start the Vite development server:
```bash
cd frontend
npm run dev
```
Open [http://localhost:5174/](http://localhost:5174/) (or the port reported by Vite) in your browser. Connect MetaMask or any injected Web3 wallet and switch to BOT Testnet (Chain ID 968).

---

## Trust and Security Notes

- **Subjective Winner Selection:** The poster alone decides the winner. Evaluating task quality is a human judgment call that the smart contract cannot verify onchain. Workers should review the poster's terms and track record before submitting.
- **Guaranteed Paths & No Escrow Trap:** Locked native BOT rewards can only leave the contract through the 3 strictly enforced paths:
  1. `selectWinner`: Poster awards full prize to a worker.
  2. `cancelBounty`: Poster refunds their deposit, only allowed when 0 submissions exist.
  3. `splitIfAbandoned`: If the poster disappears, the contract splits the reward among submitters. Funds are never permanently stuck.
- **Pull-Based Withdrawals:** Balance updates use pull-over-push semantics via `pendingBalance` and `withdraw()`. A worker or poster contract that rejects BOT transfers cannot DOS or block payouts for any other participant.
- **Reentrancy Protection:** All balance-modifying routines use OpenZeppelin's `nonReentrant` and adhere to Checks-Effects-Interactions (CEI).
- **Testnet Demo Notice:** This application is deployed on the BOT Testnet (Chain ID 968) for demonstration and evaluation purposes. It has not undergone an independent third-party security audit.
