import React, { useState } from 'react';

export const HowItWorks: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="how-it-works-card">
      <button
        type="button"
        className="how-it-works-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="how-title-row">
          <span className="how-icon">💡</span>
          <span className="how-title">How Bountiful works</span>
        </div>
        <span className="how-arrow">{isOpen ? '▲ Collapse' : '▼ Learn how it works'}</span>
      </button>

      {isOpen && (
        <div className="how-it-works-content">
          <div className="how-grid">
            <div className="how-step">
              <div className="step-num">1</div>
              <h4>Post a Task & Lock Reward</h4>
              <p>
                Set a title, description, submission window (1–90 days), and review window (1–14 days).
                Your native BOT reward is locked directly in the smart contract.
              </p>
            </div>

            <div className="how-step">
              <div className="step-num">2</div>
              <h4>Submit Solutions</h4>
              <p>
                Anyone except the poster can submit one plain text solution. All answers are immutably
                stored directly onchain.
              </p>
            </div>

            <div className="how-step">
              <div className="step-num">3</div>
              <h4>Pick Winner or Auto-Split</h4>
              <p>
                The poster can pick the winning submission at any time before the review deadline.
                If the poster abandons or goes silent, anyone can trigger an automatic equal split among
                all submitters.
              </p>
            </div>

            <div className="how-step">
              <div className="step-num">4</div>
              <h4>Zero Fee & Pull Payouts</h4>
              <p>
                Bountiful never takes any platform fee. 100% of the reward goes to workers.
                Funds are securely withdrawn directly into your wallet with reentrancy protection.
              </p>
            </div>
          </div>

          <div className="how-note">
            <strong>Fairness Guarantee:</strong> Posters can only cancel if there are 0 submissions.
            Once work is submitted, funds cannot be withdrawn by the poster without awarding a winner or waiting for the split!
          </div>
        </div>
      )}
    </section>
  );
};
