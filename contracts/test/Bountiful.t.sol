// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Bountiful} from "../src/Bountiful.sol";

contract RejectingReceiver {
    receive() external payable {
        revert("Rejecting ETH");
    }
}

contract ReentrantAttacker {
    Bountiful public bountiful;
    bool public hasReentered;

    constructor(address payable _bountiful) {
        bountiful = Bountiful(_bountiful);
    }

    function attackWithdraw() external {
        bountiful.withdraw();
    }

    receive() external payable {
        if (!hasReentered) {
            hasReentered = true;
            bountiful.withdraw();
        }
    }
}

contract BountifulTest is Test {
    Bountiful public bountiful;

    address public poster = address(0x101);
    address public worker1 = address(0x201);
    address public worker2 = address(0x202);
    address public worker3 = address(0x203);
    address public stranger = address(0x301);

    function setUp() public {
        bountiful = new Bountiful();
        vm.deal(poster, 1000 ether);
        vm.deal(worker1, 1000 ether);
        vm.deal(worker2, 1000 ether);
        vm.deal(worker3, 1000 ether);
        vm.deal(stranger, 1000 ether);
    }

    // ==========================================
    // 1. createBounty Tests
    // ==========================================

    function test_CreateBounty_Success() public {
        vm.prank(poster);
        uint256 bountyId = bountiful.createBounty{value: 5 ether}("Title 1", "Description 1", 7, 3);

        assertEq(bountyId, 1);
        assertEq(bountiful.bountyCount(), 1);

        Bountiful.Bounty memory b = bountiful.getBounty(1);
        assertEq(b.id, 1);
        assertEq(b.poster, poster);
        assertEq(b.title, "Title 1");
        assertEq(b.description, "Description 1");
        assertEq(b.reward, 5 ether);
        assertEq(b.createdAt, block.timestamp);
        assertEq(b.submissionDeadline, block.timestamp + 7 days);
        assertEq(b.reviewDeadline, block.timestamp + 10 days);
        assertEq(b.submissionCount, 0);
        assertEq(b.winner, address(0));
        assertEq(uint8(b.status), uint8(Bountiful.Status.Open));
        assertEq(address(bountiful).balance, 5 ether);

        (uint256[] memory postedIds, uint256 total) = bountiful.getPostedIds(poster, 0, 10);
        assertEq(total, 1);
        assertEq(postedIds.length, 1);
        assertEq(postedIds[0], 1);
    }

    function test_CreateBounty_RevertsZeroValue() public {
        vm.prank(poster);
        vm.expectRevert(Bountiful.ZeroReward.selector);
        bountiful.createBounty{value: 0}("Title", "Description", 7, 3);
    }

    function test_CreateBounty_RevertsTitleLengths() public {
        vm.startPrank(poster);

        // Empty title
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidTitleLength.selector, 0, 1, 100));
        bountiful.createBounty{value: 1 ether}("", "Description", 7, 3);

        // Title > 100 bytes (101 bytes)
        bytes memory longTitle = new bytes(101);
        for (uint256 i = 0; i < 101; i++) longTitle[i] = "a";
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidTitleLength.selector, 101, 1, 100));
        bountiful.createBounty{value: 1 ether}(string(longTitle), "Description", 7, 3);

        vm.stopPrank();
    }

    function test_CreateBounty_RevertsDescriptionLengths() public {
        vm.startPrank(poster);

        // Empty description
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidDescriptionLength.selector, 0, 1, 1000));
        bountiful.createBounty{value: 1 ether}("Title", "", 7, 3);

        // Description > 1000 bytes (1001 bytes)
        bytes memory longDesc = new bytes(1001);
        for (uint256 i = 0; i < 1001; i++) longDesc[i] = "b";
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidDescriptionLength.selector, 1001, 1, 1000));
        bountiful.createBounty{value: 1 ether}("Title", string(longDesc), 7, 3);

        vm.stopPrank();
    }

    function test_CreateBounty_RevertsInvalidSubmissionDays() public {
        vm.startPrank(poster);

        // 0 days
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidSubmissionDays.selector, 0, 1, 90));
        bountiful.createBounty{value: 1 ether}("Title", "Desc", 0, 3);

        // 91 days
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidSubmissionDays.selector, 91, 1, 90));
        bountiful.createBounty{value: 1 ether}("Title", "Desc", 91, 3);

        vm.stopPrank();
    }

    function test_CreateBounty_RevertsInvalidReviewDays() public {
        vm.startPrank(poster);

        // 0 days
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidReviewDays.selector, 0, 1, 14));
        bountiful.createBounty{value: 1 ether}("Title", "Desc", 7, 0);

        // 15 days
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidReviewDays.selector, 15, 1, 14));
        bountiful.createBounty{value: 1 ether}("Title", "Desc", 7, 15);

        vm.stopPrank();
    }

    // ==========================================
    // 2. submit Tests
    // ==========================================

    function test_Submit_Success() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 2 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Solution content 1");

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        assertEq(b.submissionCount, 1);
        assertTrue(bountiful.hasSubmitted(id, worker1));

        Bountiful.Submission memory sub = bountiful.getSubmission(id, 0);
        assertEq(sub.worker, worker1);
        assertEq(sub.content, "Solution content 1");
        assertEq(sub.submittedAt, block.timestamp);

        (uint256[] memory submittedIds, uint256 total) = bountiful.getSubmittedIds(worker1, 0, 10);
        assertEq(total, 1);
        assertEq(submittedIds[0], id);
    }

    function test_Submit_RevertsPosterCannotSubmit() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(poster);
        vm.expectRevert(Bountiful.PosterCannotSubmit.selector);
        bountiful.submit(id, "Poster solution");
    }

    function test_Submit_RevertsAlreadySubmitted() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.startPrank(worker1);
        bountiful.submit(id, "First solution");

        vm.expectRevert(abi.encodeWithSelector(Bountiful.AlreadySubmitted.selector, id, worker1));
        bountiful.submit(id, "Second solution attempt");
        vm.stopPrank();
    }

    function test_Submit_RevertsContentLengths() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.startPrank(worker1);
        // Empty content
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidContentLength.selector, 0, 1, 1000));
        bountiful.submit(id, "");

        // 1001 bytes
        bytes memory longContent = new bytes(1001);
        for (uint256 i = 0; i < 1001; i++) longContent[i] = "x";
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidContentLength.selector, 1001, 1, 1000));
        bountiful.submit(id, string(longContent));
        vm.stopPrank();
    }

    function test_Submit_RevertsAfterSubmissionDeadline() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        // Warp past submissionDeadline (5 days + 1 second)
        vm.warp(block.timestamp + 5 days + 1);

        vm.prank(worker1);
        vm.expectRevert(
            abi.encodeWithSelector(
                Bountiful.SubmissionDeadlinePassed.selector,
                id,
                block.timestamp - 1, // original submission deadline
                block.timestamp
            )
        );
        bountiful.submit(id, "Late submission");
    }

    function test_Submit_RevertsNonexistentBounty() public {
        vm.prank(worker1);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotFound.selector, 999));
        bountiful.submit(999, "Content");

        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotFound.selector, 0));
        bountiful.submit(0, "Content");
    }

    function test_Submit_RevertsNonOpenBounty() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(poster);
        bountiful.cancelBounty(id);

        vm.prank(worker1);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Cancelled));
        bountiful.submit(id, "Content");
    }

    function test_Submit_RevertsMaxSubmissionsReached() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        for (uint160 i = 1; i <= 50; i++) {
            address worker = address(0x5000 + i);
            vm.prank(worker);
            bountiful.submit(id, "Solution");
        }

        assertEq(bountiful.getBounty(id).submissionCount, 50);

        address extraWorker = address(0x9999);
        vm.prank(extraWorker);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.MaxSubmissionsReached.selector, id, 50));
        bountiful.submit(id, "Extra solution");
    }

    // ==========================================
    // 3. selectWinner Tests
    // ==========================================

    function test_SelectWinner_BeforeSubmissionDeadline_Success() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 3 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Worker 1 solution");
        vm.prank(worker2);
        bountiful.submit(id, "Worker 2 solution");

        // Poster selects winner before submissionDeadline (e.g. 1 day in)
        vm.warp(block.timestamp + 1 days);
        vm.prank(poster);
        bountiful.selectWinner(id, 1); // worker2

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        assertEq(uint8(b.status), uint8(Bountiful.Status.Awarded));
        assertEq(b.winner, worker2);
        assertEq(bountiful.pendingBalance(worker2), 3 ether);
        assertEq(bountiful.pendingBalance(worker1), 0);
    }

    function test_SelectWinner_AfterSubmissionDeadline_Success() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 3 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Worker 1 solution");

        // Warp after submission deadline (5 days) but before review deadline (7 days)
        vm.warp(block.timestamp + 6 days);

        vm.prank(poster);
        bountiful.selectWinner(id, 0); // worker1

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        assertEq(uint8(b.status), uint8(Bountiful.Status.Awarded));
        assertEq(b.winner, worker1);
        assertEq(bountiful.pendingBalance(worker1), 3 ether);
    }

    function test_SelectWinner_RevertsStranger() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Worker 1 solution");

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.OnlyPoster.selector, id, stranger, poster));
        bountiful.selectWinner(id, 0);
    }

    function test_SelectWinner_RevertsNoSubmissions() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.NoSubmissions.selector, id));
        bountiful.selectWinner(id, 0);
    }

    function test_SelectWinner_RevertsInvalidIndex() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Solution");

        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.InvalidSubmissionIndex.selector, id, 1, 1));
        bountiful.selectWinner(id, 1);
    }

    function test_SelectWinner_RevertsAfterReviewDeadline() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Solution");

        // Warp past review deadline (7 days + 1 sec)
        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(poster);
        vm.expectRevert(
            abi.encodeWithSelector(
                Bountiful.ReviewDeadlinePassed.selector,
                id,
                block.timestamp - 1,
                block.timestamp
            )
        );
        bountiful.selectWinner(id, 0);
    }

    function test_SelectWinner_RevertsSecondCall() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Solution");

        vm.prank(poster);
        bountiful.selectWinner(id, 0);

        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Awarded));
        bountiful.selectWinner(id, 0);
    }

    // ==========================================
    // 4. cancelBounty Tests
    // ==========================================

    function test_CancelBounty_Success() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 2 ether}("Task", "Details", 5, 2);

        assertEq(bountiful.pendingBalance(poster), 0);

        vm.prank(poster);
        bountiful.cancelBounty(id);

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        assertEq(uint8(b.status), uint8(Bountiful.Status.Cancelled));
        assertEq(bountiful.pendingBalance(poster), 2 ether);
    }

    function test_CancelBounty_RevertsStranger() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 2 ether}("Task", "Details", 5, 2);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.OnlyPoster.selector, id, stranger, poster));
        bountiful.cancelBounty(id);
    }

    function test_CancelBounty_RevertsOnceSubmissionExists() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 2 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Work submitted");

        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.CannotCancelWithSubmissions.selector, id, 1));
        bountiful.cancelBounty(id);
    }

    // ==========================================
    // 5. splitIfAbandoned Tests
    // ==========================================

    function test_SplitIfAbandoned_Success_AnyoneCanCall() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 3 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Work 1");
        vm.prank(worker2);
        bountiful.submit(id, "Work 2");

        // Warp past review deadline (5 + 2 = 7 days + 1 sec)
        vm.warp(block.timestamp + 7 days + 1);

        // Stranger calls splitIfAbandoned
        vm.prank(stranger);
        bountiful.splitIfAbandoned(id);

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        assertEq(uint8(b.status), uint8(Bountiful.Status.Split));

        // 3 ether / 2 = 1.5 ether each
        assertEq(bountiful.pendingBalance(worker1), 1.5 ether);
        assertEq(bountiful.pendingBalance(worker2), 1.5 ether);
    }

    function test_SplitIfAbandoned_ExactSplits_VariousSubmittersAndOddRewards() public {
        uint32[5] memory counts = [uint32(1), uint32(2), uint32(3), uint32(7), uint32(50)];
        uint256[3] memory rewards = [
            uint256(1 ether + 1 wei),
            uint256(777777777777777777 wei),
            uint256(999999999999999999 wei)
        ];

        for (uint256 r = 0; r < rewards.length; r++) {
            uint256 reward = rewards[r];

            for (uint256 c = 0; c < counts.length; c++) {
                uint32 submitterCount = counts[c];

                vm.prank(poster);
                uint256 id = bountiful.createBounty{value: reward}("Test", "Split test", 5, 2);

                address[] memory workers = new address[](submitterCount);
                for (uint160 i = 0; i < submitterCount; i++) {
                    workers[i] = address(uint160(0x80000 + (r * 10000) + (c * 100) + i));
                    vm.prank(workers[i]);
                    bountiful.submit(id, "Valid submission");
                }

                vm.warp(block.timestamp + 7 days + 1);

                bountiful.splitIfAbandoned(id);

                // Verify sum of credited balances equals exact bounty reward
                uint256 totalCredited = 0;
                uint256 share = reward / submitterCount;
                uint256 remainder = reward % submitterCount;

                for (uint256 i = 0; i < submitterCount; i++) {
                    uint256 expected = share + (i == 0 ? remainder : 0);
                    uint256 bal = bountiful.pendingBalance(workers[i]);
                    assertEq(bal, expected, "Mismatch in split worker share");
                    totalCredited += bal;
                }

                assertEq(totalCredited, reward, "Total credited does not equal reward exactly");
            }
        }
    }

    function test_SplitIfAbandoned_RevertsBeforeReviewDeadline() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Work");

        // Warp before review deadline (e.g. 6 days)
        vm.warp(block.timestamp + 6 days);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                Bountiful.ReviewDeadlineNotPassed.selector,
                id,
                block.timestamp + 1 days,
                block.timestamp
            )
        );
        bountiful.splitIfAbandoned(id);
    }

    function test_SplitIfAbandoned_RevertsNoSubmissions() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.warp(block.timestamp + 8 days);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.NoSubmissions.selector, id));
        bountiful.splitIfAbandoned(id);
    }

    function test_SplitIfAbandoned_RevertsNonOpenState() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(worker1);
        bountiful.submit(id, "Work");

        vm.prank(poster);
        bountiful.selectWinner(id, 0);

        vm.warp(block.timestamp + 8 days);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Awarded));
        bountiful.splitIfAbandoned(id);
    }

    // ==========================================
    // 6. No Double Settlement Tests
    // ==========================================

    function test_NoDoubleSettlement_AwardedBlocksAll() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);
        vm.prank(worker1);
        bountiful.submit(id, "Work");
        vm.prank(poster);
        bountiful.selectWinner(id, 0);

        // Submit reverts
        vm.prank(worker2);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Awarded));
        bountiful.submit(id, "New work");

        // Cancel reverts
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Awarded));
        bountiful.cancelBounty(id);

        // Select winner again reverts
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Awarded));
        bountiful.selectWinner(id, 0);

        // Split reverts
        vm.warp(block.timestamp + 8 days);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Awarded));
        bountiful.splitIfAbandoned(id);
    }

    function test_NoDoubleSettlement_CancelledBlocksAll() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);
        vm.prank(poster);
        bountiful.cancelBounty(id);

        // Submit reverts
        vm.prank(worker1);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Cancelled));
        bountiful.submit(id, "New work");

        // Cancel again reverts
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Cancelled));
        bountiful.cancelBounty(id);

        // Select winner reverts
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Cancelled));
        bountiful.selectWinner(id, 0);

        // Split reverts
        vm.warp(block.timestamp + 8 days);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Cancelled));
        bountiful.splitIfAbandoned(id);
    }

    function test_NoDoubleSettlement_SplitBlocksAll() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);
        vm.prank(worker1);
        bountiful.submit(id, "Work");

        vm.warp(block.timestamp + 8 days);
        bountiful.splitIfAbandoned(id);

        // Submit reverts
        vm.prank(worker2);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Split));
        bountiful.submit(id, "New work");

        // Cancel reverts
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Split));
        bountiful.cancelBounty(id);

        // Select winner reverts
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Split));
        bountiful.selectWinner(id, 0);

        // Split again reverts
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Bountiful.BountyNotOpen.selector, id, Bountiful.Status.Split));
        bountiful.splitIfAbandoned(id);
    }

    // ==========================================
    // 7. withdraw Tests
    // ==========================================

    function test_Withdraw_SuccessAndRevertOnSecondCall() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 2 ether}("Task", "Details", 5, 2);
        vm.prank(worker1);
        bountiful.submit(id, "Work");
        vm.prank(poster);
        bountiful.selectWinner(id, 0);

        assertEq(bountiful.pendingBalance(worker1), 2 ether);
        uint256 balBefore = worker1.balance;

        vm.prank(worker1);
        bountiful.withdraw();

        assertEq(bountiful.pendingBalance(worker1), 0);
        assertEq(worker1.balance, balBefore + 2 ether);

        // Second call reverts NothingToWithdraw
        vm.prank(worker1);
        vm.expectRevert(Bountiful.NothingToWithdraw.selector);
        bountiful.withdraw();
    }

    function test_Withdraw_AccumulatesFromMultipleBounties() public {
        vm.startPrank(poster);
        uint256 b1 = bountiful.createBounty{value: 1 ether}("Task 1", "Details", 5, 2);
        uint256 b2 = bountiful.createBounty{value: 3 ether}("Task 2", "Details", 5, 2);
        vm.stopPrank();

        vm.prank(worker1);
        bountiful.submit(b1, "Work 1");
        vm.prank(worker1);
        bountiful.submit(b2, "Work 2");

        vm.startPrank(poster);
        bountiful.selectWinner(b1, 0);
        bountiful.selectWinner(b2, 0);
        vm.stopPrank();

        assertEq(bountiful.pendingBalance(worker1), 4 ether);

        uint256 beforeBal = worker1.balance;
        vm.prank(worker1);
        bountiful.withdraw();

        assertEq(bountiful.pendingBalance(worker1), 0);
        assertEq(worker1.balance, beforeBal + 4 ether);
    }

    // ==========================================
    // 8. Reentrancy & Rejecting Tests
    // ==========================================

    function test_ReentrancyBlocked() public {
        ReentrantAttacker attacker = new ReentrantAttacker(payable(address(bountiful)));
        vm.deal(address(attacker), 10 ether);

        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        vm.prank(address(attacker));
        bountiful.submit(id, "Attacking payload");

        vm.prank(poster);
        bountiful.selectWinner(id, 0);

        assertEq(bountiful.pendingBalance(address(attacker)), 1 ether);

        // Attacker attempts reentrancy during withdraw
        // The inner call reverts with ReentrancyGuardReentrantCall(), causing outer call success=false -> TransferFailed
        vm.expectRevert(Bountiful.TransferFailed.selector);
        attacker.attackWithdraw();
    }

    function test_RejectingWorkerOnlyHurtsItself() public {
        RejectingReceiver rejecter = new RejectingReceiver();

        vm.prank(poster);
        uint256 b1 = bountiful.createBounty{value: 1 ether}("Task 1", "Details", 5, 2);
        vm.prank(poster);
        uint256 b2 = bountiful.createBounty{value: 2 ether}("Task 2", "Details", 5, 2);

        // Rejecter submits to b1, normal worker submits to b2
        vm.prank(address(rejecter));
        bountiful.submit(b1, "Work 1");
        vm.prank(worker1);
        bountiful.submit(b2, "Work 2");

        // Award both
        vm.startPrank(poster);
        bountiful.selectWinner(b1, 0);
        bountiful.selectWinner(b2, 0);
        vm.stopPrank();

        // Worker1 withdraws without issue
        vm.prank(worker1);
        bountiful.withdraw();
        assertEq(bountiful.pendingBalance(worker1), 0);

        // Rejecter withdraw reverts due to its own rejection, hurting only itself
        vm.prank(address(rejecter));
        vm.expectRevert(Bountiful.TransferFailed.selector);
        bountiful.withdraw();

        // Contract state and other users remain fully intact
        assertEq(bountiful.pendingBalance(address(rejecter)), 1 ether);
    }

    // ==========================================
    // 9. Pagination Tests
    // ==========================================

    function test_Pagination_GetBounties() public {
        vm.startPrank(poster);
        for (uint256 i = 1; i <= 5; i++) {
            bountiful.createBounty{value: 0.1 ether}("Title", "Desc", 5, 2);
        }
        vm.stopPrank();

        // Page 1: offset 0, limit 2 -> newest first [5, 4]
        (Bountiful.Bounty[] memory page1, uint256 total1) = bountiful.getBounties(0, 2);
        assertEq(total1, 5);
        assertEq(page1.length, 2);
        assertEq(page1[0].id, 5);
        assertEq(page1[1].id, 4);

        // Page 2: offset 2, limit 2 -> [3, 2]
        (Bountiful.Bounty[] memory page2, uint256 total2) = bountiful.getBounties(2, 2);
        assertEq(total2, 5);
        assertEq(page2.length, 2);
        assertEq(page2[0].id, 3);
        assertEq(page2[1].id, 2);

        // Page 3: offset 4, limit 2 -> [1]
        (Bountiful.Bounty[] memory page3, uint256 total3) = bountiful.getBounties(4, 2);
        assertEq(total3, 5);
        assertEq(page3.length, 1);
        assertEq(page3[0].id, 1);

        // Offset out of bounds
        (Bountiful.Bounty[] memory pageEmpty, uint256 totalEmpty) = bountiful.getBounties(5, 2);
        assertEq(totalEmpty, 5);
        assertEq(pageEmpty.length, 0);

        // Limit 0
        (Bountiful.Bounty[] memory pageZero, uint256 totalZero) = bountiful.getBounties(0, 0);
        assertEq(totalZero, 5);
        assertEq(pageZero.length, 0);
    }

    function test_Pagination_GetSubmissions() public {
        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: 1 ether}("Task", "Details", 5, 2);

        for (uint160 i = 1; i <= 5; i++) {
            address worker = address(0x7000 + i);
            vm.prank(worker);
            bountiful.submit(id, "Content");
        }

        (Bountiful.Submission[] memory page1, uint256 total1) = bountiful.getSubmissions(id, 0, 2);
        assertEq(total1, 5);
        assertEq(page1.length, 2);
        assertEq(page1[0].worker, address(0x7001));
        assertEq(page1[1].worker, address(0x7002));

        (Bountiful.Submission[] memory page2, uint256 total2) = bountiful.getSubmissions(id, 2, 2);
        assertEq(total2, 5);
        assertEq(page2.length, 2);
        assertEq(page2[0].worker, address(0x7003));
        assertEq(page2[1].worker, address(0x7004));

        (Bountiful.Submission[] memory page3, uint256 total3) = bountiful.getSubmissions(id, 4, 2);
        assertEq(total3, 5);
        assertEq(page3.length, 1);
        assertEq(page3[0].worker, address(0x7005));

        (Bountiful.Submission[] memory emptyPage, ) = bountiful.getSubmissions(id, 5, 2);
        assertEq(emptyPage.length, 0);
    }

    function test_Pagination_GetPostedIds() public {
        vm.startPrank(poster);
        for (uint256 i = 1; i <= 4; i++) {
            bountiful.createBounty{value: 0.1 ether}("Title", "Desc", 5, 2);
        }
        vm.stopPrank();

        (uint256[] memory ids, uint256 total) = bountiful.getPostedIds(poster, 0, 3);
        assertEq(total, 4);
        assertEq(ids.length, 3);
        assertEq(ids[0], 4);
        assertEq(ids[1], 3);
        assertEq(ids[2], 2);

        (uint256[] memory nextIds, ) = bountiful.getPostedIds(poster, 3, 3);
        assertEq(nextIds.length, 1);
        assertEq(nextIds[0], 1);
    }

    function test_Pagination_GetSubmittedIds() public {
        vm.startPrank(poster);
        uint256 b1 = bountiful.createBounty{value: 0.1 ether}("T1", "D1", 5, 2);
        uint256 b2 = bountiful.createBounty{value: 0.1 ether}("T2", "D2", 5, 2);
        uint256 b3 = bountiful.createBounty{value: 0.1 ether}("T3", "D3", 5, 2);
        vm.stopPrank();

        vm.startPrank(worker1);
        bountiful.submit(b1, "Sub 1");
        bountiful.submit(b2, "Sub 2");
        bountiful.submit(b3, "Sub 3");
        vm.stopPrank();

        (uint256[] memory ids, uint256 total) = bountiful.getSubmittedIds(worker1, 0, 2);
        assertEq(total, 3);
        assertEq(ids.length, 2);
        assertEq(ids[0], b3);
        assertEq(ids[1], b2);

        (uint256[] memory nextIds, ) = bountiful.getSubmittedIds(worker1, 2, 2);
        assertEq(nextIds.length, 1);
        assertEq(nextIds[0], b1);
    }

    // ==========================================
    // 10. Fuzz Test
    // ==========================================

    function testFuzz_RewardsAndSubmittersConservation(
        uint96 rewardAmount,
        uint8 submittersCountRaw,
        uint8 actionChoice
    ) public {
        vm.assume(rewardAmount > 0 && rewardAmount < 50 ether);
        uint32 submittersCount = uint32(bound(submittersCountRaw, 1, 50));

        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: rewardAmount}("Fuzz Task", "Description", 5, 2);

        address[] memory workers = new address[](submittersCount);
        for (uint160 i = 0; i < submittersCount; i++) {
            workers[i] = address(uint160(0x9000 + i));
            vm.prank(workers[i]);
            bountiful.submit(id, "Valid fuzz submission");
        }

        uint8 choice = actionChoice % 2;
        if (choice == 0) {
            // Select random winner
            uint256 winnerIdx = uint256(actionChoice) % submittersCount;
            vm.prank(poster);
            bountiful.selectWinner(id, winnerIdx);

            address winner = workers[winnerIdx];
            assertEq(bountiful.pendingBalance(winner), rewardAmount);

            // Withdraw
            uint256 beforeBal = winner.balance;
            vm.prank(winner);
            bountiful.withdraw();
            assertEq(winner.balance, beforeBal + rewardAmount);
        } else {
            // Abandon and split
            vm.warp(block.timestamp + 8 days);
            bountiful.splitIfAbandoned(id);

            uint256 totalWithdrawn = 0;
            for (uint256 i = 0; i < submittersCount; i++) {
                address w = workers[i];
                uint256 p = bountiful.pendingBalance(w);
                if (p > 0) {
                    uint256 balBefore = w.balance;
                    vm.prank(w);
                    bountiful.withdraw();
                    assertEq(w.balance, balBefore + p);
                    totalWithdrawn += p;
                }
            }
            assertEq(totalWithdrawn, rewardAmount, "Total withdrawn != reward");
        }

        // Contract balance for this bounty lifecycle returned to 0
        assertEq(address(bountiful).balance, 0);
    }
}
