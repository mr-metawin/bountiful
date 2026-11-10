import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from 'viem';
import { contractAddress, bountifulAbi, botMainnet } from './contracts';
import botLogo from './assets/bot-logo.svg';
import {
  Bounty,
  Submission,
  FilterTab,
  SortOption,
  TxStatus,
  ContractConstants,
} from './types';
import { parseContractError } from './utils';
import { Header } from './components/Header';
import { TxBanner } from './components/TxBanner';
import { PendingBalanceBanner } from './components/PendingBalanceBanner';
import { BountyCard } from './components/BountyCard';
import { BountyDetail } from './components/BountyDetail';
import { CreateBountyModal } from './components/CreateBountyModal';
import { HowItWorks } from './components/HowItWorks';
import './App.css';

const publicClient = createPublicClient({
  chain: botMainnet,
  transport: http('https://rpc.botchain.ai'),
});

const DEFAULT_CONSTANTS: ContractConstants = {
  maxSubmissions: 50,
  minTitleLength: 1,
  maxTitleLength: 100,
  minDescriptionLength: 1,
  maxDescriptionLength: 1000,
  minContentLength: 1,
  maxContentLength: 1000,
  minSubmissionDays: 1,
  maxSubmissionDays: 90,
  minReviewDays: 1,
  maxReviewDays: 14,
};

export const App: React.FC = () => {
  // Wallet & Network State
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  // Contract Constants State
  const [constants, setConstants] = useState<ContractConstants>(DEFAULT_CONSTANTS);

  // Bounties & Financial State
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [userPendingBalance, setUserPendingBalance] = useState<bigint>(0n);
  const [userSubmittedIds, setUserSubmittedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter & Search State
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Bounty & Routing State
  const [selectedBountyId, setSelectedBountyId] = useState<bigint | null>(null);
  const [selectedSubmissions, setSelectedSubmissions] = useState<Submission[]>([]);
  const [hasUserSubmittedSelected, setHasUserSubmittedSelected] = useState(false);

  // Modal and Action State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>({ state: 'idle' });

  // Load contract constants on mount
  useEffect(() => {
    const loadConstants = async () => {
      try {
        const [
          maxSubs,
          minTitle,
          maxTitle,
          minDesc,
          maxDesc,
          minContent,
          maxContent,
          minSubDays,
          maxSubDays,
          minRevDays,
          maxRevDays,
        ] = await Promise.all([
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MAX_SUBMISSIONS' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MIN_TITLE_LENGTH' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MAX_TITLE_LENGTH' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MIN_DESCRIPTION_LENGTH' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MAX_DESCRIPTION_LENGTH' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MIN_CONTENT_LENGTH' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MAX_CONTENT_LENGTH' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MIN_SUBMISSION_DAYS' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MAX_SUBMISSION_DAYS' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MIN_REVIEW_DAYS' }),
          publicClient.readContract({ address: contractAddress, abi: bountifulAbi, functionName: 'MAX_REVIEW_DAYS' }),
        ]);

        setConstants({
          maxSubmissions: Number(maxSubs),
          minTitleLength: Number(minTitle),
          maxTitleLength: Number(maxTitle),
          minDescriptionLength: Number(minDesc),
          maxDescriptionLength: Number(maxDesc),
          minContentLength: Number(minContent),
          maxContentLength: Number(maxContent),
          minSubmissionDays: Number(minSubDays),
          maxSubmissionDays: Number(maxSubDays),
          minReviewDays: Number(minRevDays),
          maxReviewDays: Number(maxRevDays),
        });
      } catch (err) {
        console.warn('Could not load constants dynamically, using default values', err);
      }
    };

    loadConstants();
  }, []);

  // Switch to BOT Mainnet
  const switchToBotMainnet = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2a5' }], // 677 in hex
      });
      setChainId(677);
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x2a5',
                chainName: 'BOT Mainnet',
                nativeCurrency: {
                  name: 'BOT',
                  symbol: 'BOT',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc.botchain.ai'],
                blockExplorerUrls: ['https://scan.botchain.ai'],
              },
            ],
          });
          setChainId(677);
        } catch (addError) {
          console.error('Failed to add BOT Mainnet:', addError);
        }
      } else {
        console.error('Failed to switch network:', switchError);
      }
    }
  };

  // Get authorized wallet client
  const getAuthorizedWalletClient = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Please install MetaMask or another Web3 wallet.');
    }

    const accounts: string[] = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No authorized account found.');
    }

    const activeAccount = accounts[0] as `0x${string}`;
    setAccount(activeAccount);

    const currentChainHex = await window.ethereum.request({ method: 'eth_chainId' });
    const currentChain = parseInt(currentChainHex, 16);
    setChainId(currentChain);

    if (currentChain !== botMainnet.id) {
      await switchToBotMainnet();
    }

    const client = createWalletClient({
      account: activeAccount,
      chain: botMainnet,
      transport: custom(window.ethereum),
    });

    return { client, account: activeAccount };
  };

  // Connect wallet
  const connectWallet = async () => {
    try {
      const { account: activeAccount } = await getAuthorizedWalletClient();
      setAccount(activeAccount);
      setTxStatus({ state: 'idle' });
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setTxStatus({
        state: 'error',
        message: parseContractError(err),
      });
    }
  };

  // Listen for account/chain changes in wallet
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0] as `0x${string}`);
      } else {
        setAccount(null);
      }
    };

    const handleChainChanged = (chainHex: string) => {
      setChainId(parseInt(chainHex, 16));
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);

    // Initial check if already connected
    window.ethereum.request?.({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0] as `0x${string}`);
        window.ethereum.request?.({ method: 'eth_chainId' }).then((hex: string) => {
          setChainId(parseInt(hex, 16));
        });
      }
    });

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
    };
  }, []);

  // Fetch all bounties from contract
  const fetchBounties = useCallback(async () => {
    try {
      setFetchError(null);
      // Fetch up to 100 bounties (newest first)
      const [rawBounties] = await publicClient.readContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'getBounties',
        args: [0n, 100n],
      });

      const formatted: Bounty[] = rawBounties.map((b) => ({
        id: b.id,
        poster: b.poster,
        title: b.title,
        description: b.description,
        reward: b.reward,
        createdAt: b.createdAt,
        submissionDeadline: b.submissionDeadline,
        reviewDeadline: b.reviewDeadline,
        submissionCount: b.submissionCount,
        winner: b.winner,
        status: b.status as any,
      }));

      setBounties(formatted);
    } catch (err: any) {
      console.error('Error fetching bounties:', err);
      setFetchError('Failed to fetch bounties from contract.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user pending balance and submitted bounty IDs
  const fetchUserData = useCallback(async () => {
    if (!account) {
      setUserPendingBalance(0n);
      setUserSubmittedIds(new Set());
      return;
    }

    try {
      const balance = await publicClient.readContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'pendingBalance',
        args: [account],
      });
      setUserPendingBalance(balance);

      const [submittedIds] = await publicClient.readContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'getSubmittedIds',
        args: [account, 0n, 100n],
      });
      setUserSubmittedIds(new Set(submittedIds.map((id) => id.toString())));
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  }, [account]);

  // Fetch details & submissions for selected bounty
  const fetchSelectedBountyDetails = useCallback(async (bountyId: bigint) => {
    try {
      const [subs] = await publicClient.readContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'getSubmissions',
        args: [bountyId, 0n, 50n],
      });

      setSelectedSubmissions(
        subs.map((s) => ({
          worker: s.worker,
          content: s.content,
          submittedAt: s.submittedAt,
        }))
      );

      if (account) {
        const submitted = await publicClient.readContract({
          address: contractAddress,
          abi: bountifulAbi,
          functionName: 'hasSubmitted',
          args: [bountyId, account],
        });
        setHasUserSubmittedSelected(submitted);
      } else {
        setHasUserSubmittedSelected(false);
      }
    } catch (err) {
      console.error('Error loading submissions for bounty', bountyId, err);
    }
  }, [account]);

  // Initial and Polling effect
  useEffect(() => {
    fetchBounties();
    const interval = setInterval(() => {
      fetchBounties();
      fetchUserData();
      if (selectedBountyId) {
        fetchSelectedBountyDetails(selectedBountyId);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchBounties, fetchUserData, fetchSelectedBountyDetails, selectedBountyId]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Hash-based routing (#/bounty/:id)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/bounty\/(\d+)$/);
      if (match) {
        const id = BigInt(match[1]);
        setSelectedBountyId(id);
      } else {
        setSelectedBountyId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // When selected bounty changes, fetch its submissions
  useEffect(() => {
    if (selectedBountyId) {
      fetchSelectedBountyDetails(selectedBountyId);
    }
  }, [selectedBountyId, fetchSelectedBountyDetails]);

  // Navigate to bounty
  const handleSelectBounty = (id: bigint) => {
    window.location.hash = `#/bounty/${id.toString()}`;
    setSelectedBountyId(id);
  };

  // Back to board
  const handleBackToBoard = () => {
    window.location.hash = '';
    setSelectedBountyId(null);
  };

  // --- Transactions ---

  // Create Bounty
  const handleCreateBounty = async (
    title: string,
    description: string,
    submissionDays: number,
    reviewDays: number,
    rewardWei: bigint
  ) => {
    setIsActionLoading(true);
    setTxStatus({ state: 'pending', message: 'Submitting bounty creation...' });

    try {
      const { client, account: activeAccount } = await getAuthorizedWalletClient();
      const hash = await client.writeContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'createBounty',
        args: [title, description, submissionDays, reviewDays],
        value: rewardWei,
        account: activeAccount,
      });

      setTxStatus({
        state: 'pending',
        message: 'Transaction sent, awaiting confirmation on BOT testnet...',
        hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        setTxStatus({
          state: 'success',
          message: 'Bounty created successfully!',
          hash,
        });
        await fetchBounties();
        await fetchUserData();
      } else {
        setTxStatus({ state: 'error', message: 'Transaction failed onchain.', hash });
      }
    } catch (err: any) {
      console.error('Error creating bounty:', err);
      setTxStatus({ state: 'error', message: parseContractError(err) });
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };

  // Submit Solution
  const handleSubmitSolution = async (bountyId: bigint, content: string) => {
    setIsActionLoading(true);
    setTxStatus({ state: 'pending', message: 'Submitting solution to blockchain...' });

    try {
      const { client, account: activeAccount } = await getAuthorizedWalletClient();
      const hash = await client.writeContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'submit',
        args: [bountyId, content],
        account: activeAccount,
      });

      setTxStatus({
        state: 'pending',
        message: 'Awaiting block confirmation...',
        hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        setTxStatus({
          state: 'success',
          message: 'Solution successfully submitted!',
          hash,
        });
        await fetchBounties();
        await fetchSelectedBountyDetails(bountyId);
        await fetchUserData();
      } else {
        setTxStatus({ state: 'error', message: 'Submission failed onchain.', hash });
      }
    } catch (err: any) {
      console.error('Error submitting solution:', err);
      setTxStatus({ state: 'error', message: parseContractError(err) });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Select Winner
  const handleSelectWinner = async (bountyId: bigint, submissionIndex: number) => {
    setIsActionLoading(true);
    setTxStatus({ state: 'pending', message: 'Awarding winner...' });

    try {
      const { client, account: activeAccount } = await getAuthorizedWalletClient();
      const hash = await client.writeContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'selectWinner',
        args: [bountyId, BigInt(submissionIndex)],
        account: activeAccount,
      });

      setTxStatus({
        state: 'pending',
        message: 'Awaiting confirmation of winner selection...',
        hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        setTxStatus({
          state: 'success',
          message: 'Winner selected! Reward credited to winner.',
          hash,
        });
        await fetchBounties();
        await fetchSelectedBountyDetails(bountyId);
        await fetchUserData();
      } else {
        setTxStatus({ state: 'error', message: 'Winner selection failed onchain.', hash });
      }
    } catch (err: any) {
      console.error('Error selecting winner:', err);
      setTxStatus({ state: 'error', message: parseContractError(err) });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Cancel Bounty
  const handleCancelBounty = async (bountyId: bigint) => {
    setIsActionLoading(true);
    setTxStatus({ state: 'pending', message: 'Cancelling bounty...' });

    try {
      const { client, account: activeAccount } = await getAuthorizedWalletClient();
      const hash = await client.writeContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'cancelBounty',
        args: [bountyId],
        account: activeAccount,
      });

      setTxStatus({
        state: 'pending',
        message: 'Awaiting cancellation confirmation...',
        hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        setTxStatus({
          state: 'success',
          message: 'Bounty cancelled! Full reward credited to your withdrawable balance.',
          hash,
        });
        await fetchBounties();
        await fetchSelectedBountyDetails(bountyId);
        await fetchUserData();
      } else {
        setTxStatus({ state: 'error', message: 'Cancellation failed onchain.', hash });
      }
    } catch (err: any) {
      console.error('Error cancelling bounty:', err);
      setTxStatus({ state: 'error', message: parseContractError(err) });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Split Reward (Abandoned review)
  const handleSplitReward = async (bountyId: bigint) => {
    setIsActionLoading(true);
    setTxStatus({ state: 'pending', message: 'Triggering abandoned reward split...' });

    try {
      const { client, account: activeAccount } = await getAuthorizedWalletClient();
      const hash = await client.writeContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'splitIfAbandoned',
        args: [bountyId],
        account: activeAccount,
      });

      setTxStatus({
        state: 'pending',
        message: 'Awaiting split transaction confirmation...',
        hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        setTxStatus({
          state: 'success',
          message: 'Reward split equally among all submitters!',
          hash,
        });
        await fetchBounties();
        await fetchSelectedBountyDetails(bountyId);
        await fetchUserData();
      } else {
        setTxStatus({ state: 'error', message: 'Split failed onchain.', hash });
      }
    } catch (err: any) {
      console.error('Error splitting reward:', err);
      setTxStatus({ state: 'error', message: parseContractError(err) });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Withdraw pending balance
  const handleWithdraw = async () => {
    setWithdrawing(true);
    setTxStatus({ state: 'pending', message: 'Withdrawing your BOT balance...' });

    try {
      const { client, account: activeAccount } = await getAuthorizedWalletClient();
      const hash = await client.writeContract({
        address: contractAddress,
        abi: bountifulAbi,
        functionName: 'withdraw',
        account: activeAccount,
      });

      setTxStatus({
        state: 'pending',
        message: 'Awaiting withdrawal confirmation...',
        hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        setTxStatus({
          state: 'success',
          message: 'BOT funds withdrawn directly to your wallet!',
          hash,
        });
        await fetchUserData();
      } else {
        setTxStatus({ state: 'error', message: 'Withdrawal failed onchain.', hash });
      }
    } catch (err: any) {
      console.error('Error withdrawing funds:', err);
      setTxStatus({ state: 'error', message: parseContractError(err) });
    } finally {
      setWithdrawing(false);
    }
  };

  // Filtered and Sorted Bounties
  const filteredBounties = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));

    return bounties
      .filter((b) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesTitle = b.title.toLowerCase().includes(q);
          const matchesId = b.id.toString() === q;
          if (!matchesTitle && !matchesId) return false;
        }

        // Tab filter
        if (activeTab === 'open') {
          return b.status === 0;
        }
        if (activeTab === 'closed') {
          return b.status !== 0;
        }
        if (activeTab === 'posted') {
          return !!account && b.poster.toLowerCase() === account.toLowerCase();
        }
        if (activeTab === 'submitted') {
          return userSubmittedIds.has(b.id.toString());
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'highest') {
          return b.reward > a.reward ? 1 : b.reward < a.reward ? -1 : 0;
        }
        if (sortOption === 'ending') {
          // If open, sort by submission deadline ascending; otherwise by id descending
          if (a.status === 0 && b.status === 0) {
            const aDiff = a.submissionDeadline > now ? a.submissionDeadline - now : 999999999n;
            const bDiff = b.submissionDeadline > now ? b.submissionDeadline - now : 999999999n;
            return aDiff > bDiff ? 1 : aDiff < bDiff ? -1 : 0;
          }
          return Number(b.id - a.id);
        }
        // Default: newest first
        return Number(b.id - a.id);
      });
  }, [bounties, searchQuery, activeTab, sortOption, account, userSubmittedIds]);

  const selectedBounty = useMemo(() => {
    if (!selectedBountyId) return null;
    return bounties.find((b) => b.id === selectedBountyId) || null;
  }, [bounties, selectedBountyId]);

  return (
    <div className="bountiful-app">
      {/* Header */}
      <Header
        account={account}
        chainId={chainId}
        targetChainId={botMainnet.id}
        onConnect={connectWallet}
        onSwitchChain={switchToBotMainnet}
        onOpenPostModal={() => setIsPostModalOpen(true)}
        onLogoClick={handleBackToBoard}
      />

      {/* Main Container */}
      <main className="app-main">
        {/* Transaction Banner */}
        <TxBanner
          status={txStatus}
          onDismiss={() => setTxStatus({ state: 'idle' })}
        />

        {/* Pending Balance Banner */}
        <PendingBalanceBanner
          balance={userPendingBalance}
          withdrawing={withdrawing}
          onWithdraw={handleWithdraw}
        />

        {/* Detail View vs Board View */}
        {selectedBounty ? (
          <BountyDetail
            bounty={selectedBounty}
            submissions={selectedSubmissions}
            hasUserSubmitted={hasUserSubmittedSelected}
            userAddress={account}
            onBack={handleBackToBoard}
            onSubmitSolution={handleSubmitSolution}
            onSelectWinner={handleSelectWinner}
            onCancelBounty={handleCancelBounty}
            onSplitReward={handleSplitReward}
            isActionLoading={isActionLoading}
            constants={constants}
            onConnectWallet={connectWallet}
          />
        ) : (
          <div className="board-container">
            {/* Hero / Header Tagline Section */}
            <section className="board-hero">
              <div className="hero-content">
                <span className="hero-badge">⚡ Decentralized Bounty Protocol</span>
                <h2 className="hero-title">Post a task. Pay the best answer.</h2>
                <p className="hero-desc">
                  Lock native BOT rewards in trustless smart contracts. Open submissions, protected review
                  deadlines, and automatic split guarantees if posters go silent.
                </p>
                <div className="hero-buttons">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => setIsPostModalOpen(true)}
                  >
                    Post a Bounty
                  </button>
                </div>
              </div>
            </section>

            {/* Collapsible How It Works */}
            <HowItWorks />

            {/* Board Controls: Tabs, Search, Sort */}
            <section className="board-controls">
              <div className="tabs-row">
                <div className="filter-tabs">
                  <button
                    className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    All ({bounties.length})
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'open' ? 'active' : ''}`}
                    onClick={() => setActiveTab('open')}
                  >
                    Open
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'closed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('closed')}
                  >
                    Closed
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'posted' ? 'active' : ''}`}
                    onClick={() => setActiveTab('posted')}
                  >
                    Posted by me
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'submitted' ? 'active' : ''}`}
                    onClick={() => setActiveTab('submitted')}
                  >
                    I submitted
                  </button>
                </div>

                <div className="sort-controls">
                  <label htmlFor="sort-select" className="sort-label">Sort by:</label>
                  <select
                    id="sort-select"
                    className="sort-select"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                  >
                    <option value="newest">Newest</option>
                    <option value="highest">Highest Reward</option>
                    <option value="ending">Ending Soon</option>
                  </select>
                </div>
              </div>

              <div className="search-row">
                <div className="search-input-wrap">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search tasks by title or #ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Board Grid */}
            <section className="bounties-grid-section">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Loading bounties from BOT Testnet...</p>
                </div>
              ) : fetchError ? (
                <div className="error-state">
                  <p>⚠️ {fetchError}</p>
                  <button className="btn btn-secondary" onClick={fetchBounties}>
                    Retry
                  </button>
                </div>
              ) : filteredBounties.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-emoji">🏜️</span>
                  <h3>No bounties found</h3>
                  <p>
                    {searchQuery
                      ? 'No tasks match your search query.'
                      : activeTab === 'posted'
                      ? 'You have not posted any bounties yet.'
                      : activeTab === 'submitted'
                      ? 'You have not submitted solutions to any bounties yet.'
                      : 'Be the first to post a task and lock a BOT reward!'}
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setIsPostModalOpen(true)}
                  >
                    Post a Bounty
                  </button>
                </div>
              ) : (
                <div className="bounties-grid">
                  {filteredBounties.map((bounty) => (
                    <BountyCard
                      key={bounty.id.toString()}
                      bounty={bounty}
                      userAddress={account}
                      onSelect={handleSelectBounty}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Post a Bounty Modal */}
      <CreateBountyModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSubmit={handleCreateBounty}
        isSubmitting={isActionLoading}
        constants={constants}
      />

      {/* App Footer */}
      <footer className="app-footer">
        <div className="footer-inner">
          {/* Section 1: Proof on bot mainnet */}
          <div className="footer-section-proof">
            <div className="footer-proof-box">
              <span className="proof-status-indicator">🟢 Proof on bot mainnet</span>
              <div className="proof-details">
                <span><strong>Chain ID:</strong> 677</span>
                <span className="proof-sep">•</span>
                <span>
                  <strong>Contract:</strong>{' '}
                  <a
                    href={`https://scan.botchain.ai/address/${contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="footer-contract-link font-mono"
                  >
                    {contractAddress}
                  </a>
                </span>
              </div>
            </div>

            <div className="footer-links-row">
              <a
                href="https://www.botchain.ai/en/"
                target="_blank"
                rel="noreferrer"
                className="footer-external-link"
              >
                BOT Chain Website
              </a>
              <span className="footer-links-sep">•</span>
              <a
                href="https://scan.botchain.ai/"
                target="_blank"
                rel="noreferrer"
                className="footer-external-link"
              >
                BOTScan explorer
              </a>
            </div>
          </div>

          {/* Section 2: Part of the Ecosystem */}
          <div className="ecosystem-section">
            <div className="ecosystem-header-label">PART OF THE ECOSYSTEM</div>

            <div className="ecosystem-logo-circle">
              <img src={botLogo} alt="BOT Chain Logo" className="ecosystem-logo" />
            </div>

            <h3 className="ecosystem-title">
              <span className="ecosystem-title-bot">BOT</span>
              <span className="ecosystem-title-chain"> Chain</span>
            </h3>

            <p className="ecosystem-tagline">
              Post a task. Pay the best answer.
            </p>

            <div className="ecosystem-divider">
              <span className="ecosystem-divider-line" />
              <span className="ecosystem-divider-diamond">◆</span>
              <span className="ecosystem-divider-line" />
            </div>

            <div className="ecosystem-links">
              <a
                href="https://www.botchain.ai/en/"
                target="_blank"
                rel="noreferrer"
                className="ecosystem-link"
              >
                <svg className="ecosystem-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>botchain.ai</span>
              </a>

              <a
                href="https://scan.botchain.ai/"
                target="_blank"
                rel="noreferrer"
                className="ecosystem-link"
              >
                <svg className="ecosystem-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Explorer</span>
              </a>
            </div>

            <div className="ecosystem-copyright">
              © 2026 <strong>BOT Chain</strong> · Mainnet · Chain ID <strong>677</strong>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
