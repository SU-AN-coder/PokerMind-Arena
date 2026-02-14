# 模块三：链上可验证层

## 1. 模块概述

链上可验证层为 AI 决策提供透明性和可审计性，确保所有决策过程可追溯、防篡改。

### 1.1 核心职责
- 决策数据哈希计算与上链
- 智能合约存储与验证
- 提供审计查询接口
- 可选的零知识证明增强

### 1.2 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| 主链 | Monad Testnet | 高吞吐、低延迟、EVM兼容 |
| 备选 | Polygon Mumbai | 成熟稳定、免费测试 |
| 合约语言 | Solidity | 生态成熟、工具丰富 |
| 链下存储 | IPFS / Arweave | 完整决策数据永久存储 |

### 1.3 设计原则
- **最小化上链**：只上链哈希，完整数据链下存储
- **批量提交**：一局游戏结束后批量上链，降低成本
- **渐进式验证**：先跑通链下，再逐步上链

---

## 2. 数据结构设计

### 2.1 决策哈希结构

```typescript
interface DecisionCommitment {
  gameId: bytes32;           // 游戏唯一标识
  roundNumber: uint8;        // 回合数
  agentId: bytes32;          // AI 玩家标识
  decisionHash: bytes32;     // 决策内容哈希
  timestamp: uint64;         // Unix 时间戳
  previousHash: bytes32;     // 前一决策哈希（形成链）
}

// 哈希计算
// decisionHash = keccak256(abi.encodePacked(
//   gameState,
//   action,
//   amount,
//   reasoning,
//   timestamp
// ))
```

### 2.2 游戏结果结构

```typescript
interface GameResult {
  gameId: bytes32;
  startTime: uint64;
  endTime: uint64;
  players: bytes32[];        // 参与的 AI ID 列表
  winner: bytes32;           // 获胜者 ID
  finalChips: uint256[];     // 最终筹码分布
  decisionRootHash: bytes32; // 所有决策的 Merkle Root
  metadataURI: string;       // IPFS/Arweave 链接
}
```

---

## 3. 智能合约设计

### 3.1 合约架构

```
┌─────────────────────────────────────────────────────┐
│                  PokerVerifier.sol                  │
│  - 验证决策哈希                                      │
│  - 存储游戏结果                                      │
│  - 提供审计接口                                      │
└─────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│ GameRegistry.sol│ │AccessControl│ │ EventLogger.sol │
│ 游戏注册与管理   │ │   权限控制   │ │   事件记录      │
└─────────────────┘ └─────────────┘ └─────────────────┘
```

### 3.2 主合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract PokerVerifier is Ownable {
    
    // ============ 状态变量 ============
    
    struct GameRecord {
        bytes32 gameId;
        uint64 startTime;
        uint64 endTime;
        bytes32[] players;
        bytes32 winner;
        bytes32 decisionRootHash;
        string metadataURI;
        bool finalized;
    }
    
    // 游戏记录映射
    mapping(bytes32 => GameRecord) public games;
    
    // 单个决策哈希存储（可选，用于细粒度验证）
    mapping(bytes32 => mapping(uint256 => bytes32)) public decisionHashes;
    // gameId => roundNumber => decisionHash
    
    // 已验证的游戏列表
    bytes32[] public verifiedGames;
    
    // 授权的提交者地址
    mapping(address => bool) public authorizedSubmitters;
    
    // ============ 事件 ============
    
    event GameStarted(bytes32 indexed gameId, bytes32[] players, uint64 timestamp);
    event DecisionRecorded(bytes32 indexed gameId, uint256 roundNumber, bytes32 decisionHash);
    event GameFinalized(bytes32 indexed gameId, bytes32 winner, bytes32 merkleRoot);
    event VerificationResult(bytes32 indexed gameId, uint256 roundNumber, bool valid);
    
    // ============ 修饰器 ============
    
    modifier onlyAuthorized() {
        require(authorizedSubmitters[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    modifier gameExists(bytes32 gameId) {
        require(games[gameId].startTime > 0, "Game not found");
        _;
    }
    
    // ============ 管理函数 ============
    
    function setAuthorizedSubmitter(address submitter, bool authorized) external onlyOwner {
        authorizedSubmitters[submitter] = authorized;
    }
    
    // ============ 核心函数 ============
    
    /**
     * @notice 开始一局新游戏
     * @param gameId 游戏唯一标识
     * @param players 参与的 AI 玩家 ID
     */
    function startGame(
        bytes32 gameId, 
        bytes32[] calldata players
    ) external onlyAuthorized {
        require(games[gameId].startTime == 0, "Game already exists");
        
        games[gameId] = GameRecord({
            gameId: gameId,
            startTime: uint64(block.timestamp),
            endTime: 0,
            players: players,
            winner: bytes32(0),
            decisionRootHash: bytes32(0),
            metadataURI: "",
            finalized: false
        });
        
        emit GameStarted(gameId, players, uint64(block.timestamp));
    }
    
    /**
     * @notice 批量提交决策哈希（一局结束后调用）
     * @param gameId 游戏 ID
     * @param hashes 本局所有决策哈希数组
     */
    function submitDecisionBatch(
        bytes32 gameId,
        bytes32[] calldata hashes
    ) external onlyAuthorized gameExists(gameId) {
        require(!games[gameId].finalized, "Game already finalized");
        
        for (uint256 i = 0; i < hashes.length; i++) {
            decisionHashes[gameId][i] = hashes[i];
            emit DecisionRecorded(gameId, i, hashes[i]);
        }
    }
    
    /**
     * @notice 完成游戏并提交最终结果
     * @param gameId 游戏 ID
     * @param winner 获胜者 ID
     * @param merkleRoot 所有决策的 Merkle Root
     * @param metadataURI 完整数据的 IPFS/Arweave 链接
     */
    function finalizeGame(
        bytes32 gameId,
        bytes32 winner,
        bytes32 merkleRoot,
        string calldata metadataURI
    ) external onlyAuthorized gameExists(gameId) {
        require(!games[gameId].finalized, "Already finalized");
        
        GameRecord storage game = games[gameId];
        game.endTime = uint64(block.timestamp);
        game.winner = winner;
        game.decisionRootHash = merkleRoot;
        game.metadataURI = metadataURI;
        game.finalized = true;
        
        verifiedGames.push(gameId);
        
        emit GameFinalized(gameId, winner, merkleRoot);
    }
    
    // ============ 验证函数 ============
    
    /**
     * @notice 验证单个决策是否属于某局游戏
     * @param gameId 游戏 ID
     * @param roundNumber 回合数
     * @param decisionData 原始决策数据
     */
    function verifyDecision(
        bytes32 gameId,
        uint256 roundNumber,
        bytes calldata decisionData
    ) external view gameExists(gameId) returns (bool) {
        bytes32 computedHash = keccak256(decisionData);
        return decisionHashes[gameId][roundNumber] == computedHash;
    }
    
    /**
     * @notice 使用 Merkle Proof 验证决策
     * @param gameId 游戏 ID
     * @param decisionHash 待验证的决策哈希
     * @param proof Merkle 证明路径
     */
    function verifyWithMerkleProof(
        bytes32 gameId,
        bytes32 decisionHash,
        bytes32[] calldata proof
    ) external view gameExists(gameId) returns (bool) {
        require(games[gameId].finalized, "Game not finalized");
        return MerkleProof.verify(proof, games[gameId].decisionRootHash, decisionHash);
    }
    
    // ============ 查询函数 ============
    
    function getGame(bytes32 gameId) external view returns (GameRecord memory) {
        return games[gameId];
    }
    
    function getDecisionHash(bytes32 gameId, uint256 roundNumber) external view returns (bytes32) {
        return decisionHashes[gameId][roundNumber];
    }
    
    function getVerifiedGamesCount() external view returns (uint256) {
        return verifiedGames.length;
    }
    
    function getRecentGames(uint256 count) external view returns (bytes32[] memory) {
        uint256 len = verifiedGames.length;
        uint256 returnCount = count > len ? len : count;
        bytes32[] memory recent = new bytes32[](returnCount);
        
        for (uint256 i = 0; i < returnCount; i++) {
            recent[i] = verifiedGames[len - 1 - i];
        }
        return recent;
    }
}
```

### 3.3 事件日志合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PokerEventLogger {
    
    // 详细的游戏事件（用于前端回放）
    event DetailedAction(
        bytes32 indexed gameId,
        bytes32 indexed agentId,
        uint8 phase,           // 0=preflop, 1=flop, 2=turn, 3=river
        uint8 actionType,      // 0=fold, 1=check, 2=call, 3=raise, 4=all-in
        uint256 amount,
        uint64 timestamp
    );
    
    event PhaseChange(
        bytes32 indexed gameId,
        uint8 newPhase,
        bytes32 communityCardsHash
    );
    
    event PotUpdate(
        bytes32 indexed gameId,
        uint256 potSize,
        uint256[] playerChips
    );
    
    function logAction(
        bytes32 gameId,
        bytes32 agentId,
        uint8 phase,
        uint8 actionType,
        uint256 amount
    ) external {
        emit DetailedAction(
            gameId, 
            agentId, 
            phase, 
            actionType, 
            amount, 
            uint64(block.timestamp)
        );
    }
}
```

---

## 4. 链下服务层

### 4.1 哈希计算服务

```typescript
import { keccak256, toUtf8Bytes, AbiCoder } from 'ethers';

interface DecisionData {
  gameId: string;
  roundNumber: number;
  agentId: string;
  gameState: string;       // JSON 序列化
  action: string;
  amount?: number;
  reasoning: string;
  timestamp: number;
}

class HashService {
  
  /**
   * 计算决策哈希
   */
  computeDecisionHash(data: DecisionData): string {
    const abiCoder = new AbiCoder();
    
    const encoded = abiCoder.encode(
      ['bytes32', 'uint8', 'bytes32', 'string', 'string', 'uint256', 'string', 'uint64'],
      [
        this.stringToBytes32(data.gameId),
        data.roundNumber,
        this.stringToBytes32(data.agentId),
        data.gameState,
        data.action,
        data.amount || 0,
        data.reasoning,
        data.timestamp
      ]
    );
    
    return keccak256(encoded);
  }
  
  /**
   * 构建 Merkle Tree
   */
  buildMerkleTree(hashes: string[]): { root: string; proofs: Map<string, string[]> } {
    const tree = new MerkleTree(hashes, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    
    const proofs = new Map<string, string[]>();
    for (const hash of hashes) {
      proofs.set(hash, tree.getHexProof(hash));
    }
    
    return { root, proofs };
  }
  
  private stringToBytes32(str: string): string {
    return keccak256(toUtf8Bytes(str));
  }
}
```

### 4.2 链交互服务

```typescript
import { ethers, Contract, Wallet } from 'ethers';

interface ChainConfig {
  rpcUrl: string;
  contractAddress: string;
  privateKey: string;
}

class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private contract: Contract;
  private wallet: Wallet;
  
  constructor(config: ChainConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.privateKey, this.provider);
    this.contract = new Contract(
      config.contractAddress,
      POKER_VERIFIER_ABI,
      this.wallet
    );
  }
  
  /**
   * 开始游戏
   */
  async startGame(gameId: string, players: string[]): Promise<string> {
    const playerBytes = players.map(p => ethers.id(p));
    const tx = await this.contract.startGame(
      ethers.id(gameId),
      playerBytes
    );
    return tx.hash;
  }
  
  /**
   * 批量提交决策哈希
   */
  async submitDecisions(gameId: string, hashes: string[]): Promise<string> {
    const tx = await this.contract.submitDecisionBatch(
      ethers.id(gameId),
      hashes
    );
    return tx.hash;
  }
  
  /**
   * 完成游戏
   */
  async finalizeGame(
    gameId: string,
    winner: string,
    merkleRoot: string,
    metadataURI: string
  ): Promise<string> {
    const tx = await this.contract.finalizeGame(
      ethers.id(gameId),
      ethers.id(winner),
      merkleRoot,
      metadataURI
    );
    return tx.hash;
  }
  
  /**
   * 验证决策
   */
  async verifyDecision(
    gameId: string,
    roundNumber: number,
    decisionData: string
  ): Promise<boolean> {
    return await this.contract.verifyDecision(
      ethers.id(gameId),
      roundNumber,
      ethers.toUtf8Bytes(decisionData)
    );
  }
  
  /**
   * 获取游戏记录
   */
  async getGameRecord(gameId: string): Promise<any> {
    return await this.contract.getGame(ethers.id(gameId));
  }
}
```

### 4.3 IPFS 存储服务

```typescript
import { create, IPFSHTTPClient } from 'ipfs-http-client';

interface GameMetadata {
  gameId: string;
  players: AIPersonality[];
  timeline: DecisionLog[];
  result: GameResult;
  statistics: GameStatistics;
}

class IPFSStorageService {
  private client: IPFSHTTPClient;
  
  constructor(endpoint: string) {
    this.client = create({ url: endpoint });
  }
  
  /**
   * 上传游戏完整数据
   */
  async uploadGameData(metadata: GameMetadata): Promise<string> {
    const data = JSON.stringify(metadata);
    const result = await this.client.add(data);
    return `ipfs://${result.cid.toString()}`;
  }
  
  /**
   * 获取游戏数据
   */
  async getGameData(cid: string): Promise<GameMetadata> {
    const stream = this.client.cat(cid);
    let data = '';
    for await (const chunk of stream) {
      data += new TextDecoder().decode(chunk);
    }
    return JSON.parse(data);
  }
}
```

---

## 5. 验证流程

### 5.1 完整验证流程图

```
游戏进行中
    │
    ▼
┌─────────────────────────────────────┐
│  每个决策生成时，计算并存储哈希      │
│  hash = keccak256(gameState+action) │
└────────────────┬────────────────────┘
                 │
                 ▼
游戏结束
    │
    ▼
┌─────────────────────────────────────┐
│  构建 Merkle Tree                   │
│  root = buildMerkleTree(allHashes)  │
└────────────────┬────────────────────┘
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│ 上链 Merkle  │      │ 上传完整数据     │
│ Root + 结果  │      │ 到 IPFS          │
└──────────────┘      └──────────────────┘
                 │
                 ▼
         任意时刻可验证
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│ 链上快速验证 │      │ 完整数据审计     │
│ (Merkle Proof)│     │ (从 IPFS 获取)   │
└──────────────┘      └──────────────────┘
```

### 5.2 验证接口实现

```typescript
class VerificationService {
  private blockchain: BlockchainService;
  private ipfs: IPFSStorageService;
  private hashService: HashService;
  
  /**
   * 快速验证：使用 Merkle Proof
   */
  async quickVerify(
    gameId: string,
    roundNumber: number,
    claimedDecision: DecisionData
  ): Promise<VerificationResult> {
    // 1. 计算声称决策的哈希
    const computedHash = this.hashService.computeDecisionHash(claimedDecision);
    
    // 2. 从链上获取游戏记录
    const gameRecord = await this.blockchain.getGameRecord(gameId);
    
    // 3. 获取存储的 Merkle Proof（通常缓存在链下）
    const proof = await this.getStoredProof(gameId, computedHash);
    
    // 4. 验证
    const isValid = await this.blockchain.verifyWithMerkleProof(
      gameId,
      computedHash,
      proof
    );
    
    return {
      valid: isValid,
      computedHash,
      storedRoot: gameRecord.decisionRootHash,
      timestamp: Date.now()
    };
  }
  
  /**
   * 完整审计：从 IPFS 获取并验证所有数据
   */
  async fullAudit(gameId: string): Promise<AuditReport> {
    // 1. 获取链上记录
    const gameRecord = await this.blockchain.getGameRecord(gameId);
    
    // 2. 从 IPFS 获取完整数据
    const fullData = await this.ipfs.getGameData(gameRecord.metadataURI);
    
    // 3. 重新计算所有哈希
    const recomputedHashes = fullData.timeline.map(decision => 
      this.hashService.computeDecisionHash(decision)
    );
    
    // 4. 重建 Merkle Tree
    const { root } = this.hashService.buildMerkleTree(recomputedHashes);
    
    // 5. 验证 Root 是否匹配
    const isValid = root === gameRecord.decisionRootHash;
    
    return {
      gameId,
      valid: isValid,
      onChainRoot: gameRecord.decisionRootHash,
      recomputedRoot: root,
      totalDecisions: fullData.timeline.length,
      auditTimestamp: Date.now()
    };
  }
}

interface VerificationResult {
  valid: boolean;
  computedHash: string;
  storedRoot: string;
  timestamp: number;
}

interface AuditReport {
  gameId: string;
  valid: boolean;
  onChainRoot: string;
  recomputedRoot: string;
  totalDecisions: number;
  auditTimestamp: number;
}
```

---

## 6. 部署配置

### 6.1 网络配置

```typescript
const NETWORK_CONFIGS = {
  monad_testnet: {
    chainId: 10143,
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    explorerUrl: 'https://testnet-explorer.monad.xyz',
    nativeToken: 'MON'
  },
  polygon_mumbai: {
    chainId: 80001,
    rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY',
    explorerUrl: 'https://mumbai.polygonscan.com',
    nativeToken: 'MATIC'
  },
  localhost: {
    chainId: 31337,
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: '',
    nativeToken: 'ETH'
  }
};
```

### 6.2 Hardhat 部署脚本

```typescript
// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // 部署主合约
  const PokerVerifier = await ethers.getContractFactory("PokerVerifier");
  const verifier = await PokerVerifier.deploy();
  await verifier.waitForDeployment();
  
  console.log("PokerVerifier deployed to:", await verifier.getAddress());
  
  // 部署事件日志合约
  const EventLogger = await ethers.getContractFactory("PokerEventLogger");
  const logger = await EventLogger.deploy();
  await logger.waitForDeployment();
  
  console.log("PokerEventLogger deployed to:", await logger.getAddress());
  
  // 设置授权提交者
  await verifier.setAuthorizedSubmitter(deployer.address, true);
  console.log("Authorized submitter set");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## 7. 目录结构

```
src/
├── contracts/
│   ├── PokerVerifier.sol        # 主验证合约
│   ├── PokerEventLogger.sol     # 事件日志合约
│   └── interfaces/
│       └── IPokerVerifier.sol   # 接口定义
├── blockchain/
│   ├── index.ts                 # 模块入口
│   ├── blockchain-service.ts    # 链交互服务
│   ├── hash-service.ts          # 哈希计算服务
│   ├── ipfs-service.ts          # IPFS 存储服务
│   ├── verification-service.ts  # 验证服务
│   └── config/
│       └── networks.ts          # 网络配置
├── scripts/
│   ├── deploy.ts                # 部署脚本
│   └── verify-game.ts           # 验证脚本
└── test/
    └── contracts/
        ├── PokerVerifier.test.ts
        └── integration.test.ts
```

---

## 8. Gas 费用估算

| 操作 | Gas 估算 | Monad 费用 | Polygon 费用 |
|------|----------|------------|--------------|
| startGame | ~80,000 | ~$0.02 | ~$0.02 |
| submitDecisionBatch (20条) | ~200,000 | ~$0.05 | ~$0.05 |
| finalizeGame | ~100,000 | ~$0.03 | ~$0.03 |
| verifyWithMerkleProof | ~30,000 | ~$0.01 | ~$0.01 |

**单局游戏总成本**：约 $0.10 - $0.15

---

## 9. 开发计划

| 任务 | 预计时间 | 优先级 |
|------|----------|--------|
| 智能合约开发 | 4h | P0 |
| 合约测试 | 3h | P0 |
| 链下哈希服务 | 2h | P0 |
| Merkle Tree 实现 | 2h | P0 |
| 链交互服务 | 3h | P1 |
| IPFS 集成 | 2h | P1 |
| 验证 API | 2h | P1 |
| 部署脚本 | 1h | P2 |

**总计**: 约 19 小时（2.5个工作日）

---

## 10. 注意事项

1. **测试网优先**：始终在测试网完成开发和演示，主网部署为可选
2. **私钥安全**：使用环境变量管理私钥，绝不硬编码
3. **降级方案**：如果链上服务不可用，系统应能继续运行（只是无法验证）
4. **批量优化**：避免频繁小额交易，使用批量提交降低成本
5. **事件监听**：使用 WebSocket 订阅链上事件，实现实时同步
