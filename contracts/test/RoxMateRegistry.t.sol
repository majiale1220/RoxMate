// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RoxMateRegistry} from "../src/RoxMateRegistry.sol";

contract RoxMateRegistryTest is Test {
    RoxMateRegistry internal registry;
    uint256 internal keyA = 0xA11CE;
    uint256 internal keyB = 0xB0B;
    address internal memberA;
    address internal memberB;

    function setUp() public {
        registry = new RoxMateRegistry();
        address first = vm.addr(keyA);
        address second = vm.addr(keyB);
        if (first < second) {
            memberA = first;
            memberB = second;
        } else {
            memberA = second;
            memberB = first;
            (keyA, keyB) = (keyB, keyA);
        }
        vm.warp(1_000_000);
    }

    function _attestation(bytes32 dataHash, uint64 expectedRevision)
        internal
        view
        returns (RoxMateRegistry.ResultAttestation memory data)
    {
        data = RoxMateRegistry.ResultAttestation({
            eventKey: keccak256("hyrox-shanghai-2026-08-29"),
            memberA: memberA,
            memberB: memberB,
            raceDayStart: uint64(block.timestamp - 1 days),
            dataHash: dataHash,
            expectedRevision: expectedRevision,
            issuedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 300)
        });
    }

    function _sign(uint256 key, bytes32 digest) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function testConfirmResultAndIdentityCounters() public {
        RoxMateRegistry.ResultAttestation memory data = _attestation(keccak256("snapshot-1"), 0);
        bytes32 digest = registry.hashAttestation(data);
        registry.confirmResult(data, _sign(keyA, digest), _sign(keyB, digest));

        bytes32 resultId = registry.resultIdFor(data.eventKey, memberA, memberB);
        RoxMateRegistry.ResultHead memory head = registry.getResult(resultId);
        assertTrue(head.exists);
        assertEq(head.revision, 1);

        RoxMateRegistry.IdentityView memory identity = registry.getIdentity(memberA);
        assertEq(identity.confirmedRaceCount, 1);
        assertEq(identity.latestResultId, resultId);
    }

    function testRatingIsDirectionalAndCannotRepeat() public {
        RoxMateRegistry.ResultAttestation memory data = _attestation(keccak256("snapshot-1"), 0);
        bytes32 digest = registry.hashAttestation(data);
        registry.confirmResult(data, _sign(keyA, digest), _sign(keyB, digest));
        bytes32 resultId = registry.resultIdFor(data.eventKey, memberA, memberB);

        vm.prank(memberA);
        registry.rateResult(resultId, 1, RoxMateRegistry.Rating.GOOD);
        RoxMateRegistry.IdentityView memory identity = registry.getIdentity(memberB);
        assertEq(identity.goodCount, 1);
        assertEq(identity.distinctRaters, 1);

        vm.prank(memberA);
        vm.expectRevert(RoxMateRegistry.AlreadyRated.selector);
        registry.rateResult(resultId, 1, RoxMateRegistry.Rating.BAD);
    }

    function testCorrectionIncrementsRevisionWithoutNewRace() public {
        RoxMateRegistry.ResultAttestation memory first = _attestation(keccak256("snapshot-1"), 0);
        bytes32 firstDigest = registry.hashAttestation(first);
        registry.confirmResult(first, _sign(keyA, firstDigest), _sign(keyB, firstDigest));
        bytes32 resultId = registry.resultIdFor(first.eventKey, memberA, memberB);

        RoxMateRegistry.ResultAttestation memory correction = _attestation(keccak256("snapshot-2"), 1);
        bytes32 correctionDigest = registry.hashAttestation(correction);
        registry.confirmResult(correction, _sign(keyA, correctionDigest), _sign(keyB, correctionDigest));

        RoxMateRegistry.ResultHead memory head = registry.getResult(resultId);
        assertEq(head.revision, 2);
        assertEq(registry.getIdentity(memberA).confirmedRaceCount, 1);
    }

    function testPersonalProfileAndResultAreReadableOnChain() public {
        vm.prank(memberA);
        registry.updateProfile("Alice", "Shanghai", "HYROX", true, true);

        uint32[8] memory times;
        uint32[8] memory distances;
        uint16[8] memory loads;
        uint16[8] memory reps;
        times[0] = 138;
        distances[0] = 1000;
        bytes32 resultId = keccak256("personal-result-1");
        RoxMateRegistry.PersonalResultInput memory input = RoxMateRegistry.PersonalResultInput({
            resultId: resultId,
            eventKey: keccak256("event-1"),
            eventName: "HYROX Shanghai",
            location: "Shanghai",
            raceDayStart: uint64(block.timestamp - 1 days),
            division: 0,
            totalSec: 4200,
            runPaceSec: 312,
            scoreMask: 1,
            timeSec: times,
            distanceM: distances,
            loadKg: loads,
            reps: reps
        });
        vm.prank(memberA);
        registry.publishPersonalResult(input);

        RoxMateRegistry.Profile memory profile = registry.getProfile(memberA);
        assertEq(profile.displayName, "Alice");
        assertEq(profile.city, "Shanghai");
        assertTrue(profile.discoverable);
        RoxMateRegistry.PersonalResult memory result = registry.getPersonalResult(resultId);
        assertEq(result.owner, memberA);
        assertEq(result.eventName, "HYROX Shanghai");
        assertEq(result.timeSec[0], 138);
        assertEq(result.distanceM[0], 1000);
    }

    function testDiscoverableProfilePageIsBoundedToTenSourceEntries() public {
        for (uint256 i; i < 12; i++) {
            address member = address(uint160(100 + i));
            vm.prank(member);
            registry.updateProfile("Runner", "Shanghai", "", true, false);
        }
        (address[] memory page, uint256 next) = registry.getDiscoverableProfiles(0, 10);
        assertEq(page.length, 10);
        assertEq(next, 10);
    }

    function testDeclinedInvitationCanBeRetriedWithoutDuplicateConnection() public {
        vm.prank(memberA);
        registry.updateProfile("Alice", "Shanghai", "", true, false);
        vm.prank(memberB);
        registry.updateProfile("Bob", "Shanghai", "", true, false);

        vm.prank(memberA);
        registry.invitePartner(memberB);
        vm.prank(memberB);
        registry.respondPartner(memberA, false);
        vm.prank(memberA);
        registry.invitePartner(memberB);

        (address[] memory others, RoxMateRegistry.ConnectionStatus[] memory statuses, uint256 next) =
            registry.getConnections(memberA, 0, 10);
        assertEq(others.length, 1);
        assertEq(uint256(statuses[0]), uint256(RoxMateRegistry.ConnectionStatus.PENDING));
        assertEq(next, 1);
    }

    function testProfileRejectsOversizedInput() public {
        vm.prank(memberA);
        vm.expectRevert(RoxMateRegistry.InputTooLong.selector);
        registry.updateProfile(string(new bytes(161)), "Shanghai", "", true, false);
    }
}
