import React from 'react';
import { TxStatus } from '../types';

interface TxBannerProps {
  status: TxStatus;
  onDismiss: () => void;
  explorerUrl?: string;
}

export const TxBanner: React.FC<TxBannerProps> = ({
  status,
  onDismiss,
  explorerUrl = 'https://scan.bohr.life',
}) => {
  if (status.state === 'idle') return null;

  return (
    <div className={`tx-banner tx-${status.state}`} role="alert">
      <div className="tx-banner-content">
        <span className="tx-icon">
          {status.state === 'pending' && <span className="spinner-icon">⏳</span>}
          {status.state === 'success' && <span>✅</span>}
          {status.state === 'error' && <span>⚠️</span>}
        </span>
        <div className="tx-info">
          <span className="tx-message">{status.message}</span>
          {status.hash && (
            <a
              href={`${explorerUrl}/tx/${status.hash}`}
              target="_blank"
              rel="noreferrer"
              className="tx-explorer-link"
            >
              View on BohrScan ↗
            </a>
          )}
        </div>
      </div>
      <button className="tx-close-btn" onClick={onDismiss} aria-label="Dismiss notification">
        &times;
      </button>
    </div>
  );
};
