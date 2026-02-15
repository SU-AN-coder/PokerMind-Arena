// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GameVerifier
 * @notice PokerMind Arena 游戏验证合约
 */
contract GameVerifier {
    
    struct GameCommitment {
        bytes32 decisionHash;
        string ipfsCid;
        uint256 timestamp;
        address submitter;
    }
    
    mapping(bytes32 => GameCommitment) public games;
    bytes32[] public gameIds;
    address public owner;
    
    event GameCommitted(
        bytes32 indexed gameId,
        bytes32 decisionHash,
        string ipfsCid,
        uint256 timestamp
    );
    
    event VerificationPerformed(
        bytes32 indexed gameId,
        bytes32 providedHash,
        bool matched
    );
    
    constructor() {
        owner = msg.sender;
    }
    
    function commitGame(
        bytes32 gameId,
        bytes32 decisionHash,
        string calldata ipfsCid
    ) external {
        require(games[gameId].timestamp == 0, "Game already exists");
        
        games[gameId] = GameCommitment({
            decisionHash: decisionHash,
            ipfsCid: ipfsCid,
            timestamp: block.timestamp,
            submitter: msg.sender
        });
        
        gameIds.push(gameId);
        
        emit GameCommitted(gameId, decisionHash, ipfsCid, block.timestamp);
    }
    
    function verifyHashView(
        bytes32 gameId,
        string calldata rawDecisionsJson
    ) external view returns (bool matched, bytes32 storedHash, bytes32 computedHash) {
        require(games[gameId].timestamp > 0, "Game not found");
        
        storedHash = games[gameId].decisionHash;
        computedHash = keccak256(bytes(rawDecisionsJson));
        matched = (storedHash == computedHash);
    }
    
    function verifyAndEmit(
        bytes32 gameId,
        string calldata rawDecisionsJson
    ) external returns (bool matched) {
        bytes32 storedHash = games[gameId].decisionHash;
        bytes32 computedHash = keccak256(bytes(rawDecisionsJson));
        matched = (storedHash == computedHash);
        
        emit VerificationPerformed(gameId, computedHash, matched);
    }
    
    function getGame(bytes32 gameId) external view returns (
        bytes32 decisionHash,
        string memory ipfsCid,
        uint256 timestamp,
        address submitter
    ) {
        GameCommitment memory g = games[gameId];
        return (g.decisionHash, g.ipfsCid, g.timestamp, g.submitter);
    }
    
    function getGameCount() external view returns (uint256) {
        return gameIds.length;
    }
    
    function gameExists(bytes32 gameId) external view returns (bool) {
        return games[gameId].timestamp > 0;
    }
}
