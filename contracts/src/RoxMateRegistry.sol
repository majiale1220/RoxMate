// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title RoxMateRegistry
/// @notice Stores public RoxMate identities, personal results and reputation on-chain.
/// @dev The original jointly-signed result API is retained for backwards compatibility.
///      New personal records use the chain as their source of truth; drafts and AI output
///      are intentionally not contract state.
contract RoxMateRegistry is EIP712 {
    using ECDSA for bytes32;

    enum Rating {
        NONE,
        GOOD,
        BAD
    }

    struct ResultAttestation {
        bytes32 eventKey;
        address memberA;
        address memberB;
        uint64 raceDayStart;
        bytes32 dataHash;
        uint64 expectedRevision;
        uint64 issuedAt;
        uint64 deadline;
    }

    struct ResultHead {
        bytes32 eventKey;
        address memberA;
        address memberB;
        uint64 raceDayStart;
        bytes32 currentHash;
        uint64 revision;
        uint64 firstConfirmedAt;
        bool exists;
    }

    struct IdentityView {
        bytes32 latestResultId;
        uint64 confirmedRaceCount;
        uint64 goodCount;
        uint64 badCount;
        uint64 distinctRaters;
    }

    struct RatingView {
        Rating value;
        uint64 ratedRevision;
        uint64 createdAt;
    }

    /// @dev Eight fixed HYROX stations. A bit in scoreMask means the corresponding slot exists.
    struct PersonalResult {
        bytes32 resultId;
        address owner;
        bytes32 eventKey;
        string eventName;
        string location;
        uint64 raceDayStart;
        uint8 division;
        uint32 totalSec;
        uint32 runPaceSec;
        uint8 scoreMask;
        uint32[8] timeSec;
        uint32[8] distanceM;
        uint16[8] loadKg;
        uint16[8] reps;
        uint64 revision;
        bool published;
    }

    struct PersonalResultInput {
        bytes32 resultId;
        bytes32 eventKey;
        string eventName;
        string location;
        uint64 raceDayStart;
        uint8 division;
        uint32 totalSec;
        uint32 runPaceSec;
        uint8 scoreMask;
        uint32[8] timeSec;
        uint32[8] distanceM;
        uint16[8] loadKg;
        uint16[8] reps;
    }

    struct Profile {
        string displayName;
        string city;
        string bio;
        bool discoverable;
        bool aiConsent;
        uint64 revision;
        bool exists;
    }

    enum ConnectionStatus {
        NONE,
        PENDING,
        ACCEPTED,
        DECLINED
    }

    uint8 public constant MAX_MATCH_SCAN = 10;
    uint8 public constant STATION_COUNT = 8;

    bytes32 private constant RESULT_ATTESTATION_TYPEHASH = keccak256(
        "ResultAttestation(bytes32 eventKey,address memberA,address memberB,uint64 raceDayStart,bytes32 dataHash,uint64 expectedRevision,uint64 issuedAt,uint64 deadline)"
    );

    mapping(bytes32 resultId => ResultHead head) private _results;
    mapping(bytes32 resultId => mapping(address rater => RatingView rating)) private _ratings;
    mapping(address member => bytes32 resultId) private _latestResultId;
    mapping(address member => uint64) private _confirmedRaceCount;
    mapping(address member => uint64) private _goodCount;
    mapping(address member => uint64) private _badCount;
    mapping(address member => uint64) private _distinctRaters;
    mapping(address member => uint64) private _latestRaceDay;
    mapping(address subject => mapping(address rater => bool)) private _seenRater;
    mapping(address member => Profile) private _profiles;
    address[] private _profileOwners;
    mapping(bytes32 resultId => PersonalResult) private _personalResults;
    mapping(address owner => bytes32[]) private _personalResultIds;
    mapping(address member => mapping(address other => ConnectionStatus)) private _connections;
    mapping(address member => address[]) private _connectionList;
    mapping(bytes32 resultId => mapping(address rater => RatingView)) private _personalRatings;
    mapping(bytes32 resultId => mapping(address rater => string)) private _personalComments;
    mapping(bytes32 resultId => address[]) private _personalRaters;

    error InvalidParticipants();
    error InvalidAttestationWindow();
    error FutureRaceDay();
    error EmptyDataHash();
    error InvalidSignature();
    error UnknownResult();
    error RevisionConflict(uint64 expected, uint64 actual);
    error ImmutableFieldsChanged();
    error SameResultHash();
    error NotParticipant();
    error InvalidRating();
    error AlreadyRated();
    error ProfileNotFound();
    error InvalidResultId();
    error InvalidDivision();
    error EmptyPersonalResult();
    error NotResultOwner();
    error ResultAlreadyPublished();
    error InvalidScanLimit();
    error InvalidConnection();
    error NotInviteRecipient();
    error NotPartner();
    error InputTooLong();

    event ResultConfirmed(
        bytes32 indexed resultId,
        address indexed memberA,
        address indexed memberB,
        bytes32 eventKey,
        uint64 raceDayStart,
        uint64 revision,
        bytes32 dataHash
    );

    event RatingSubmitted(
        bytes32 indexed resultId, address indexed rater, address indexed subject, Rating value, uint64 ratedRevision
    );

    event ProfileUpdated(address indexed member, uint64 revision, bool discoverable);
    event PersonalResultPublished(
        bytes32 indexed resultId,
        address indexed owner,
        bytes32 indexed eventKey,
        uint64 raceDayStart,
        uint8 division,
        uint64 revision
    );
    event PartnerInvited(address indexed requester, address indexed recipient);
    event PartnerResponded(address indexed requester, address indexed recipient, ConnectionStatus status);
    event PersonalRatingSubmitted(
        bytes32 indexed resultId, address indexed rater, address indexed subject, Rating value
    );

    constructor() EIP712("RoxMateRegistry", "2") {}

    function confirmResult(ResultAttestation calldata data, bytes calldata signatureA, bytes calldata signatureB)
        external
    {
        _validateAttestation(data);
        bytes32 resultId = resultIdFor(data.eventKey, data.memberA, data.memberB);
        bytes32 digest = _hashAttestation(data);

        if (digest.recover(signatureA) != data.memberA || digest.recover(signatureB) != data.memberB) {
            revert InvalidSignature();
        }

        ResultHead storage head = _results[resultId];
        if (!head.exists) {
            if (data.expectedRevision != 0) revert RevisionConflict(0, data.expectedRevision);
            head.exists = true;
            head.eventKey = data.eventKey;
            head.memberA = data.memberA;
            head.memberB = data.memberB;
            head.raceDayStart = data.raceDayStart;
            head.firstConfirmedAt = uint64(block.timestamp);
            head.revision = 1;
            _confirmedRaceCount[data.memberA] += 1;
            _confirmedRaceCount[data.memberB] += 1;
            _updateLatest(data.memberA, resultId, data.raceDayStart);
            _updateLatest(data.memberB, resultId, data.raceDayStart);
        } else {
            if (data.expectedRevision != head.revision) {
                revert RevisionConflict(data.expectedRevision, head.revision);
            }
            if (
                data.eventKey != head.eventKey || data.memberA != head.memberA || data.memberB != head.memberB
                    || data.raceDayStart != head.raceDayStart
            ) revert ImmutableFieldsChanged();
            if (data.dataHash == head.currentHash) revert SameResultHash();
            head.revision += 1;
        }

        head.currentHash = data.dataHash;
        emit ResultConfirmed(
            resultId, head.memberA, head.memberB, head.eventKey, head.raceDayStart, head.revision, head.currentHash
        );
    }

    function rateResult(bytes32 resultId, uint64 expectedRevision, Rating value) external {
        ResultHead storage head = _results[resultId];
        if (!head.exists) revert UnknownResult();
        if (expectedRevision != head.revision) revert RevisionConflict(expectedRevision, head.revision);
        if (value == Rating.NONE) revert InvalidRating();

        address subject;
        if (msg.sender == head.memberA) subject = head.memberB;
        else if (msg.sender == head.memberB) subject = head.memberA;
        else revert NotParticipant();

        RatingView storage previous = _ratings[resultId][msg.sender];
        if (previous.value != Rating.NONE) revert AlreadyRated();

        previous.value = value;
        previous.ratedRevision = head.revision;
        previous.createdAt = uint64(block.timestamp);
        if (value == Rating.GOOD) _goodCount[subject] += 1;
        else _badCount[subject] += 1;
        if (!_seenRater[subject][msg.sender]) {
            _seenRater[subject][msg.sender] = true;
            _distinctRaters[subject] += 1;
        }
        emit RatingSubmitted(resultId, msg.sender, subject, value, head.revision);
    }

    function resultIdFor(bytes32 eventKey, address memberA, address memberB) public view returns (bytes32) {
        if (memberA == address(0) || memberB == address(0) || memberA >= memberB) {
            revert InvalidParticipants();
        }
        return keccak256(abi.encode(block.chainid, address(this), eventKey, memberA, memberB));
    }

    function hashAttestation(ResultAttestation calldata data) external view returns (bytes32) {
        return _hashAttestation(data);
    }

    function getResult(bytes32 resultId) external view returns (ResultHead memory) {
        return _results[resultId];
    }

    function getIdentity(address member) external view returns (IdentityView memory) {
        return IdentityView({
            latestResultId: _latestResultId[member],
            confirmedRaceCount: _confirmedRaceCount[member],
            goodCount: _goodCount[member],
            badCount: _badCount[member],
            distinctRaters: _distinctRaters[member]
        });
    }

    function getRating(bytes32 resultId, address rater) external view returns (RatingView memory) {
        return _ratings[resultId][rater];
    }

    /// @notice Creates or updates the public identity card. No contact or precise training
    /// schedule is accepted by design; those fields must never enter public chain state.
    function updateProfile(
        string calldata displayName,
        string calldata city,
        string calldata bio,
        bool discoverable,
        bool aiConsent
    ) external {
        if (bytes(displayName).length == 0 || bytes(city).length == 0) revert InvalidParticipants();
        if (bytes(displayName).length > 160 || bytes(city).length > 240 || bytes(bio).length > 1200) {
            revert InputTooLong();
        }
        Profile storage profile = _profiles[msg.sender];
        if (!profile.exists) {
            profile.exists = true;
            _profileOwners.push(msg.sender);
        }
        profile.displayName = displayName;
        profile.city = city;
        profile.bio = bio;
        profile.discoverable = discoverable;
        profile.aiConsent = aiConsent;
        profile.revision += 1;
        emit ProfileUpdated(msg.sender, profile.revision, discoverable);
    }

    function getProfile(address member) external view returns (Profile memory) {
        return _profiles[member];
    }

    function profileCount() external view returns (uint256) {
        return _profileOwners.length;
    }

    /// @notice Bounded cursor pagination. A caller can never force a full profile scan through
    /// this read API; the UI should request another page explicitly when needed.
    function getDiscoverableProfiles(uint256 cursor, uint8 limit)
        external
        view
        returns (address[] memory members, uint256 nextCursor)
    {
        if (limit == 0 || limit > MAX_MATCH_SCAN) revert InvalidScanLimit();
        uint256 remaining = cursor < _profileOwners.length ? _profileOwners.length - cursor : 0;
        uint256 count = remaining < limit ? remaining : limit;
        members = new address[](count);
        uint256 found;
        uint256 i = cursor;
        // Inspect at most `limit` source entries. This is deliberately a bounded page, not
        // "find the next ten" pagination which could scan the entire registry.
        while (i < _profileOwners.length && i < cursor + count) {
            address member = _profileOwners[i];
            if (_profiles[member].discoverable) {
                members[found] = member;
                found += 1;
            }
            i += 1;
        }
        nextCursor = i;
        assembly { mstore(members, found) }
    }

    /// @notice Publishes one immutable personal result. The sender pays this transaction's gas.
    function publishPersonalResult(PersonalResultInput calldata input) external {
        if (!_profiles[msg.sender].exists) revert ProfileNotFound();
        if (input.resultId == bytes32(0) || input.eventKey == bytes32(0)) revert InvalidResultId();
        if (bytes(input.eventName).length == 0 || bytes(input.location).length == 0) revert InvalidResultId();
        if (bytes(input.eventName).length > 480 || bytes(input.location).length > 640) revert InputTooLong();
        if (input.division > 4) revert InvalidDivision();
        if (input.scoreMask == 0) revert EmptyPersonalResult();
        if (input.raceDayStart > block.timestamp) revert FutureRaceDay();
        for (uint256 i; i < STATION_COUNT; i++) {
            if ((input.scoreMask & uint8(1 << i)) != 0 && input.timeSec[i] == 0) revert EmptyPersonalResult();
        }
        PersonalResult storage result = _personalResults[input.resultId];
        if (result.published) revert ResultAlreadyPublished();
        result.resultId = input.resultId;
        result.owner = msg.sender;
        result.eventKey = input.eventKey;
        result.eventName = input.eventName;
        result.location = input.location;
        result.raceDayStart = input.raceDayStart;
        result.division = input.division;
        result.totalSec = input.totalSec;
        result.runPaceSec = input.runPaceSec;
        result.scoreMask = input.scoreMask;
        result.timeSec = input.timeSec;
        result.distanceM = input.distanceM;
        result.loadKg = input.loadKg;
        result.reps = input.reps;
        result.revision = 1;
        result.published = true;
        _personalResultIds[msg.sender].push(input.resultId);
        emit PersonalResultPublished(input.resultId, msg.sender, input.eventKey, input.raceDayStart, input.division, 1);
    }

    function getPersonalResult(bytes32 resultId) external view returns (PersonalResult memory) {
        PersonalResult memory result = _personalResults[resultId];
        if (!result.published) revert UnknownResult();
        return result;
    }

    function getPersonalResultIds(address owner, uint256 cursor, uint8 limit)
        external
        view
        returns (bytes32[] memory ids, uint256 nextCursor)
    {
        if (limit == 0 || limit > MAX_MATCH_SCAN) revert InvalidScanLimit();
        bytes32[] storage source = _personalResultIds[owner];
        uint256 remaining = cursor < source.length ? source.length - cursor : 0;
        uint256 count = remaining < limit ? remaining : limit;
        ids = new bytes32[](count);
        for (uint256 i; i < count; i++) {
            ids[i] = source[cursor + i];
        }
        nextCursor = cursor + count;
    }

    function invitePartner(address recipient) external {
        if (
            recipient == address(0) || recipient == msg.sender || !_profiles[msg.sender].exists
                || !_profiles[recipient].exists
        ) revert InvalidConnection();
        if (!_profiles[recipient].discoverable) revert InvalidConnection();
        if (
            _connections[msg.sender][recipient] != ConnectionStatus.NONE
                && _connections[msg.sender][recipient] != ConnectionStatus.DECLINED
        ) revert InvalidConnection();
        if (
            _connections[recipient][msg.sender] == ConnectionStatus.ACCEPTED
                || _connections[recipient][msg.sender] == ConnectionStatus.PENDING
        ) revert InvalidConnection();
        bool isNewConnection = _connections[msg.sender][recipient] == ConnectionStatus.NONE;
        _connections[msg.sender][recipient] = ConnectionStatus.PENDING;
        _connections[recipient][msg.sender] = ConnectionStatus.PENDING;
        if (isNewConnection) {
            _connectionList[msg.sender].push(recipient);
            _connectionList[recipient].push(msg.sender);
        }
        emit PartnerInvited(msg.sender, recipient);
    }

    function respondPartner(address requester, bool accept) external {
        if (_connections[requester][msg.sender] != ConnectionStatus.PENDING) revert NotInviteRecipient();
        ConnectionStatus status = accept ? ConnectionStatus.ACCEPTED : ConnectionStatus.DECLINED;
        _connections[requester][msg.sender] = status;
        _connections[msg.sender][requester] = status;
        emit PartnerResponded(requester, msg.sender, status);
    }

    function getConnection(address member, address other) external view returns (ConnectionStatus) {
        return _connections[member][other];
    }

    function getConnections(address member, uint256 cursor, uint8 limit)
        external
        view
        returns (address[] memory others, ConnectionStatus[] memory statuses, uint256 nextCursor)
    {
        if (limit == 0 || limit > MAX_MATCH_SCAN) revert InvalidScanLimit();
        address[] storage source = _connectionList[member];
        uint256 remaining = cursor < source.length ? source.length - cursor : 0;
        uint256 count = remaining < limit ? remaining : limit;
        others = new address[](count);
        statuses = new ConnectionStatus[](count);
        for (uint256 i; i < count; i++) {
            address other = source[cursor + i];
            others[i] = other;
            statuses[i] = _connections[member][other];
        }
        nextCursor = cursor + count;
    }

    function ratePersonalResult(bytes32 resultId, Rating value, string calldata comment) external {
        PersonalResult storage result = _personalResults[resultId];
        if (!result.published) revert UnknownResult();
        if (value == Rating.NONE || result.owner == msg.sender) revert InvalidRating();
        if (bytes(comment).length > 2000) revert InputTooLong();
        if (_connections[result.owner][msg.sender] != ConnectionStatus.ACCEPTED) revert NotPartner();
        if (_personalRatings[resultId][msg.sender].value != Rating.NONE) revert AlreadyRated();
        _personalRatings[resultId][msg.sender] = RatingView(value, result.revision, uint64(block.timestamp));
        _personalComments[resultId][msg.sender] = comment;
        _personalRaters[resultId].push(msg.sender);
        if (value == Rating.GOOD) _goodCount[result.owner] += 1;
        else _badCount[result.owner] += 1;
        if (!_seenRater[result.owner][msg.sender]) {
            _seenRater[result.owner][msg.sender] = true;
            _distinctRaters[result.owner] += 1;
        }
        emit PersonalRatingSubmitted(resultId, msg.sender, result.owner, value);
    }

    function getPersonalRating(bytes32 resultId, address rater) external view returns (RatingView memory) {
        return _personalRatings[resultId][rater];
    }

    function getPersonalRatingComment(bytes32 resultId, address rater) external view returns (string memory) {
        return _personalComments[resultId][rater];
    }

    function getPersonalRaters(bytes32 resultId, uint256 cursor, uint8 limit)
        external
        view
        returns (address[] memory raters, uint256 nextCursor)
    {
        if (limit == 0 || limit > MAX_MATCH_SCAN) revert InvalidScanLimit();
        address[] storage source = _personalRaters[resultId];
        uint256 remaining = cursor < source.length ? source.length - cursor : 0;
        uint256 count = remaining < limit ? remaining : limit;
        raters = new address[](count);
        for (uint256 i; i < count; i++) {
            raters[i] = source[cursor + i];
        }
        nextCursor = cursor + count;
    }

    function _validateAttestation(ResultAttestation calldata data) internal view {
        if (
            data.memberA == address(0) || data.memberB == address(0) || data.memberA >= data.memberB
                || data.memberA == data.memberB
        ) revert InvalidParticipants();
        if (data.dataHash == bytes32(0)) revert EmptyDataHash();
        if (data.raceDayStart > block.timestamp) revert FutureRaceDay();
        if (
            data.issuedAt > block.timestamp || data.deadline < block.timestamp || data.deadline <= data.issuedAt
                || data.deadline - data.issuedAt > 900
        ) revert InvalidAttestationWindow();
    }

    function _hashAttestation(ResultAttestation calldata data) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    RESULT_ATTESTATION_TYPEHASH,
                    data.eventKey,
                    data.memberA,
                    data.memberB,
                    data.raceDayStart,
                    data.dataHash,
                    data.expectedRevision,
                    data.issuedAt,
                    data.deadline
                )
            )
        );
    }

    function _updateLatest(address member, bytes32 resultId, uint64 raceDayStart) internal {
        if (raceDayStart >= _latestRaceDay[member]) {
            _latestRaceDay[member] = raceDayStart;
            _latestResultId[member] = resultId;
        }
    }
}
