// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Bountiful
 * @notice "Post a task. Pay the best answer."
 * @dev Bounty board using native BOT on BOT Testnet.
 * Rewards are locked in the contract upon creation. Submissions are stored onchain.
 * Winners are selected by the poster, or abandoned bounties are split among submitters.
 * Payouts are pull-based via pendingBalance and withdraw().
 */
contract Bountiful is ReentrancyGuard {
    enum Status {
        Open,
        Awarded,
        Cancelled,
        Split
    }

    struct Bounty {
        uint256 id;
        address poster;
        string title;
        string description;
        uint256 reward;
        uint64 createdAt;
        uint64 submissionDeadline;
        uint64 reviewDeadline;
        uint32 submissionCount;
        address winner;
        Status status;
    }

    struct Submission {
        address worker;
        string content;
        uint64 submittedAt;
    }

    // Constants
    uint32 public constant MAX_SUBMISSIONS = 50;
    uint256 public constant MIN_TITLE_LENGTH = 1;
    uint256 public constant MAX_TITLE_LENGTH = 100;
    uint256 public constant MIN_DESCRIPTION_LENGTH = 1;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 1000;
    uint256 public constant MIN_CONTENT_LENGTH = 1;
    uint256 public constant MAX_CONTENT_LENGTH = 1000;
    uint32 public constant MIN_SUBMISSION_DAYS = 1;
    uint32 public constant MAX_SUBMISSION_DAYS = 90;
    uint32 public constant MIN_REVIEW_DAYS = 1;
    uint32 public constant MAX_REVIEW_DAYS = 14;

    // State Variables
    uint256 public bountyCount;
    mapping(uint256 => Bounty) private _bounties;
    mapping(uint256 => Submission[]) private _submissions;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    mapping(address => uint256) public pendingBalance;

    // Per-user indexes
    mapping(address => uint256[]) private _postedBy;
    mapping(address => uint256[]) private _submittedBy;

    // Custom Errors
    error ZeroReward();
    error InvalidTitleLength(uint256 length, uint256 min, uint256 max);
    error InvalidDescriptionLength(uint256 length, uint256 min, uint256 max);
    error InvalidSubmissionDays(uint32 daysCount, uint32 min, uint32 max);
    error InvalidReviewDays(uint32 daysCount, uint32 min, uint32 max);
    error BountyNotFound(uint256 bountyId);
    error BountyNotOpen(uint256 bountyId, Status currentStatus);
    error PosterCannotSubmit();
    error AlreadySubmitted(uint256 bountyId, address worker);
    error SubmissionDeadlinePassed(uint256 bountyId, uint64 deadline, uint64 currentTimestamp);
    error InvalidContentLength(uint256 length, uint256 min, uint256 max);
    error MaxSubmissionsReached(uint256 bountyId, uint32 maxAllowed);
    error OnlyPoster(uint256 bountyId, address caller, address poster);
    error NoSubmissions(uint256 bountyId);
    error ReviewDeadlinePassed(uint256 bountyId, uint64 deadline, uint64 currentTimestamp);
    error InvalidSubmissionIndex(uint256 bountyId, uint256 index, uint32 count);
    error CannotCancelWithSubmissions(uint256 bountyId, uint32 submissionCount);
    error ReviewDeadlineNotPassed(uint256 bountyId, uint64 deadline, uint64 currentTimestamp);
    error NothingToWithdraw();
    error TransferFailed();

    // Events
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed poster,
        uint256 reward,
        string title,
        uint64 submissionDeadline,
        uint64 reviewDeadline
    );
    event Submitted(uint256 indexed bountyId, address indexed worker, uint256 submissionIndex);
    event WinnerSelected(uint256 indexed bountyId, address indexed winner, uint256 submissionIndex, uint256 reward);
    event Cancelled(uint256 indexed bountyId, address indexed poster, uint256 reward);
    event Split(uint256 indexed bountyId, uint32 submitterCount, uint256 reward);
    event Withdrawn(address indexed user, uint256 amount);

    /**
     * @notice Create a new bounty with locked reward.
     * @param title 1-100 bytes
     * @param description 1-1000 bytes
     * @param submissionDays 1-90 days for submissions
     * @param reviewDays 1-14 days for poster review after submission deadline
     */
    function createBounty(string calldata title, string calldata description, uint32 submissionDays, uint32 reviewDays)
        external
        payable
        nonReentrant
        returns (uint256 bountyId)
    {
        if (msg.value == 0) revert ZeroReward();

        uint256 titleLen = bytes(title).length;
        if (titleLen < MIN_TITLE_LENGTH || titleLen > MAX_TITLE_LENGTH) {
            revert InvalidTitleLength(titleLen, MIN_TITLE_LENGTH, MAX_TITLE_LENGTH);
        }

        uint256 descLen = bytes(description).length;
        if (descLen < MIN_DESCRIPTION_LENGTH || descLen > MAX_DESCRIPTION_LENGTH) {
            revert InvalidDescriptionLength(descLen, MIN_DESCRIPTION_LENGTH, MAX_DESCRIPTION_LENGTH);
        }

        if (submissionDays < MIN_SUBMISSION_DAYS || submissionDays > MAX_SUBMISSION_DAYS) {
            revert InvalidSubmissionDays(submissionDays, MIN_SUBMISSION_DAYS, MAX_SUBMISSION_DAYS);
        }

        if (reviewDays < MIN_REVIEW_DAYS || reviewDays > MAX_REVIEW_DAYS) {
            revert InvalidReviewDays(reviewDays, MIN_REVIEW_DAYS, MAX_REVIEW_DAYS);
        }

        bountyId = ++bountyCount;
        uint64 submissionDeadline = uint64(block.timestamp + uint256(submissionDays) * 1 days);
        uint64 reviewDeadline = uint64(submissionDeadline + uint256(reviewDays) * 1 days);

        _bounties[bountyId] = Bounty({
            id: bountyId,
            poster: msg.sender,
            title: title,
            description: description,
            reward: msg.value,
            createdAt: uint64(block.timestamp),
            submissionDeadline: submissionDeadline,
            reviewDeadline: reviewDeadline,
            submissionCount: 0,
            winner: address(0),
            status: Status.Open
        });

        _postedBy[msg.sender].push(bountyId);

        emit BountyCreated(bountyId, msg.sender, msg.value, title, submissionDeadline, reviewDeadline);
    }

    /**
     * @notice Submit a text solution to an open bounty.
     * @param bountyId The bounty to submit for
     * @param content Plain text solution (1-1000 bytes)
     */
    function submit(uint256 bountyId, string calldata content) external {
        if (bountyId == 0 || bountyId > bountyCount) revert BountyNotFound(bountyId);

        Bounty storage bounty = _bounties[bountyId];
        if (bounty.status != Status.Open) revert BountyNotOpen(bountyId, bounty.status);
        if (block.timestamp > bounty.submissionDeadline) {
            revert SubmissionDeadlinePassed(bountyId, bounty.submissionDeadline, uint64(block.timestamp));
        }
        if (msg.sender == bounty.poster) revert PosterCannotSubmit();
        if (hasSubmitted[bountyId][msg.sender]) revert AlreadySubmitted(bountyId, msg.sender);

        uint256 contentLen = bytes(content).length;
        if (contentLen < MIN_CONTENT_LENGTH || contentLen > MAX_CONTENT_LENGTH) {
            revert InvalidContentLength(contentLen, MIN_CONTENT_LENGTH, MAX_CONTENT_LENGTH);
        }

        if (bounty.submissionCount >= MAX_SUBMISSIONS) {
            revert MaxSubmissionsReached(bountyId, MAX_SUBMISSIONS);
        }

        hasSubmitted[bountyId][msg.sender] = true;
        uint256 submissionIndex = bounty.submissionCount;
        bounty.submissionCount++;

        _submissions[bountyId].push(
            Submission({worker: msg.sender, content: content, submittedAt: uint64(block.timestamp)})
        );

        _submittedBy[msg.sender].push(bountyId);

        emit Submitted(bountyId, msg.sender, submissionIndex);
    }

    /**
     * @notice Poster selects the winning submission and credits the reward.
     * @dev Can be called at any time before reviewDeadline while status is Open.
     * @param bountyId The bounty id
     * @param submissionIndex Index of the winning submission
     */
    function selectWinner(uint256 bountyId, uint256 submissionIndex) external nonReentrant {
        if (bountyId == 0 || bountyId > bountyCount) revert BountyNotFound(bountyId);

        Bounty storage bounty = _bounties[bountyId];
        if (msg.sender != bounty.poster) revert OnlyPoster(bountyId, msg.sender, bounty.poster);
        if (bounty.status != Status.Open) revert BountyNotOpen(bountyId, bounty.status);
        if (bounty.submissionCount == 0) revert NoSubmissions(bountyId);
        if (block.timestamp > bounty.reviewDeadline) {
            revert ReviewDeadlinePassed(bountyId, bounty.reviewDeadline, uint64(block.timestamp));
        }
        if (submissionIndex >= bounty.submissionCount) {
            revert InvalidSubmissionIndex(bountyId, submissionIndex, bounty.submissionCount);
        }

        bounty.status = Status.Awarded;
        address winner = _submissions[bountyId][submissionIndex].worker;
        bounty.winner = winner;

        pendingBalance[winner] += bounty.reward;

        emit WinnerSelected(bountyId, winner, submissionIndex, bounty.reward);
    }

    /**
     * @notice Poster cancels the bounty and receives a full refund.
     * @dev Only possible when there are zero submissions.
     * @param bountyId The bounty id
     */
    function cancelBounty(uint256 bountyId) external nonReentrant {
        if (bountyId == 0 || bountyId > bountyCount) revert BountyNotFound(bountyId);

        Bounty storage bounty = _bounties[bountyId];
        if (msg.sender != bounty.poster) revert OnlyPoster(bountyId, msg.sender, bounty.poster);
        if (bounty.status != Status.Open) revert BountyNotOpen(bountyId, bounty.status);
        if (bounty.submissionCount > 0) revert CannotCancelWithSubmissions(bountyId, bounty.submissionCount);

        bounty.status = Status.Cancelled;
        pendingBalance[msg.sender] += bounty.reward;

        emit Cancelled(bountyId, msg.sender, bounty.reward);
    }

    /**
     * @notice Anyone can trigger an equal split among submitters if poster abandoned review.
     * @dev Requires status Open, submissionCount > 0, and now > reviewDeadline.
     * Remainder goes to the first submitter so no funds are lost.
     * @param bountyId The bounty id
     */
    function splitIfAbandoned(uint256 bountyId) external nonReentrant {
        if (bountyId == 0 || bountyId > bountyCount) revert BountyNotFound(bountyId);

        Bounty storage bounty = _bounties[bountyId];
        if (bounty.status != Status.Open) revert BountyNotOpen(bountyId, bounty.status);
        if (bounty.submissionCount == 0) revert NoSubmissions(bountyId);
        if (block.timestamp <= bounty.reviewDeadline) {
            revert ReviewDeadlineNotPassed(bountyId, bounty.reviewDeadline, uint64(block.timestamp));
        }

        bounty.status = Status.Split;
        uint256 count = bounty.submissionCount;
        uint256 reward = bounty.reward;
        uint256 share = reward / count;
        uint256 remainder = reward % count;

        Submission[] storage subs = _submissions[bountyId];
        for (uint256 i = 0; i < count; i++) {
            uint256 payout = share + (i == 0 ? remainder : 0);
            pendingBalance[subs[i].worker] += payout;
        }

        emit Split(bountyId, uint32(count), reward);
    }

    /**
     * @notice Withdraw accumulated pending balance to caller's wallet.
     * @dev Zeroes pendingBalance before transfer. Uses nonReentrant.
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingBalance[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingBalance[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // --- View Functions ---

    /**
     * @notice Get single bounty details.
     */
    function getBounty(uint256 id) external view returns (Bounty memory) {
        if (id == 0 || id > bountyCount) revert BountyNotFound(id);
        return _bounties[id];
    }

    /**
     * @notice Get paginated bounties, ordered newest first.
     * @param offset Starting index from newest
     * @param limit Maximum bounties to return
     */
    function getBounties(uint256 offset, uint256 limit)
        external
        view
        returns (Bounty[] memory bounties, uint256 total)
    {
        total = bountyCount;
        if (offset >= total || limit == 0) {
            return (new Bounty[](0), total);
        }

        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        bounties = new Bounty[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 id = total - offset - i;
            bounties[i] = _bounties[id];
        }

        return (bounties, total);
    }

    /**
     * @notice Get a specific submission for a bounty.
     */
    function getSubmission(uint256 id, uint256 index) external view returns (Submission memory) {
        if (id == 0 || id > bountyCount) revert BountyNotFound(id);
        if (index >= _submissions[id].length) {
            revert InvalidSubmissionIndex(id, index, uint32(_submissions[id].length));
        }
        return _submissions[id][index];
    }

    /**
     * @notice Get paginated submissions for a bounty (chronological order).
     */
    function getSubmissions(uint256 id, uint256 offset, uint256 limit)
        external
        view
        returns (Submission[] memory list, uint256 total)
    {
        if (id == 0 || id > bountyCount) revert BountyNotFound(id);
        total = _submissions[id].length;

        if (offset >= total || limit == 0) {
            return (new Submission[](0), total);
        }

        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        list = new Submission[](count);

        for (uint256 i = 0; i < count; i++) {
            list[i] = _submissions[id][offset + i];
        }

        return (list, total);
    }

    /**
     * @notice Get paginated bounty IDs posted by a specific address (newest first).
     */
    function getPostedIds(address user, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        uint256[] storage userList = _postedBy[user];
        total = userList.length;

        if (offset >= total || limit == 0) {
            return (new uint256[](0), total);
        }

        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        ids = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            ids[i] = userList[total - 1 - offset - i];
        }

        return (ids, total);
    }

    /**
     * @notice Get paginated bounty IDs submitted to by a specific address (newest first).
     */
    function getSubmittedIds(address user, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        uint256[] storage userList = _submittedBy[user];
        total = userList.length;

        if (offset >= total || limit == 0) {
            return (new uint256[](0), total);
        }

        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        ids = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            ids[i] = userList[total - 1 - offset - i];
        }

        return (ids, total);
    }
}
