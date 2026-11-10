import React from 'react';
import { shortenAddress } from '../utils';
import appLogo from '../assets/logo.jpeg';

interface HeaderProps {
  account: `0x${string}` | null;
  chainId: number | null;
  targetChainId: number;
  onConnect: () => void;
  onSwitchChain: () => void;
  onOpenPostModal: () => void;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  chainId,
  targetChainId,
  onConnect,
  onSwitchChain,
  onOpenPostModal,
  onLogoClick,
}) => {
  const isWrongChain = !!account && chainId !== targetChainId;

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand" onClick={onLogoClick} role="button" tabIndex={0}>
          <img src={appLogo} alt="Bountiful Logo" className="brand-logo-img" />
          <div>
            <h1 className="brand-title">Bountiful</h1>
            <p className="brand-tagline">Post a task. Pay the best answer.</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary btn-post-bounty"
            onClick={onOpenPostModal}
          >
            <span className="btn-icon">＋</span> Post a Bounty
          </button>

          {isWrongChain ? (
            <button
              type="button"
              className="btn btn-warning btn-switch-net"
              onClick={onSwitchChain}
            >
              ⚠️ Switch to BOT Mainnet
            </button>
          ) : account ? (
            <div className="wallet-connected-pill">
              <span className="network-dot" title="Connected to BOT Mainnet" />
              <span className="chain-label">BOT Mainnet</span>
              <span className="wallet-addr font-mono">{shortenAddress(account)}</span>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-connect"
              onClick={onConnect}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
