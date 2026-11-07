export type BountyStatus = 0 | 1 | 2 | 3;

export interface Bounty {
  id: bigint;
  poster: `0x${string}`;
  title: string;
  description: string;
  reward: bigint;
  createdAt: bigint;
  submissionDeadline: bigint;
  reviewDeadline: bigint;
  submissionCount: number;
  winner: `0x${string}`;
  status: BountyStatus;
}

export interface Submission {
  worker: `0x${string}`;
  content: string;
  submittedAt: bigint;
}

export type TxState = 'idle' | 'pending' | 'success' | 'error';

export interface TxStatus {
  state: TxState;
  message?: string;
  hash?: `0x${string}`;
}

export type FilterTab = 'all' | 'open' | 'closed' | 'posted' | 'submitted';
export type SortOption = 'newest' | 'highest' | 'ending';

export interface ContractConstants {
  maxSubmissions: number;
  minTitleLength: number;
  maxTitleLength: number;
  minDescriptionLength: number;
  maxDescriptionLength: number;
  minContentLength: number;
  maxContentLength: number;
  minSubmissionDays: number;
  maxSubmissionDays: number;
  minReviewDays: number;
  maxReviewDays: number;
}
