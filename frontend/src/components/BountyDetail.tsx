import React, { useState } from 'react';
import { Bounty, Submission, ContractConstants } from '../types';
import { shortenAddress, formatBOT, formatDateTime, formatRelativeTime } from '../utils';

interface BountyDetailProps {
  bounty: Bounty;
  submissions: Submission[];
  hasUserSubmitted: boolean;
  userAddress: `0x${string}` | null;
  onBack: () => void;
  onSubmitSolution: (bountyId: bigint, content: string) => Promise<void>;
  onSelectWinner: (bountyId: bigint, submissionIndex: number) => Promise<void>;
  onCancelBounty: (bountyId: bigint) => Promise<void>;
  onSplitReward: (bountyId: bigint) => Promise<void>;
  isActionLoading: boolean;
  constants: ContractConstants;
  onConnectWallet: () => void;
}

export const BountyDetail: React.FC<BountyDetailProps> = ({
  bounty,
  submissions,
  hasUserSubmitted,
  userAddress,
  onBack,
  onSubmitSolution,
  onSelectWinner,
  onCancelBounty,
  onSplitReward,
  isActionLoading,
  constants,
  onConnectWallet,
}) => {
  const [solutionText, setSolutionText] = useState('');
  const [confirmWinnerIdx, setConfirmWinnerIdx] = useState<number | null>(null);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const isPoster = !!userAddress && userAddress.toLowerCase() === bounty.poster.toLowerCase();
  const isAwarded = bounty.status === 1;
  const isCancelled = bounty.status === 2;
  const isSplit = bounty.status === 3;
  const isOpen = bounty.status === 0;

  const isSubmissionsOpen = isOpen && now <= bounty.submissionDeadline;
  const isReviewWindow = isOpen && now <= bounty.reviewDeadline;
  const isOverdue = isOpen && now > bounty.reviewDeadline;

  const handleSolutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solutionText.trim()) return;
    await onSubmitSolution(bounty.id, solutionText.trim());
    setSolutionText('');
  };

  return (
    <div className="bounty-detail-container">
      {/* Top Navigation */}
      <div className="detail-nav-row">
        <button className="btn btn-outline btn-back" onClick={onBack}>
          ← Back to Board
        </button>
        <span className="bounty-id-pill font-mono">Bounty #{bounty.id.toString()}</span>
      </div>

      {/* Phase Stepper */}
      <div className="stepper-card">
        <div className="stepper-track">
          {/* Step 1: Submissions */}
          <div
            className={`step-item ${
              isSubmissionsOpen ? 'active' : isCancelled ? 'cancelled' : 'completed'
            }`}
          >
            <div className="step-circle">
              {isSubmissionsOpen ? '1' : isCancelled ? '✕' : '✓'}
            </div>
            <div className="step-label">Accepting Solutions</div>
            <div className="step-date">
              Until: {formatDateTime(bounty.submissionDeadline)}
            </div>
          </div>

          <div className="step-line" />

          {/* Step 2: Review Window */}
          <div
            className={`step-item ${
              isReviewWindow && !isSubmissionsOpen
                ? 'active'
                : isAwarded || isSplit
                ? 'completed'
                : isCancelled
                ? 'disabled'
                : ''
            }`}
          >
            <div className="step-circle">
              {isReviewWindow && !isSubmissionsOpen ? '2' : isAwarded || isSplit ? '✓' : '2'}
            </div>
            <div className="step-label">Poster Review</div>
            <div className="step-date">
              Until: {formatDateTime(bounty.reviewDeadline)}
            </div>
          </div>

          <div className="step-line" />

          {/* Step 3: Resolution */}
          <div
            className={`step-item ${
              isAwarded
                ? 'completed success'
                : isSplit
                ? 'completed split'
                : isCancelled
                ? 'cancelled'
                : isOverdue
                ? 'overdue'
                : 'pending'
            }`}
          >
            <div className="step-circle">
              {isAwarded ? '🏆' : isSplit ? '⚖️' : isCancelled ? '✕' : isOverdue ? '⚠️' : '3'}
            </div>
            <div className="step-label">
              {isAwarded
                ? 'Awarded'
                : isSplit
                ? 'Reward Split'
                : isCancelled
                ? 'Cancelled'
                : isOverdue
                ? 'Overdue (Ready for Split)'
                : 'Settlement'}
            </div>
            <div className="step-date">
              {isAwarded && `Winner: ${shortenAddress(bounty.winner)}`}
              {isSplit && 'Equal split among submitters'}
              {isCancelled && 'Refunded to poster'}
              {isOpen && 'Pending selection'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Bounty Content */}
      <div className="detail-main-card">
        <div className="detail-header-row">
          <div>
            <h1 className="detail-title">{bounty.title}</h1>
            <div className="detail-meta-row">
              <span className="meta-item">
                Posted by:{' '}
                <strong className="font-mono">{shortenAddress(bounty.poster)}</strong>
                {isPoster && <span className="badge badge-you">You</span>}
              </span>
              <span className="meta-sep">•</span>
              <span className="meta-item">
                Created {formatRelativeTime(bounty.createdAt)}
              </span>
              <span className="meta-sep">•</span>
              <span className="meta-item">
                <strong>{bounty.submissionCount}</strong> submissions
              </span>
            </div>
          </div>

          <div className="detail-reward-box">
            <span className="reward-box-label">LOCKED REWARD</span>
            <div className="reward-box-val">{formatBOT(bounty.reward)}</div>
          </div>
        </div>

        {/* Full Task Description rendered as plain text */}
        <div className="detail-desc-box">
          <h3 className="box-heading">Task Description & Requirements</h3>
          <p className="detail-desc-text plain-text-only">{bounty.description}</p>
        </div>

        {/* Poster Cancel Action Banner (if Open and 0 submissions) */}
        {isPoster && isOpen && bounty.submissionCount === 0 && (
          <div className="action-panel cancel-panel">
            <div className="panel-info">
              <h4>Poster Action: Cancel Bounty</h4>
              <p className="plain-text-line">
                Cancels this task and refunds your full {formatBOT(bounty.reward)} reward to your withdrawable balance.
                This is only possible because no one has submitted work yet.
              </p>
            </div>
            <button
              className="btn btn-danger"
              onClick={() => onCancelBounty(bounty.id)}
              disabled={isActionLoading}
            >
              {isActionLoading ? 'Processing...' : 'Cancel Bounty & Refund'}
            </button>
          </div>
        )}

        {/* Abandoned Split Action Banner (if Open, now > reviewDeadline, and submissions > 0) */}
        {isOpen && isOverdue && bounty.submissionCount > 0 && (
          <div className="action-panel split-panel">
            <div className="panel-info">
              <h4>Abandonment Protection: Split Reward</h4>
              <p className="plain-text-line">
                The poster's review deadline ({formatDateTime(bounty.reviewDeadline)}) has passed.
                Anyone can trigger this action to split the {formatBOT(bounty.reward)} reward equally
                among all {bounty.submissionCount} submitters. Work is never left unpaid!
              </p>
            </div>
            <button
              className="btn btn-warning"
              onClick={() => onSplitReward(bounty.id)}
              disabled={isActionLoading}
            >
              {isActionLoading ? 'Splitting...' : 'Split Reward Among Submitters'}
            </button>
          </div>
        )}
      </div>

      {/* Worker Submit Solution Section */}
      {isSubmissionsOpen && !isPoster && (
        <div className="detail-submit-card">
          <h3 className="section-title">Submit Your Solution</h3>
          {!userAddress ? (
            <div className="auth-prompt-box">
              <p>Connect your Web3 wallet to submit your solution to this bounty.</p>
              <button className="btn btn-primary" onClick={onConnectWallet}>
                Connect Wallet
              </button>
            </div>
          ) : hasUserSubmitted ? (
            <div className="already-submitted-box">
              <span className="icon">✅</span>
              <div>
                <strong>You have submitted your solution.</strong>
                <p>Only one submission is permitted per wallet. You will find your answer below.</p>
              </div>
            </div>
          ) : bounty.submissionCount >= constants.maxSubmissions ? (
            <div className="already-submitted-box max-reached">
              <span>⚠️ Maximum submissions limit ({constants.maxSubmissions}) reached for this bounty.</span>
            </div>
          ) : (
            <form onSubmit={handleSolutionSubmit} className="solution-form">
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="solution-content">Your Answer / Deliverable Link</label>
                  <span
                    className={`char-counter ${
                      solutionText.length > constants.maxContentLength ? 'counter-err' : ''
                    }`}
                  >
                    {solutionText.length} / {constants.maxContentLength}
                  </span>
                </div>
                <textarea
                  id="solution-content"
                  className="input-textarea"
                  rows={5}
                  placeholder="Provide your complete solution or links as plain text. Stored permanently onchain."
                  value={solutionText}
                  maxLength={constants.maxContentLength}
                  onChange={(e) => setSolutionText(e.target.value)}
                  disabled={isActionLoading}
                  required
                />
              </div>

              <div className="solution-form-footer">
                <p className="plain-text-line action-note">
                  Submitting stores your answer immutably onchain. If chosen as the winner by the poster,
                  the entire {formatBOT(bounty.reward)} will be credited to your withdrawable balance.
                </p>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!solutionText.trim() || isActionLoading}
                >
                  {isActionLoading ? 'Submitting...' : 'Submit Solution'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Submissions List Section */}
      <div className="submissions-section">
        <div className="submissions-header">
          <h3>
            Submissions ({submissions.length})
          </h3>
          <span className="submissions-note">
            Rendered as plain text only. No external scripts or markdown.
          </span>
        </div>

        {submissions.length === 0 ? (
          <div className="empty-submissions">
            <span className="empty-icon">📝</span>
            <p>No solutions submitted yet.</p>
            {isSubmissionsOpen && !isPoster && (
              <p className="subtext">Be the first to submit and claim the {formatBOT(bounty.reward)} reward!</p>
            )}
          </div>
        ) : (
          <div className="submissions-list">
            {submissions.map((sub, index) => {
              const isWinningSub =
                isAwarded &&
                bounty.winner &&
                sub.worker.toLowerCase() === bounty.winner.toLowerCase();
              const isThisWorker =
                !!userAddress && userAddress.toLowerCase() === sub.worker.toLowerCase();
              const canPickWinner =
                isPoster && isOpen && isReviewWindow && !isAwarded;

              return (
                <article
                  key={`${sub.worker}-${index}`}
                  className={`submission-card ${isWinningSub ? 'winning-card' : ''}`}
                >
                  <div className="submission-header">
                    <div className="worker-info">
                      <span className="sub-index">#{index + 1}</span>
                      <span className="worker-address font-mono">
                        {shortenAddress(sub.worker)}
                      </span>
                      {isThisWorker && <span className="badge badge-you">You</span>}
                      {isWinningSub && (
                        <span className="badge badge-winner">🏆 Selected Winner</span>
                      )}
                    </div>
                    <span className="sub-time">
                      {formatRelativeTime(sub.submittedAt)}
                    </span>
                  </div>

                  {/* Submission Content as plain text */}
                  <div className="submission-content-box plain-text-only">
                    {sub.content}
                  </div>

                  {/* Poster Winner Selection Action */}
                  {canPickWinner && (
                    <div className="submission-action-bar">
                      {confirmWinnerIdx === index ? (
                        <div className="confirm-winner-box">
                          <p className="plain-text-line">
                            Are you sure you want to award the full{' '}
                            <strong>{formatBOT(bounty.reward)}</strong> to{' '}
                            <span className="font-mono">{shortenAddress(sub.worker)}</span>?
                            This action is final and permanent.
                          </p>
                          <div className="confirm-btn-row">
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => setConfirmWinnerIdx(null)}
                              disabled={isActionLoading}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => {
                                onSelectWinner(bounty.id, index);
                                setConfirmWinnerIdx(null);
                              }}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? 'Awarding...' : 'Yes, Confirm Winner'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pick-winner-row">
                          <span className="action-hint plain-text-line">
                            Poster choice: Select this submission to pay the full{' '}
                            {formatBOT(bounty.reward)} to {shortenAddress(sub.worker)}.
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => setConfirmWinnerIdx(index)}
                            disabled={isActionLoading}
                          >
                            Pick as Winner
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
