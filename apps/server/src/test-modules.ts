/**
 * PokerMind Arena - 模块集成测试
 * 
 * 测试 01-游戏引擎 和 02-AI智能体 模块
 */

// 加载环境变量
import 'dotenv/config';

import { 
  PokerGameEngine, 
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
    console.log('   ⚠️ 未配置 LLM API Key，跳过 LLM 测试');
    console.log('   请在 .env 中配置 ZHIPU_API_KEY, KIMI_API_KEY 或 OPENAI_API_KEY');
    return false;
  }
  
  const providers = llmService.listProviders();
  console.log(`   ✅ 可用 LLM Providers: ${providers.join(', ')}`);
  
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
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结');
    console.log('='.repeat(60));
    console.log(`   01-游戏引擎: ${engineOk ? '✅ 通过' : '❌ 失败'}`);
    console.log(`   02-AI智能体: ${agentsOk ? '✅ 通过' : '⚠️ 部分通过'}`);
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ 测试出错:', error);
    process.exit(1);
  }
}

runAllTests();
