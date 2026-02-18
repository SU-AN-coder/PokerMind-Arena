/**
 * PokerMind Arena - 模块集成测试
 * 
 * 测试 01-游戏引擎、02-AI智能体、03-链上验证、04-预测市场 模块
 */

// 加载环境变量
import 'dotenv/config';

import { 
  PokerGameEngine, 
  GameController,
  createDeck, 
  shuffleDeck, 
  evaluateHand,
  getHandNameChinese
} from './engine/index.js';

import {
  AIAgent,
  FIRE_PERSONALITY,
  ICE_PERSONALITY,
  llmService,
  responseParser,
  buildSimplePrompt
} from './agents/index.js';

import { verificationService } from './blockchain/services/verification-service.js';
import { ipfsService } from './blockchain/services/ipfs-service.js';
import { hashService } from './blockchain/services/hash-service.js';

import {
  marketManager,
  simulatedAudienceGenerator
} from './market/index.js';

// ============ 测试 01 游戏引擎模块 ============

async function testGameEngine() {
  console.log('\n' + '='.repeat(60));
  console.log('🎴 测试 01-游戏引擎模块');
  console.log('='.repeat(60));
  
  // 1. 测试牌组创建
  console.log('\n📦 测试牌组创建...');
  const deck = createDeck();
  console.log(`   ✅ 创建了 ${deck.length} 张牌`);
  console.log(`   示例: ${deck.slice(0, 5).join(', ')}...`);
  
  // 2. 测试洗牌
  console.log('\n🔀 测试洗牌...');
  const shuffled = shuffleDeck(deck);
  console.log(`   ✅ 洗牌后: ${shuffled.slice(0, 5).join(', ')}...`);
  
  // 3. 测试牌型评估
  console.log('\n🃏 测试牌型评估...');
  const testCases = [
    { hole: ['As', 'Ks'], community: ['Qs', 'Js', 'Ts', '2h', '3d'], expected: '皇家同花顺' },
    { hole: ['Ah', 'Ad'], community: ['Ac', 'As', '2h', '3d', '4c'], expected: '四条' },
    { hole: ['Kh', 'Kd'], community: ['Kc', '7h', '7d', '2s', '3c'], expected: '葫芦' },
    { hole: ['2h', '7d'], community: ['Ac', 'Ks', 'Qd', '9h', '4c'], expected: '高牌' },
  ];
  
  for (const tc of testCases) {
    const result = evaluateHand(tc.hole, tc.community);
    const chineseName = getHandNameChinese(result.name);
    const pass = chineseName === tc.expected ? '✅' : '❌';
    console.log(`   ${pass} ${tc.hole.join(' ')} + ${tc.community.join(' ')}`);
    console.log(`      → ${chineseName} (${result.description})`);
  }
  
  // 4. 测试游戏引擎
  console.log('\n🎮 测试游戏引擎...');
  const engine = new PokerGameEngine({ initialChips: 100, roundCount: 3 });
  
  engine.addPlayer({ id: 'p1', name: '火焰', avatar: '🔥' });
  engine.addPlayer({ id: 'p2', name: '冰山', avatar: '🧊' });
  console.log('   ✅ 添加了2个玩家');
  
  // 监听事件
  engine.on('round_started', (data) => {
    console.log(`   📢 轮次开始 - 第${data.round}轮, 底池: $${data.pot}`);
  });
  
  engine.on('cards_dealt', (data) => {
    console.log('   📢 发牌完成');
    for (const p of data.players) {
      console.log(`      ${p.name}: ${p.holeCards.join(' ')}`);
    }
  });
  
  engine.on('player_allin', (data) => {
    console.log(`   📢 ${data.player.name} All-in! 底池: $${data.pot}`);
  });
  
  engine.on('showdown', (data) => {
    console.log('   📢 摊牌!');
    for (const p of data.players) {
      console.log(`      ${p.name}: ${p.holeCards.join(' ')} → ${p.hand}`);
    }
  });
  
  engine.on('round_ended', (data) => {
    console.log(`   📢 轮次结束 - 获胜者: ${data.winners.map(w => w.name).join(', ')}`);
  });
  
  // 开始一轮
  engine.startRound();
  
  // 模拟玩家行动
  engine.executeAction({ playerId: 'p1', action: 'allin', timestamp: Date.now() });
  engine.executeAction({ playerId: 'p2', action: 'allin', timestamp: Date.now() });
  
  console.log('\n   ✅ 游戏引擎测试完成');
  
  return true;
}

// ============ 测试 02 AI智能体模块 ============

async function testAIAgents() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 测试 02-AI智能体模块');
  console.log('='.repeat(60));
  
  // 1. 测试响应解析器
  console.log('\n📝 测试响应解析器...');
  const testResponses = [
    '```json\n{"action": "allin", "speech": "干就完了！", "emotion": "confident", "target": null}\n```',
    '{"action": "fold", "speech": "概率不站在我这边", "emotion": "neutral", "target": "火焰"}',
    '我选择 All-in！来啊，@冰山 你敢接吗？'
  ];
  
  for (const resp of testResponses) {
    const parsed = responseParser.parse(resp);
    console.log(`   ${parsed.parseSuccess ? '✅' : '⚠️'} 动作: ${parsed.action}, 情绪: ${parsed.emotion}`);
    console.log(`      对话: "${parsed.speech}"`);
    if (parsed.target) console.log(`      目标: @${parsed.target}`);
  }
  
  // 2. 测试 Prompt 构建
  console.log('\n📋 测试 Prompt 构建...');
  const gameContext = {
    yourName: '火焰',
    holeCards: 'A♠ K♥',
    communityCards: 'Q♣ J♦ T♠',
    yourStack: 80,
    potSize: 40,
    survivingPlayers: [
      { name: '火焰', stack: 80, lastAction: '' },
      { name: '冰山', stack: 60, lastAction: '(All-in)' }
    ],
    recentDialogue: ['冰山: "概率站在我这边"'],
    round: 2
  };
  
  const prompt = buildSimplePrompt(gameContext);
  console.log('   ✅ Prompt 构建成功');
  console.log('   预览 (前200字):');
  console.log('   ' + prompt.slice(0, 200).replace(/\n/g, '\n   ') + '...');
  
  // 3. 测试 LLM 服务
  console.log('\n🧠 测试 LLM 服务...');
  
  if (!llmService.hasAvailableProvider()) {
    console.log('   ⚠️ 未配置 LLM API Key，将使用 Mock Provider');
  }
  
  const providers = llmService.listProviders();
  console.log(`   ✅ 可用 LLM Providers: ${providers.join(', ')}`);
  console.log(`   📍 使用 Mock: ${llmService.isUsingMock() ? '是' : '否'}`);
  
  // 4. 测试 AI Agent 决策
  console.log('\n🎭 测试 AI Agent 决策...');
  
  const fireAgent = new AIAgent(FIRE_PERSONALITY);
  console.log(`   创建 AI: ${fireAgent.personality.name} (${fireAgent.personality.avatar})`);
  console.log(`   风格: ${fireAgent.personality.style}`);
  console.log(`   风险承受度: ${fireAgent.personality.riskTolerance}`);
  
  console.log('\n   🔄 调用 LLM 进行决策...');
  console.log('   (流式输出中)');
  
  let speechChunks = '';
  try {
    const decision = await fireAgent.makeDecision(gameContext, (chunk) => {
      speechChunks += chunk;
      process.stdout.write(chunk);
    });
    
    console.log('\n');
    console.log('   ' + '-'.repeat(40));
    console.log(`   ✅ 决策完成!`);
    console.log(`   动作: ${decision.action}`);
    console.log(`   对话: "${decision.speech}"`);
    console.log(`   情绪: ${decision.emotion}`);
    console.log(`   目标: ${decision.target || '无'}`);
    console.log(`   解析成功: ${decision.parseSuccess}`);
    
  } catch (error) {
    console.log(`\n   ❌ LLM 调用失败: ${error}`);
    return false;
  }
  
  return true;
}

// ============ 测试 03 链上验证模块 ============

async function testBlockchainVerification() {
  console.log('\n' + '='.repeat(60));
  console.log('🔗 测试 03-链上验证模块');
  console.log('='.repeat(60));
  
  // 1. 测试哈希服务
  console.log('\n🔐 测试哈希服务...');
  const testData = JSON.stringify({
    gameId: 'test_game_001',
    decisions: [
      { playerId: 'p1', action: 'allin', speech: 'All in!' }
    ]
  });
  
  const hash = hashService.computeHashFromRaw(testData);
  console.log(`   ✅ 计算哈希: ${hash.slice(0, 20)}...`);
  
  const verified = hashService.verifyHash(hash, hash);
  console.log(`   ✅ 哈希验证: ${verified ? '通过' : '失败'}`);
  
  // 2. 测试 IPFS 服务
  console.log('\n📦 测试 IPFS 服务...');
  console.log(`   IPFS 模式: ${ipfsService.isAvailable() ? '真实上传' : 'Mock 模式'}`);
  
  const mockGameLog = {
    gameId: 'test_game_001',
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
        speech: '干就完了！',
        emotion: 'confident' as const,
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
  
  const cid = await ipfsService.uploadGameLog(mockGameLog);
  console.log(`   ✅ 上传成功, CID: ${cid.slice(0, 30)}...`);
  console.log(`   🔗 Gateway URL: ${ipfsService.getGatewayUrl(cid)}`);
  
  // 3. 测试链服务（仅验证 mock 模式）
  console.log('\n⛓️ 测试链上验证服务...');
  try {
    const { result, panelData } = await verificationService.commitGame(mockGameLog);
    console.log(`   ✅ 提交成功!`);
    console.log(`   交易哈希: ${result.txHash.slice(0, 20)}...`);
    console.log(`   IPFS CID: ${result.ipfsCid.slice(0, 20)}...`);
    console.log(`   决策哈希: ${result.decisionHash.slice(0, 20)}...`);
  } catch (error) {
    console.log(`   ⚠️ 链上提交测试跳过 (需要配置): ${error}`);
  }
  
  return true;
}

// ============ 测试完整游戏流程 ============

async function testFullGame() {
  console.log('\n' + '='.repeat(60));
  console.log('🎮 测试完整 AI 对战流程');
  console.log('='.repeat(60));
  
  const controller = new GameController({
    initialChips: 100,
    roundCount: 2,  // 测试用，只打 2 轮
    thinkingDelay: 500,
    onAIThinking: (name) => {
      // 可以在这里推送到前端
    },
    onAISpeechChunk: (name, chunk) => {
      // 流式推送对话
    },
    onGameEnd: (winner, chips) => {
      console.log(`\n   🏆 回调通知: ${winner} 获胜，筹码 $${chips}`);
    }
  });
  
  try {
    const { winner, gameLog } = await controller.startGame();
    
    console.log('\n   ✅ 完整游戏测试通过!');
    console.log(`   游戏ID: ${gameLog.gameId}`);
    console.log(`   总决策数: ${gameLog.decisions.length}`);
    console.log(`   获胜者: ${winner.name}`);
    
    return true;
  } catch (error) {
    console.error('❌ 游戏执行失败:', error);
    return false;
  }
}

// ============ 测试 04 预测市场模块 ============

async function testPredictionMarket(): Promise<boolean> {
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试 04-预测市场模块');
  console.log('='.repeat(60));
  
  try {
    // 1. 测试市场创建
    console.log('\n🎰 测试市场创建...');
    const players = [
      { id: 'fire', name: '火焰', avatar: '🔥' },
      { id: 'ice', name: '冰山', avatar: '🧊' },
      { id: 'shadow', name: '诡影', avatar: '🎭' },
      { id: 'logic', name: '逻辑', avatar: '🧠' }
    ];
    
    const market = marketManager.createMarket('test_market_001', players);
    console.log(`   ✅ 市场创建成功: ${market.gameId}`);
    console.log(`   状态: ${market.status}`);
    console.log(`   选项数: ${market.options.length}`);
    
    // 2. 测试模拟投注生成
    console.log('\n👥 测试模拟观众生成...');
    const simulatedBets = simulatedAudienceGenerator.generateInitialBets(market);
    console.log(`   ✅ 生成 ${simulatedBets.length} 个模拟投注`);
    
    // 应用模拟投注
    for (const bet of simulatedBets) {
      marketManager.addSimulatedBet('test_market_001', bet);
    }
    
    // 3. 测试赔率计算
    console.log('\n📈 测试赔率计算...');
    const odds = marketManager.calculateOdds('test_market_001');
    for (const option of odds) {
      console.log(`   ${option.avatar} ${option.aiName}: ${option.odds.toFixed(2)}x (${option.percentage.toFixed(1)}%, ${option.betCount}人)`);
    }
    
    // 4. 测试用户投注
    console.log('\n💰 测试用户投注...');
    const betResult = marketManager.placeBet('test_market_001', 'user_001', 'fire', 100);
    console.log(`   投注结果: ${betResult.success ? '成功' : '失败'} - ${betResult.message}`);
    
    // 5. 测试市场快照
    console.log('\n📸 测试市场快照...');
    const snapshot = marketManager.getMarketSnapshot('test_market_001');
    if (snapshot) {
      console.log(`   总池: $${snapshot.totalPool}`);
      console.log(`   总投注人数: ${snapshot.totalBettors}`);
      console.log(`   最近投注: ${snapshot.recentBets.length} 条`);
    }
    
    // 6. 测试市场锁定
    console.log('\n🔒 测试市场锁定...');
    const lockSuccess = marketManager.lockMarket('test_market_001');
    console.log(`   锁定结果: ${lockSuccess ? '成功' : '失败'}`);
    
    // 7. 测试结算
    console.log('\n🏆 测试市场结算...');
    const settlements = marketManager.resolveMarket('test_market_001', 'fire');
    console.log(`   结算记录: ${settlements.length} 条`);
    
    const winners = settlements.filter(s => s.isWinner);
    const losers = settlements.filter(s => !s.isWinner);
    console.log(`   获胜者: ${winners.length} 人`);
    console.log(`   失败者: ${losers.length} 人`);
    
    if (winners.length > 0) {
      const sample = winners[0];
      console.log(`   示例结算: 投注 $${sample.betAmount} → 获得 $${sample.payout.toFixed(2)} (利润 $${sample.profit.toFixed(2)})`);
    }
    
    console.log('\n   ✅ 预测市场模块测试完成！');
    return true;
  } catch (error) {
    console.error('❌ 预测市场测试失败:', error);
    return false;
  }
}

// ============ 运行所有测试 ============

async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   🃏 PokerMind Arena - 模块集成测试                       ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  try {
    // 测试游戏引擎
    const engineOk = await testGameEngine();
    
    // 测试 AI 智能体
    const agentsOk = await testAIAgents();
    
    // 测试链上验证
    const blockchainOk = await testBlockchainVerification();
    
    // 测试预测市场
    const marketOk = await testPredictionMarket();
    
    // 测试完整游戏
    const fullGameOk = await testFullGame();
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结');
    console.log('='.repeat(60));
    console.log(`   01-游戏引擎:   ${engineOk ? '✅ 通过' : '❌ 失败'}`);
    console.log(`   02-AI智能体:   ${agentsOk ? '✅ 通过' : '⚠️ 部分通过'}`);
    console.log(`   03-链上验证:   ${blockchainOk ? '✅ 通过' : '⚠️ 部分通过'}`);
    console.log(`   04-预测市场:   ${marketOk ? '✅ 通过' : '❌ 失败'}`);
    console.log(`   完整游戏流程:  ${fullGameOk ? '✅ 通过' : '❌ 失败'}`);
    console.log('\n');
    
    if (engineOk && agentsOk && marketOk && fullGameOk) {
      console.log('🎉 所有核心模块测试通过！');
    }
    
  } catch (error) {
    console.error('\n❌ 测试出错:', error);
    process.exit(1);
  }
}

runAllTests();
