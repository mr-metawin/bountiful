// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Bountiful} from "../src/Bountiful.sol";

contract BountifulHandler is Test {
    Bountiful public bountiful;

    address[] public actors;
    uint256[] public createdBountyIds;

    constructor(Bountiful _bountiful) {
        bountiful = _bountiful;
        for (uint160 i = 1; i <= 6; i++) {
            address actor = address(0xAA00 + i);
            vm.deal(actor, 1000 ether);
            actors.push(actor);
        }
    }

    function createBounty(uint8 actorSeed, uint96 amountSeed, uint8 subDays, uint8 revDays) public {
        address poster = actors[actorSeed % actors.length];
        uint256 amount = bound(amountSeed, 1 ether, 50 ether);
        uint32 submissionDays = uint32(bound(subDays, 1, 90));
        uint32 reviewDays = uint32(bound(revDays, 1, 14));

        vm.prank(poster);
        uint256 id = bountiful.createBounty{value: amount}(
            "Bounty Task",
            "Bounty Description for test",
            submissionDays,
            reviewDays
        );
        createdBountyIds.push(id);
    }

    function submit(uint8 actorSeed, uint256 bountyIdIndex) public {
        if (createdBountyIds.length == 0) return;
        uint256 id = createdBountyIds[bountyIdIndex % createdBountyIds.length];

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        if (b.status != Bountiful.Status.Open) return;
        if (block.timestamp > b.submissionDeadline) return;
        if (b.submissionCount >= 50) return;

        address worker = actors[actorSeed % actors.length];
        if (worker == b.poster) return;
        if (bountiful.hasSubmitted(id, worker)) return;

        vm.prank(worker);
        bountiful.submit(id, "Valid submission response");
    }

    function selectWinner(uint256 bountyIdIndex, uint256 subIdxSeed) public {
        if (createdBountyIds.length == 0) return;
        uint256 id = createdBountyIds[bountyIdIndex % createdBountyIds.length];

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        if (b.status != Bountiful.Status.Open) return;
        if (b.submissionCount == 0) return;
        if (block.timestamp > b.reviewDeadline) return;

        uint256 subIdx = subIdxSeed % b.submissionCount;
        vm.prank(b.poster);
        bountiful.selectWinner(id, subIdx);
    }

    function cancelBounty(uint256 bountyIdIndex) public {
        if (createdBountyIds.length == 0) return;
        uint256 id = createdBountyIds[bountyIdIndex % createdBountyIds.length];

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        if (b.status != Bountiful.Status.Open) return;
        if (b.submissionCount > 0) return;

        vm.prank(b.poster);
        bountiful.cancelBounty(id);
    }

    function splitIfAbandoned(uint256 bountyIdIndex, uint8 callerSeed) public {
        if (createdBountyIds.length == 0) return;
        uint256 id = createdBountyIds[bountyIdIndex % createdBountyIds.length];

        Bountiful.Bounty memory b = bountiful.getBounty(id);
        if (b.status != Bountiful.Status.Open) return;
        if (b.submissionCount == 0) return;
        if (block.timestamp <= b.reviewDeadline) return;

        address caller = actors[callerSeed % actors.length];
        vm.prank(caller);
        bountiful.splitIfAbandoned(id);
    }

    function withdraw(uint8 actorSeed) public {
        address actor = actors[actorSeed % actors.length];
        uint256 bal = bountiful.pendingBalance(actor);
        if (bal == 0) return;

        vm.prank(actor);
        bountiful.withdraw();
    }

    function warpTime(uint32 daysToWarp) public {
        uint256 warpSec = bound(daysToWarp, 1, 100) * 1 days;
        vm.warp(block.timestamp + warpSec);
    }

    function getCreatedBountyIds() external view returns (uint256[] memory) {
        return createdBountyIds;
    }

    function getActors() external view returns (address[] memory) {
        return actors;
    }
}

contract BountifulInvariantTest is StdInvariant, Test {
    Bountiful public bountiful;
    BountifulHandler public handler;

    function setUp() public {
        bountiful = new Bountiful();
        handler = new BountifulHandler(bountiful);

        targetContract(address(handler));
    }

    function invariant_BalanceEqualsOpenBountiesPlusPendingBalances() public view {
        uint256 totalOpenRewards = 0;
        uint256 count = bountiful.bountyCount();

        for (uint256 i = 1; i <= count; i++) {
            Bountiful.Bounty memory b = bountiful.getBounty(i);
            if (b.status == Bountiful.Status.Open) {
                totalOpenRewards += b.reward;
            }
        }

        uint256 totalPendingBalances = 0;
        address[] memory actors = handler.getActors();
        for (uint256 i = 0; i < actors.length; i++) {
            totalPendingBalances += bountiful.pendingBalance(actors[i]);
        }

        assertEq(
            address(bountiful).balance,
            totalOpenRewards + totalPendingBalances,
            "Invariant violation: contract balance does not equal open rewards + pending balances"
        );
    }
}
