# 模块三：链上可验证层（最终版）

> **状态**: 补强后 | **优先级**: P0 | **预计时间**: 6h

## 1. 设计目标

### 🎯 核心目标：演示时能"秀"出可验证性

评委不会在现场跑复杂的Merkle Proof脚本，但他们会被以下场景打动：

1. 点击按钮 → 从IPFS下载原始数据
2. 页面显示 → 本地计算的Hash
3. 对比显示 → 链上存储的Hash
4. ✅ 匹配成功 → "数据未被篡改"

### 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 链 | Monad Testnet | 赛道相关 |
| 存储 | web3.storage (IPFS) | 免费、简单 |
| 合约 | 极简版 (~40行) | 够用就好 |

---

## 2. 可验证性架构

```
游戏结束
    │
    ▼
┌────────────────────────────────────┐
│  生成 GameLog JSON                 │
│  {                                 │
│    gameId: "game_001",             │
│    players: [...],                 │
│    decisions: [                    │
│      { ai: "火焰", action: "allin",│
│        speech: "@冰山你又缩了？",   │
│        timestamp: 1234567890 },    │
│      ...                           │
│    ],                              │
│    winner: "火焰",                 │
│    pot: 800                        │
│  }                                 │
└─────────────┬──────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌──────────┐    ┌──────────────────────┐
│ 计算Hash │    │  上传 IPFS           │
│ keccak256│    │  获得 CID:           │
│ (JSON)   │    │  bafybei...          │
└────┬─────┘    └──────────┬───────────┘
     │                     │
     └──────────┬──────────┘
                │
                ▼
┌────────────────────────────────────┐
│  调用合约                          │
│  commitGame(gameId, hash, cid)     │
└─────────────┬──────────────────────┘
              │
              ▼
┌────────────────────────────────────┐
│  前端展示                          │
│  🔗 "Game committed on Monad!"     │
│  📜 View Transaction →             │
│  📦 View on IPFS →                 │
│  ✅ Verify Hash →  [新增按钮]       │
└────────────────────────────────────┘
```

---

## 3. 智能合约（补强版）

### 关键改进：增加 `verifyHash()` 函数

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GameVerifier - PokerMind Arena 游戏验证合约
/// @notice 存储游戏决策哈希，支持链上验证
contract GameVerifier {
    
    // ============ 数据结构 ============
    
    struct GameCommitment {
        bytes32 decisionHash;    // keccak256(所有决策JSON)
        string ipfsCid;          // IPFS CID
        uint256 timestamp;       // 提交时间
        address submitter;       // 提交者
    }
    
    // gameId => commitment
    mapping(bytes32 => GameCommitment) public games;
    
    // 已记录的游戏列表
    bytes32[] public gameIds;
    
    // ============ 事件 ============
    
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
    
    // ============ 核心函数 ============
    
    /// @notice 提交游戏记录
    /// @param gameId 游戏唯一ID
    /// @param decisionHash 所有决策的keccak256哈希
    /// @param ipfsCid IPFS CID
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
    
    /// @notice 验证决策哈希 [核心：用于演示]
    /// @param gameId 游戏ID
    /// @param rawDecisionsJson 原始决策JSON字符串
    /// @return matched 是否匹配
    /// @return storedHash 链上存储的哈希
    /// @return computedHash 计算得到的哈希
    function verifyHash(
        bytes32 gameId,
        string calldata rawDecisionsJson
    ) external returns (bool matched, bytes32 storedHash, bytes32 computedHash) {
        require(games[gameId].timestamp > 0, "Game not found");
        
        storedHash = games[gameId].decisionHash;
        computedHash = keccak256(bytes(rawDecisionsJson));
        matched = (storedHash == computedHash);
        
        emit VerificationPerformed(gameId, computedHash, matched);
        
        return (matched, storedHash, computedHash);
    }
    
    /// @notice 纯视图验证（不产生事件，省Gas）
    function verifyHashView(
        bytes32 gameId,
        string calldata rawDecisionsJson
    ) external view returns (bool matched, bytes32 storedHash, bytes32 computedHash) {
        require(games[gameId].timestamp > 0, "Game not found");
        
        storedHash = games[gameId].decisionHash;
        computedHash = keccak256(bytes(rawDecisionsJson));
        matched = (storedHash == computedHash);
        
        return (matched, storedHash, computedHash);
    }
    
    // ============ 查询函数 ============
    
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
    
    function getRecentGames(uint256 count) external view returns (bytes32[] memory) {
        uint256 len = gameIds.length;
        uint256 returnCount = count > len ? len : count;
        bytes32[] memory recent = new bytes32[](returnCount);
        
        for (uint256 i = 0; i < returnCount; i++) {
            recent[i] = gameIds[len - 1 - i];
        }
        return recent;
    }
}
```

---

## 4. 后端服务

### 4.1 Hash计算服务

```typescript
import { keccak256, toUtf8Bytes, id } from 'ethers';

interface GameLog {
  gameId: string;
  players: { id: string; name: string; avatar: string }[];
  decisions: {
    aiId: string;
    action: 'allin' | 'fold';
    speech: string;
    timestamp: number;
  }[];
  communityCards: string[];
  winner: string;
  pot: number;
  endTime: number;
}

class HashService {
  /**
   * 计算游戏日志的哈希
   * 注意：JSON序列化必须稳定，不能有随机顺序
   */
  computeDecisionHash(gameLog: GameLog): string {
    // 确保JSON序列化顺序一致
    const stableJson = JSON.stringify(gameLog, Object.keys(gameLog).sort());
    return keccak256(toUtf8Bytes(stableJson));
  }
  
  /**
   * 计算gameId的bytes32表示
   */
  gameIdToBytes32(gameId: string): string {
    return id(gameId); // keccak256 of gameId string
  }
}
```

### 4.2 链交互服务

```typescript
import { ethers, Contract, Wallet } from 'ethers';
import { Web3Storage, File } from 'web3.storage';

const GAME_VERIFIER_ABI = [
  "function commitGame(bytes32 gameId, bytes32 decisionHash, string ipfsCid) external",
  "function verifyHashView(bytes32 gameId, string rawDecisionsJson) view returns (bool, bytes32, bytes32)",
  "function getGame(bytes32 gameId) view returns (bytes32, string, uint256, address)",
  "event GameCommitted(bytes32 indexed gameId, bytes32 decisionHash, string ipfsCid, uint256 timestamp)"
];

class VerificationService {
  private provider: ethers.JsonRpcProvider;
  private contract: Contract;
  private wallet: Wallet;
  private w3s: Web3Storage;
  private hashService: HashService;
  
  constructor(config: {
    rpcUrl: string;
    contractAddress: string;
    privateKey: string;
    web3StorageToken: string;
  }) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.privateKey, this.provider);
    this.contract = new Contract(config.contractAddress, GAME_VERIFIER_ABI, this.wallet);
    this.w3s = new Web3Storage({ token: config.web3StorageToken });
    this.hashService = new HashService();
  }
  
  /**
   * 完整流程：上传IPFS + 写入合约
   */
  async commitGame(gameLog: GameLog): Promise<{
    txHash: string;
    ipfsCid: string;
    decisionHash: string;
    explorerUrl: string;
  }> {
    // 1. 计算哈希
    const decisionHash = this.hashService.computeDecisionHash(gameLog);
    const gameIdBytes32 = this.hashService.gameIdToBytes32(gameLog.gameId);
    
    // 2. 上传到IPFS
    const jsonBlob = new Blob([JSON.stringify(gameLog, null, 2)], { type: 'application/json' });
    const file = new File([jsonBlob], `${gameLog.gameId}.json`);
    const cid = await this.w3s.put([file]);
    
    // 3. 写入合约
    const tx = await this.contract.commitGame(gameIdBytes32, decisionHash, cid);
    const receipt = await tx.wait();
    
    return {
      txHash: receipt.hash,
      ipfsCid: cid,
      decisionHash,
      explorerUrl: `https://explorer.monad.xyz/tx/${receipt.hash}`
    };
  }
  
  /**
   * 验证游戏（供前端调用）
   */
  async verifyGame(gameId: string, rawJson: string): Promise<{
    matched: boolean;
    storedHash: string;
    computedHash: string;
  }> {
    const gameIdBytes32 = this.hashService.gameIdToBytes32(gameId);
    const [matched, storedHash, computedHash] = await this.contract.verifyHashView(
      gameIdBytes32,
      rawJson
    );
    
    return { matched, storedHash, computedHash };
  }
  
  /**
   * 获取游戏的IPFS数据
   */
  async fetchGameData(ipfsCid: string): Promise<GameLog> {
    const response = await fetch(`https://w3s.link/ipfs/${ipfsCid}`);
    return response.json();
  }
}
```

### 4.3 API路由

```typescript
// routes/verify.ts
import { FastifyInstance } from 'fastify';

export async function verifyRoutes(app: FastifyInstance) {
  
  // 获取游戏链上记录
  app.get('/api/verify/:gameId', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    
    const record = await verificationService.getGameRecord(gameId);
    if (!record) {
      return reply.code(404).send({ error: 'Game not found on chain' });
    }
    
    return {
      gameId,
      decisionHash: record.decisionHash,
      ipfsCid: record.ipfsCid,
      timestamp: record.timestamp,
      ipfsUrl: `https://w3s.link/ipfs/${record.ipfsCid}`,
      explorerUrl: `https://explorer.monad.xyz/address/${CONTRACT_ADDRESS}`
    };
  });
  
  // 执行验证
  app.post('/api/verify/:gameId', async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const { rawJson } = request.body as { rawJson: string };
    
    const result = await verificationService.verifyGame(gameId, rawJson);
    
    return {
      gameId,
      verified: result.matched,
      storedHash: result.storedHash,
      computedHash: result.computedHash,
      message: result.matched 
        ? '✅ 数据完整性验证通过！链上哈希与原始数据匹配。'
        : '❌ 验证失败：数据可能已被篡改。'
    };
  });
}
```

---

## 5. 前端验证面板 [新增]

### 5.1 验证面板组件

```tsx
// components/Verify/VerificationPanel.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { keccak256, toUtf8Bytes } from 'ethers';

interface VerificationPanelProps {
  gameId: string;
  ipfsCid: string;
  onChainHash: string;
  explorerUrl: string;
}

export function VerificationPanel({ 
  gameId, 
  ipfsCid, 
  onChainHash,
  explorerUrl 
}: VerificationPanelProps) {
  const [step, setStep] = useState<'idle' | 'fetching' | 'computing' | 'comparing' | 'done'>('idle');
  const [rawData, setRawData] = useState<string>('');
  const [computedHash, setComputedHash] = useState<string>('');
  const [isMatch, setIsMatch] = useState<boolean | null>(null);
  
  const runVerification = async () => {
    // Step 1: 从IPFS获取数据
    setStep('fetching');
    const response = await fetch(`https://w3s.link/ipfs/${ipfsCid}`);
    const data = await response.text();
    setRawData(data);
    
    // Step 2: 本地计算哈希
    await new Promise(r => setTimeout(r, 500)); // 戏剧性延迟
    setStep('computing');
    const hash = keccak256(toUtf8Bytes(data));
    setComputedHash(hash);
    
    // Step 3: 比对
    await new Promise(r => setTimeout(r, 500));
    setStep('comparing');
    const matched = hash.toLowerCase() === onChainHash.toLowerCase();
    setIsMatch(matched);
    
    // Step 4: 完成
    await new Promise(r => setTimeout(r, 300));
    setStep('done');
  };
  
  return (
    <div className="bg-gray-900 rounded-xl p-6 max-w-2xl">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        🔗 链上验证
      </h3>
      
      {step === 'idle' && (
        <button
          onClick={runVerification}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 
                     rounded-lg font-bold text-white text-lg
                     hover:from-blue-500 hover:to-purple-500 transition"
        >
          🔍 验证游戏数据完整性
        </button>
      )}
      
      <AnimatePresence mode="wait">
        {step !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Step 1: 获取IPFS数据 */}
            <StepIndicator 
              status={step === 'fetching' ? 'loading' : 'done'}
              label="从 IPFS 获取原始数据"
            />
            
            {/* Step 2: 计算哈希 */}
            <StepIndicator 
              status={
                step === 'fetching' ? 'pending' :
                step === 'computing' ? 'loading' : 'done'
              }
              label="本地计算 keccak256 哈希"
            />
            
            {/* Step 3: 比对 */}
            <StepIndicator 
              status={
                ['fetching', 'computing'].includes(step) ? 'pending' :
                step === 'comparing' ? 'loading' : 'done'
              }
              label="与链上哈希比对"
            />
            
            {/* 结果展示 */}
            {step === 'done' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`p-4 rounded-lg ${
                  isMatch ? 'bg-green-900/50 border border-green-500' : 'bg-red-900/50 border border-red-500'
                }`}
              >
                <div className="text-center mb-4">
                  <span className="text-5xl">{isMatch ? '✅' : '❌'}</span>
                  <h4 className={`text-xl font-bold mt-2 ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
                    {isMatch ? '验证通过！数据完整' : '验证失败！数据可能被篡改'}
                  </h4>
                </div>
                
                <div className="space-y-2 text-sm font-mono">
                  <div>
                    <span className="text-gray-400">链上哈希: </span>
                    <span className="text-blue-400 break-all">{onChainHash}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">计算哈希: </span>
                    <span className={`break-all ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
                      {computedHash}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <a 
                    href={`https://w3s.link/ipfs/${ipfsCid}`}
                    target="_blank"
                    className="flex-1 py-2 bg-blue-600 rounded text-center text-white text-sm"
                  >
                    📦 查看IPFS数据
                  </a>
                  <a 
                    href={explorerUrl}
                    target="_blank"
                    className="flex-1 py-2 bg-purple-600 rounded text-center text-white text-sm"
                  >
                    📜 区块浏览器
                  </a>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepIndicator({ status, label }: { 
  status: 'pending' | 'loading' | 'done';
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {status === 'pending' && <span className="text-gray-500">○</span>}
      {status === 'loading' && (
        <motion.span 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="text-yellow-400"
        >
          ◐
        </motion.span>
      )}
      {status === 'done' && <span className="text-green-400">✓</span>}
      <span className={status === 'pending' ? 'text-gray-500' : 'text-white'}>
        {label}
      </span>
    </div>
  );
}
```

### 5.2 游戏结束弹窗（含验证入口）

```tsx
// components/GameEndModal.tsx
export function GameEndModal({ 
  winner, 
  pot, 
  verificationData 
}: GameEndModalProps) {
  const [showVerify, setShowVerify] = useState(false);
  
  return (
    <motion.div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-lg text-center">
        {/* 获胜者展示 */}
        <div className="text-6xl mb-4">{winner.avatar}</div>
        <h2 className="text-3xl font-bold text-yellow-400 mb-2">
          {winner.name} 获胜！
        </h2>
        <p className="text-2xl text-white mb-6">赢得 ${pot}</p>
        
        {/* 链上存证徽章 */}
        <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-center gap-2 text-green-400">
            <span>🔗</span>
            <span>已存证到 Monad 链上</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Tx: {verificationData.txHash.slice(0, 10)}...
          </p>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowVerify(true)}
            className="flex-1 py-3 bg-blue-600 rounded-lg font-bold text-white"
          >
            🔍 验证数据
          </button>
          <button className="flex-1 py-3 bg-gray-700 rounded-lg font-bold text-white">
            🎲 下一局
          </button>
        </div>
      </div>
      
      {/* 验证面板弹出 */}
      {showVerify && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <VerificationPanel {...verificationData} />
        </div>
      )}
    </motion.div>
  );
}
```

---

## 6. 开发计划

| 任务 | 时间 | 优先级 |
|------|------|--------|
| 智能合约编写 | 1h | P0 |
| 合约测试 + 部署 | 1h | P0 |
| HashService + 链交互 | 2h | P0 |
| **前端验证面板** | **2h** | **P0** |

**总计**: 6h

---

## 7. 部署清单

### 7.1 合约部署

```bash
# hardhat.config.ts
networks: {
  monad_testnet: {
    url: "https://testnet-rpc.monad.xyz",
    chainId: 10143,
    accounts: [process.env.PRIVATE_KEY]
  }
}

# 部署
npx hardhat run scripts/deploy.ts --network monad_testnet
```

### 7.2 环境变量

```bash
# .env
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
GAME_VERIFIER_ADDRESS=0x...  # 部署后填入
PRIVATE_KEY=0x...
WEB3_STORAGE_TOKEN=...
```

---

## 8. 演示话术

> "让我展示一下可验证性是如何工作的。
> 
> 这是刚才那局游戏的完整记录——每个AI的决策、说的话、时间戳。
> 
> 游戏结束时，我们计算了这份数据的keccak256哈希值，并将它写入了Monad链上。同时，原始数据被上传到了IPFS。
> 
> 现在，任何人都可以：
> 1. 从IPFS下载原始数据
> 2. 在本地计算哈希
> 3. 与链上存储的哈希比对
> 
> 如果匹配——说明数据没有被篡改。
> 
> **[点击验证按钮，展示验证过程]**
> 
> 你看，绿色勾✅，验证通过。这就是我们所说的'可验证的AI决策'。"
