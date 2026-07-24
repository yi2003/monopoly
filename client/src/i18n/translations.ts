// ============================================================
// i18n — All UI strings in Chinese + English
// ============================================================

export type Lang = 'zh' | 'en';
export type TranslationKey = keyof typeof translations.zh;

export const translations = {
  zh: {
    // App
    'app.title': '🏠 家庭大富翁',
    'app.subtitle': '3D Multiplayer Monopoly',
    'app.connecting': '正在连接服务器...',
    'app.connectionLost': '⚠ 连接已断开，正在重连...',

    // Lobby - Menu
    'lobby.createRoom': '🎮 创建房间',
    'lobby.joinRoom': '🚪 加入房间',

    // Lobby - Create
    'lobby.createTitle': '创建房间',
    'lobby.yourName': '你的名字',
    'lobby.namePlaceholder': '输入名字（最多12字）',
    'lobby.nameRequired': '请输入你的名字',
    'lobby.nameTooLong': '名字最多12个字符',
    'lobby.color': '颜色',
    'lobby.theme': '主题',
    'lobby.difficulty': '难度',
    'lobby.create': '创建',
    'lobby.back': '返回',

    // Lobby - Join
    'lobby.joinTitle': '加入房间',
    'lobby.roomCode': '房间号',
    'lobby.roomCodePlaceholder': '输入4位房间号（如 A3F7）',
    'lobby.roomCodeInvalid': '请输入4位房间号',
    'lobby.join': '加入',

    // Lobby - Room
    'lobby.roomTitle': '房间号',
    'lobby.players': '玩家',
    'lobby.host': '房主',
    'lobby.spectator': '旁观',
    'lobby.addBot': '🤖 添加Bot',
    'lobby.leaveRoom': '离开房间',
    'lobby.startGame': '🎲 开始游戏',
    'lobby.waitingPlayers': '等待更多玩家 (至少2人)',
    'lobby.shareRoom': '分享房间号给朋友：',
    'lobby.copyRoomCode': '📋 复制房间号',

    // HUD - Top bar
    'hud.round': '第 {round} 回合',
    'hud.turn': '{name} 的回合',

    // HUD - Phase labels
    'phase.rolling': '掷骰阶段',
    'phase.buying': '购买决策',
    'phase.stock': '股票交易',
    'phase.wheel': '大转盘',
    'phase.quiz': '知识问答',
    'phase.debt': '债务处理',
    'phase.awaitEnd': '回合结束',
    'phase.ended': '游戏结束',
    'phase.moving': '🚶 移动中...',

    // HUD - Camera
    'camera.orbit': '俯瞰',
    'camera.thirdPerson': '第三人称',
    'camera.roam': '漫游',

    // HUD - Quality
    'quality.balanced': '⚡均衡',
    'quality.performance': '🚀性能',

    // HUD - Buttons
    'hud.stockMarket': '📈 股市',
    'hud.portfolio': '💼 资产',
    'hud.rollDice': '🎲 掷骰子',
    'hud.buy': '✅ 购买',
    'hud.pass': '❌ 放弃',
    'hud.spinWheel': '🎡 转动转盘',
    'hud.stockTrade': '📈 股票交易',
    'hud.endTurn': '⏭ 结束回合',
    'hud.buildSell': '🏗️ 建造/出售',
    'hud.sellHouse': '🏚️ 卖房筹资',
    'hud.declareBankrupt': '💀 宣布破产',
    'hud.backToLobby': '🔄 返回大厅',

    // HUD - Player cards
    'hud.player.props': '{props}块地',
    'hud.player.houses': '{houses}栋',

    // Buy Modal
    'buy.title': '🏘️ 购买地产',
    'buy.property': '地产',
    'buy.railway': '铁路',
    'buy.utility': '公共事业',
    'buy.price': '价格',
    'buy.rentTable': '租金表',
    'buy.rent.vacant': '空地',
    'buy.rent.hotel': '酒店',
    'buy.rent.houses': '{n}栋',
    'buy.rent.railway.1': '1条',
    'buy.rent.railway.2': '2条',
    'buy.rent.railway.3': '3条',
    'buy.rent.railway.4': '4条',
    'buy.rent.util.1': '1个: 骰点×4',
    'buy.rent.util.2': '2个: 骰点×10',
    'buy.houseCost': '建房成本',
    'buy.yourCash': '你的现金',
    'buy.confirm': '✅ 购买',
    'buy.passBtn': '❌ 放弃',

    // Build Modal
    'build.title': '🏗️ 地产管理',
    'build.noProperties': '你还没有任何地产',
    'build.tab.build': '建造',
    'build.tab.sell': '出售',
    'build.needFullGroup': '需要拥有整组颜色',
    'build.atLimit': '已达上限',
    'build.buildCost': '建房',
    'build.sellValue': '出售',
    'build.cash': '现金',
    'build.close': '关闭',

    // Stock Modal
    'stock.title': '📈 股票市场',
    'stock.cash': '现金',
    'stock.holdings': '持仓',
    'stock.noHoldings': '无',
    'stock.symbol': '股票',
    'stock.price': '价格',
    'stock.change': '涨跌',
    'stock.action': '操作',
    'stock.trade': '交易',
    'stock.shares': '股',
    'stock.buy': '买入',
    'stock.sell': '卖出',
    'stock.cancel': '取消',
    'stock.tradeTitle': '交易',
    'stock.avgCost': '均价',
    'stock.fee': '手续费: 3% (最低$5)',
    'stock.holding': '持仓',
    'stock.holdingFormat': '{shares}股',

    // Portfolio Modal
    'portfolio.title': '{name} 的资产组合',
    'portfolio.netWorth': '净资产',
    'portfolio.cash': '现金',
    'portfolio.properties': '🏘️ 地产',
    'portfolio.noProperties': '暂无地产',
    'portfolio.stocks': '📈 股票持仓',
    'portfolio.noStocks': '暂无持仓',
    'portfolio.stats': '📊 统计',
    'portfolio.totalRentCollected': '总收租',
    'portfolio.totalRentPaid': '总付租',
    'portfolio.totalStockProfit': '股票盈亏',
    'portfolio.totalDividends': '累计分红',
    'portfolio.avgPrice': '均价',
    'portfolio.currentPrice': '现价',

    // Bankruptcy Modal
    'bankrupt.title': '⚠️ 现金不足！',
    'bankrupt.desc': '{name}，你的现金不足支付债务。',
    'bankrupt.currentCash': '当前现金',
    'bankrupt.hint': '你可以尝试出售房屋或股票来筹集资金。',
    'bankrupt.declare': '💀 宣布破产',
    'bankrupt.tip': '提示: 使用右侧建造面板出售房屋',

    // Quiz Modal
    'quiz.title': '🧠 知识问答',
    'quiz.correct': '回答正确！',
    'quiz.wrong': '回答错误！',
    'quiz.rewardGiven': '奖励已发放',
    'quiz.penaltyTaken': '罚金已扣除',
    'quiz.waiting': '⏳ 等待结果...',
    'quiz.hint': '✅ 正确: 获得奖励 (租金倍率) | ❌ 错误: 支付罚金 (税费倍率)',

    // Card Flip
    'card.chance': '机会',
    'card.community': '公益金',

    // Event Toast types
    'event.rent': '💰',
    'event.buy': '✅',
    'event.sell': '💸',
    'event.dividend': '📈',
    'event.bankrupt': '💀',
    'event.victory': '🏆',
    'event.jail': '🔒',
    'event.card': '🃏',
    'event.info': '📢',

    // Weather
    'weather.clear': '☀️',
    'weather.rain': '🌧️',
    'weather.snow': '❄️',
    'weather.fog': '🌫️',
    'weather.storm': '⛈️',

    // Language toggle
    'lang.switch': '中文',
    'lang.label': '🌐 语言',

    // Bot names
    'bot.names': '小明,小红,小刚,小丽,阿福,财神',
  },

  en: {
    'app.title': '🏠 Family Monopoly',
    'app.subtitle': '3D Multiplayer Monopoly',
    'app.connecting': 'Connecting to server...',
    'app.connectionLost': '⚠ Connection lost, reconnecting...',

    'lobby.createRoom': '🎮 Create Room',
    'lobby.joinRoom': '🚪 Join Room',

    'lobby.createTitle': 'Create Room',
    'lobby.yourName': 'Your Name',
    'lobby.namePlaceholder': 'Enter name (max 12 chars)',
    'lobby.nameRequired': 'Please enter your name',
    'lobby.nameTooLong': 'Name must be 12 characters or less',
    'lobby.color': 'Color',
    'lobby.theme': 'Theme',
    'lobby.difficulty': 'Difficulty',
    'lobby.create': 'Create',
    'lobby.back': 'Back',

    'lobby.joinTitle': 'Join Room',
    'lobby.roomCode': 'Room Code',
    'lobby.roomCodePlaceholder': 'Enter 4-digit room code (e.g. A3F7)',
    'lobby.roomCodeInvalid': 'Please enter a 4-digit room code',
    'lobby.join': 'Join',

    'lobby.roomTitle': 'Room',
    'lobby.players': 'Players',
    'lobby.host': 'Host',
    'lobby.spectator': 'Spectator',
    'lobby.addBot': '🤖 Add Bot',
    'lobby.leaveRoom': 'Leave Room',
    'lobby.startGame': '🎲 Start Game',
    'lobby.waitingPlayers': 'Waiting for more players (min 2)',
    'lobby.shareRoom': 'Share room code with friends:',
    'lobby.copyRoomCode': '📋 Copy Room Code',

    'hud.round': 'Round {round}',
    'hud.turn': "{name}'s Turn",

    'phase.rolling': 'Roll Dice',
    'phase.buying': 'Buy Decision',
    'phase.stock': 'Stock Trading',
    'phase.wheel': 'Wheel of Fortune',
    'phase.quiz': 'Quiz',
    'phase.debt': 'Debt Settlement',
    'phase.awaitEnd': 'End Turn',
    'phase.ended': 'Game Over',
    'phase.moving': '🚶 Moving...',

    'camera.orbit': 'Overview',
    'camera.thirdPerson': '3rd Person',
    'camera.roam': 'Roam',

    'quality.balanced': '⚡Quality',
    'quality.performance': '🚀Perf',

    'hud.stockMarket': '📈 Stocks',
    'hud.portfolio': '💼 Assets',
    'hud.rollDice': '🎲 Roll Dice',
    'hud.buy': '✅ Buy',
    'hud.pass': '❌ Pass',
    'hud.spinWheel': '🎡 Spin Wheel',
    'hud.stockTrade': '📈 Trade',
    'hud.endTurn': '⏭ End Turn',
    'hud.buildSell': '🏗️ Build/Sell',
    'hud.sellHouse': '🏚️ Sell Assets',
    'hud.declareBankrupt': '💀 Bankruptcy',
    'hud.backToLobby': '🔄 Back to Lobby',

    'hud.player.props': '{props} lots',
    'hud.player.houses': '{houses} houses',

    'buy.title': '🏘️ Buy Property',
    'buy.property': 'Property',
    'buy.railway': 'Railway',
    'buy.utility': 'Utility',
    'buy.price': 'Price',
    'buy.rentTable': 'Rent Table',
    'buy.rent.vacant': 'Vacant',
    'buy.rent.hotel': 'Hotel',
    'buy.rent.houses': '{n} houses',
    'buy.rent.railway.1': '1 railway',
    'buy.rent.railway.2': '2 railways',
    'buy.rent.railway.3': '3 railways',
    'buy.rent.railway.4': '4 railways',
    'buy.rent.util.1': '1 utility: dice×4',
    'buy.rent.util.2': '2 utilities: dice×10',
    'buy.houseCost': 'House cost',
    'buy.yourCash': 'Your cash',
    'buy.confirm': '✅ Buy',
    'buy.passBtn': '❌ Pass',

    'build.title': '🏗️ Property Management',
    'build.noProperties': "You don't own any properties",
    'build.tab.build': 'Build',
    'build.tab.sell': 'Sell',
    'build.needFullGroup': 'Need full color group',
    'build.atLimit': 'At max limit',
    'build.buildCost': 'Build',
    'build.sellValue': 'Sell',
    'build.cash': 'Cash',
    'build.close': 'Close',

    'stock.title': '📈 Stock Market',
    'stock.cash': 'Cash',
    'stock.holdings': 'Holdings',
    'stock.noHoldings': 'None',
    'stock.symbol': 'Stock',
    'stock.price': 'Price',
    'stock.change': 'Change',
    'stock.action': 'Action',
    'stock.trade': 'Trade',
    'stock.shares': 'shares',
    'stock.buy': 'Buy',
    'stock.sell': 'Sell',
    'stock.cancel': 'Cancel',
    'stock.tradeTitle': 'Trade',
    'stock.avgCost': 'Avg cost',
    'stock.fee': 'Fee: 3% (min $5)',
    'stock.holding': 'Holding',
    'stock.holdingFormat': '{shares} shares',

    'portfolio.title': "{name}'s Portfolio",
    'portfolio.netWorth': 'Net Worth',
    'portfolio.cash': 'Cash',
    'portfolio.properties': '🏘️ Properties',
    'portfolio.noProperties': 'No properties',
    'portfolio.stocks': '📈 Stock Holdings',
    'portfolio.noStocks': 'No holdings',
    'portfolio.stats': '📊 Statistics',
    'portfolio.totalRentCollected': 'Rent Collected',
    'portfolio.totalRentPaid': 'Rent Paid',
    'portfolio.totalStockProfit': 'Stock P&L',
    'portfolio.totalDividends': 'Dividends',
    'portfolio.avgPrice': 'Avg',
    'portfolio.currentPrice': 'Now',

    'bankrupt.title': '⚠️ Insufficient Funds!',
    'bankrupt.desc': '{name}, you cannot cover your debts.',
    'bankrupt.currentCash': 'Current cash',
    'bankrupt.hint': 'Try selling houses or stocks to raise funds.',
    'bankrupt.declare': '💀 Declare Bankruptcy',
    'bankrupt.tip': 'Tip: Use the build panel to sell houses',

    'quiz.title': '🧠 Quiz',
    'quiz.correct': 'Correct!',
    'quiz.wrong': 'Wrong!',
    'quiz.rewardGiven': 'Reward granted',
    'quiz.penaltyTaken': 'Penalty deducted',
    'quiz.waiting': '⏳ Waiting for result...',
    'quiz.hint': '✅ Correct: earn reward | ❌ Wrong: pay penalty',

    'card.chance': 'Chance',
    'card.community': 'Community Chest',

    'event.rent': '💰',
    'event.buy': '✅',
    'event.sell': '💸',
    'event.dividend': '📈',
    'event.bankrupt': '💀',
    'event.victory': '🏆',
    'event.jail': '🔒',
    'event.card': '🃏',
    'event.info': '📢',

    'weather.clear': '☀️',
    'weather.rain': '🌧️',
    'weather.snow': '❄️',
    'weather.fog': '🌫️',
    'weather.storm': '⛈️',

    'lang.switch': 'English',
    'lang.label': '🌐 Language',

    'bot.names': 'Alice,Bob,Charlie,Diana,Eve,Frank',
  },
} as const;

/** Simple template interpolation: t('key', { name: 'Alice' }) */
export function formatT(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  let result = text;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
}
