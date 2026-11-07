import { formatEther } from 'viem';

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatRelativeTime(timestampSec: bigint | number): string {
  const now = Math.floor(Date.now() / 1000);
  const ts = typeof timestampSec === 'bigint' ? Number(timestampSec) : timestampSec;
  const diff = now - ts;

  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(daysBetween(ts, now));
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function daysBetween(t1: number, t2: number): number {
  return Math.abs(t2 - t1) / 86400;
}

export function formatCountdown(targetTimestampSec: bigint | number): string {
  const now = Math.floor(Date.now() / 1000);
  const target = typeof targetTimestampSec === 'bigint' ? Number(targetTimestampSec) : targetTimestampSec;
  const remaining = target - now;

  if (remaining <= 0) return 'ended';
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function formatBOT(amountWei: bigint): string {
  const str = formatEther(amountWei);
  const num = parseFloat(str);
  if (num === 0) return '0 BOT';
  if (num < 0.0001) return '<0.0001 BOT';
  return `${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })} BOT`;
}

export function formatDateTime(timestampSec: bigint | number): string {
  const ts = typeof timestampSec === 'bigint' ? Number(timestampSec) : timestampSec;
  return new Date(ts * 1000).toLocaleString();
}

export function parseContractError(err: any): string {
  if (!err) return 'An unknown error occurred.';

  const str = err.message || err.toString();

  if (str.includes('ZeroReward')) return 'Bounty reward must be greater than zero.';
  if (str.includes('InvalidTitleLength')) return 'Title must be between 1 and 100 characters.';
  if (str.includes('InvalidDescriptionLength')) return 'Description must be between 1 and 1000 characters.';
  if (str.includes('InvalidSubmissionDays')) return 'Submission period must be between 1 and 90 days.';
  if (str.includes('InvalidReviewDays')) return 'Review period must be between 1 and 14 days.';
  if (str.includes('BountyNotFound')) return 'Bounty not found.';
  if (str.includes('BountyNotOpen')) return 'This bounty is no longer open.';
  if (str.includes('PosterCannotSubmit')) return 'The bounty poster cannot submit a solution to their own task.';
  if (str.includes('AlreadySubmitted')) return 'You have already submitted a solution to this bounty.';
  if (str.includes('SubmissionDeadlinePassed')) return 'The submission deadline has passed for this bounty.';
  if (str.includes('InvalidContentLength')) return 'Solution must be between 1 and 1000 characters.';
  if (str.includes('MaxSubmissionsReached')) return 'Maximum submission limit (50) has been reached.';
  if (str.includes('OnlyPoster')) return 'Only the bounty poster can perform this action.';
  if (str.includes('NoSubmissions')) return 'Cannot perform this action with zero submissions.';
  if (str.includes('ReviewDeadlinePassed')) return 'The review deadline has passed.';
  if (str.includes('InvalidSubmissionIndex')) return 'Invalid submission selected.';
  if (str.includes('CannotCancelWithSubmissions')) return 'Cannot cancel bounty: work has already been submitted!';
  if (str.includes('ReviewDeadlineNotPassed')) return 'The review window is still open. The poster still has time to pick.';
  if (str.includes('NothingToWithdraw')) return 'You have no pending balance to withdraw.';
  if (str.includes('TransferFailed')) return 'Native BOT transfer failed.';
  if (str.includes('User rejected') || str.includes('User denied') || str.includes('rejected transaction')) {
    return 'Transaction rejected in wallet.';
  }

  if (err?.shortMessage) return err.shortMessage;
  return str.length > 120 ? `${str.slice(0, 117)}...` : str;
}

