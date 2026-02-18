/**
 * PokerMind Arena - IPFS 服务测试
 */

import 'dotenv/config';
import { ipfsService } from './blockchain/services/ipfs-service.js';

async function testIPFS() {
  console.log('\n🧪 ===== IPFS 服务测试 =====\n');
  console.log(`📦 当前 Provider: ${ipfsService.getProviderName()}`);
  console.log(`🔧 Mock 模式: ${ipfsService.isMockMode()}`);
  console.log(`✅ 服务可用: ${ipfsService.isAvailable()}\n`);
  
  // 测试数据
  const testData = {
    gameId: 'test_' + Date.now(),
    startTime: Date.now() - 60000,
    endTime: Date.now(),
    players: [
      { id: 'p1', name: '火焰', avatar: '🔥' },
      { id: 'p2', name: '冰山', avatar: '🧊' }
    ],
    decisions: [
      {
        timestamp: Date.now(),
        playerId: 'p1',
        playerName: '火焰',
        action: 'allin' as const,
        speech: '梭了！干就完了！',
        emotion: 'confident',
        target: null,
        holeCards: 'A♠ K♥',
        communityCards: 'Q♣ J♦ T♠',
        potSize: 100
      }
    ],
    communityCards: ['Q♣', 'J♦', 'T♠', '2♥', '3♦'],
    winner: { id: 'p1', name: '火焰' },
    pot: 200
  };
  
  console.log('📤 上传测试数据到 IPFS...\n');
  
  try {
    const startTime = Date.now();
    const cid = await ipfsService.uploadGameLog(testData);
    const uploadTime = Date.now() - startTime;
    
    console.log(`\n✅ 上传成功！`);
    console.log(`   CID: ${cid}`);
    console.log(`   耗时: ${uploadTime}ms`);
    console.log(`   网关 URL: ${ipfsService.getGatewayUrl(cid)}`);
    
    // 如果不是 Mock 模式，尝试验证
    if (!ipfsService.isMockMode()) {
      console.log('\n📥 等待 IPFS 网络传播 (3秒)...');
      await new Promise(r => setTimeout(r, 3000));
      
      console.log('📥 从 IPFS 获取数据验证...');
      
      try {
        const fetched = await ipfsService.fetchGameLog(cid);
        console.log(`\n✅ 验证成功！`);
        console.log(`   游戏ID: ${fetched.gameId}`);
        console.log(`   玩家: ${fetched.players.map(p => p.name).join(', ')}`);
        console.log(`   获胜者: ${fetched.winner.name}`);
      } catch (fetchError) {
        console.log(`\n⚠️ 获取验证失败 (可能需要更长传播时间): ${fetchError}`);
        console.log(`   你可以稍后手动访问: ${ipfsService.getGatewayUrl(cid)}`);
      }
    }
    
    console.log('\n🎉 IPFS 测试完成！\n');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testIPFS();
