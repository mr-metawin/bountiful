import React from 'react';
import { formatBOT } from '../utils';

interface PendingBalanceBannerProps {
  balance: bigint;
  withdrawing: boolean;
  onWithdraw: () => void;
}

export const PendingBalanceBanner: React.FC<PendingBalanceBannerProps> = ({
  balance,
  withdrawing,
  onWithdraw,
}) => {
  if (balance <= 0n) return null;

  return (
    <div className="pending-balance-banner" role="region" aria-label="Withdrawable balance">
      <div className="pending-balance-info">
        <span className="balance-badge-icon">💎</span>
        <div>
          <span className="balance-label">Pending Balance Available</span>
          <p className="balance-amount-text">
            You have <strong className="balance-highlight">{formatBOT(balance)}</strong> ready to withdraw.
          </p>
        </div>
      </div>
      <button
        className="btn btn-withdraw"
        onClick={onWithdraw}
        disabled={withdrawing}
      >
        {withdrawing ? 'Withdrawing...' : 'Withdraw BOT'}
      </button>
    </div>
  );
};
