import React, { useState } from 'react';
import { parseEther } from 'viem';
import { ContractConstants } from '../types';

interface CreateBountyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, submissionDays: number, reviewDays: number, rewardWei: bigint) => Promise<void>;
  isSubmitting: boolean;
  constants: ContractConstants;
}

export const CreateBountyModal: React.FC<CreateBountyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  constants,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardInput, setRewardInput] = useState('0.1');
  const [submissionDays, setSubmissionDays] = useState(7);
  const [reviewDays, setReviewDays] = useState(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const titleLength = title.length;
  const descLength = description.length;
  const isRewardValid = parseFloat(rewardInput) > 0;
  const isSubmissionDaysValid = submissionDays >= constants.minSubmissionDays && submissionDays <= constants.maxSubmissionDays;
  const isReviewDaysValid = reviewDays >= constants.minReviewDays && reviewDays <= constants.maxReviewDays;
  const isFormValid =
    titleLength >= constants.minTitleLength &&
    titleLength <= constants.maxTitleLength &&
    descLength >= constants.minDescriptionLength &&
    descLength <= constants.maxDescriptionLength &&
    isRewardValid &&
    isSubmissionDaysValid &&
    isReviewDaysValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isFormValid) {
      setErrorMsg('Please check all fields meet the contract requirements.');
      return;
    }

    try {
      const rewardWei = parseEther(rewardInput.trim());
      await onSubmit(title.trim(), description.trim(), submissionDays, reviewDays, rewardWei);
      setTitle('');
      setDescription('');
      setRewardInput('0.1');
      setSubmissionDays(7);
      setReviewDays(3);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit bounty transaction');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-icon">🎯</span>
            <div>
              <h3>Post a Bounty</h3>
              <p className="modal-subtitle">Post a task. Pay the best answer.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bounty-form">
          {/* Title */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="bounty-title">Task Title</label>
              <span className={`char-counter ${titleLength > constants.maxTitleLength ? 'counter-err' : ''}`}>
                {titleLength} / {constants.maxTitleLength}
              </span>
            </div>
            <input
              id="bounty-title"
              type="text"
              className="input-text"
              placeholder="e.g. Design a logo for BOT ecosystem, write a smart contract guide..."
              value={title}
              maxLength={constants.maxTitleLength}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="bounty-desc">Task Description & Requirements</label>
              <span className={`char-counter ${descLength > constants.maxDescriptionLength ? 'counter-err' : ''}`}>
                {descLength} / {constants.maxDescriptionLength}
              </span>
            </div>
            <textarea
              id="bounty-desc"
              className="input-textarea"
              placeholder="Describe what a winning solution should contain. Stored completely onchain as plain text."
              rows={4}
              value={description}
              maxLength={constants.maxDescriptionLength}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Reward and Durations Grid */}
          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="bounty-reward">Reward (BOT)</label>
              <input
                id="bounty-reward"
                type="number"
                step="0.001"
                min="0.0001"
                className="input-text"
                value={rewardInput}
                onChange={(e) => setRewardInput(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="bounty-sub-days">
                Submit Window ({constants.minSubmissionDays}–{constants.maxSubmissionDays} days)
              </label>
              <input
                id="bounty-sub-days"
                type="number"
                min={constants.minSubmissionDays}
                max={constants.maxSubmissionDays}
                className="input-text"
                value={submissionDays}
                onChange={(e) => setSubmissionDays(parseInt(e.target.value) || 1)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="bounty-rev-days">
                Review Window ({constants.minReviewDays}–{constants.maxReviewDays} days)
              </label>
              <input
                id="bounty-rev-days"
                type="number"
                min={constants.minReviewDays}
                max={constants.maxReviewDays}
                className="input-text"
                value={reviewDays}
                onChange={(e) => setReviewDays(parseInt(e.target.value) || 1)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Live Summary Box */}
          <div className="summary-box">
            <div className="summary-header">📜 Terms Summary</div>
            <p className="summary-text">
              You lock <strong>{rewardInput || '0'} BOT</strong>. People can submit for <strong>{submissionDays} days</strong>.
              You then have <strong>{reviewDays} days</strong> to pick a winner. If you stay silent, the reward is split
              among all submitters.
            </p>
            <div className="summary-warning">
              ⚠️ <em>Note: The bounty reward cannot be cancelled once someone has submitted a solution.</em>
            </div>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? 'Confirming in Wallet...' : `Lock ${rewardInput || '0'} BOT & Post`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
