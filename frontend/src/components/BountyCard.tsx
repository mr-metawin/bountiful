import React from 'react';
import { Bounty } from '../types';
import { shortenAddress, formatBOT, formatCountdown } from '../utils';

interface BountyCardProps {
  bounty: Bounty;
  userAddress: `0x${string}` | null;
  onSelect: (id: bigint) => void;
}

export function getBountyPhase(bounty: Bounty): {
  label: string;
  className: string;
  nextDeadline?: { label: string; ts: bigint };
} {
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (bounty.status === 1) {
    return { label: 'Awarded', className: 'phase-awarded' };
  }
  if (bounty.status === 2) {
    return { label: 'Cancelled', className: 'phase-cancelled' };
  }
  if (bounty.status === 3) {
    return { label: 'Split', className: 'phase-split' };
  }

  // Open
  if (now <= bounty.submissionDeadline) {
    return {
      label: 'Accepting submissions',
      className: 'phase-accepting',
      nextDeadline: { label: 'Submissions close', ts: bounty.submissionDeadline },
    };
  }

  if (now <= bounty.reviewDeadline) {
    return {
      label: 'In review',
      className: 'phase-review',
      nextDeadline: { label: 'Review ends', ts: bounty.reviewDeadline },
    };
  }

  if (bounty.submissionCount > 0) {
    return { label: 'Overdue', className: 'phase-overdue' };
  }
  return { label: 'In review', className: 'phase-review' };
}

export const BountyCard: React.FC<BountyCardProps> = ({ bounty, userAddress, onSelect }) => {
  const phase = getBountyPhase(bounty);
  const isPoster = !!userAddress && userAddress.toLowerCase() === bounty.poster.toLowerCase();
  const isWinner = !!userAddress && !!bounty.winner && userAddress.toLowerCase() === bounty.winner.toLowerCase();

  // Plain text preview of description (first 140 chars)
  const descPreview =
    bounty.description.length > 140
      ? `${bounty.description.slice(0, 140)}...`
      : bounty.description;

  return (
    <article
      className="bounty-card"
      onClick={() => onSelect(bounty.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(bounty.id);
        }
      }}
    >
      <div className="card-top-row">
        <span className={`phase-badge ${phase.className}`}>
          <span className="dot" />
          {phase.label}
        </span>
        <div className="reward-badge">
          <span className="reward-icon">🏆</span>
          <span className="reward-amount">{formatBOT(bounty.reward)}</span>
        </div>
      </div>

      <h3 className="card-title">{bounty.title}</h3>
      <p className="card-desc">{descPreview}</p>

      <div className="card-meta">
        <div className="poster-info">
          <span className="meta-label">Poster:</span>
          <span className="meta-value font-mono">{shortenAddress(bounty.poster)}</span>
          {isPoster && <span className="badge badge-you">You</span>}
        </div>

        <div className="sub-count-info">
          <span className="meta-label">Solutions:</span>
          <span className="meta-value">
            <strong>{bounty.submissionCount}</strong>
          </span>
        </div>
      </div>

      <div className="card-footer">
        {phase.nextDeadline ? (
          <div className="countdown-text">
            ⏱ {phase.nextDeadline.label}: <strong>{formatCountdown(phase.nextDeadline.ts)}</strong>
          </div>
        ) : (
          <div className="completed-text">
            {bounty.status === 1 && (
              <span>
                Winner: <strong className="font-mono">{shortenAddress(bounty.winner)}</strong>
                {isWinner && <span className="badge badge-you">You</span>}
              </span>
            )}
            {bounty.status === 2 && <span>Refunded to poster</span>}
            {bounty.status === 3 && <span>Split among submitters</span>}
          </div>
        )}
        <span className="card-arrow">View Task →</span>
      </div>
    </article>
  );
};
