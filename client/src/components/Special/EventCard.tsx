import { useEffect, useState, useMemo } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { useI18n } from '../../i18n/useI18n';
import type { GameEvent } from '@monopoly/shared';

const EVENT_CONFIG: Record<string, { icon: string; color: string }> = {
  rent:        { icon: '💸', color: '#E53935' },
  tax:         { icon: '🏛️', color: '#FF5722' },
  go_salary:   { icon: '💰', color: '#4CAF50' },
  jail_in:     { icon: '🔒', color: '#9E9E9E' },
  jail_out:    { icon: '🔓', color: '#FFD700' },
  dividend:    { icon: '📈', color: '#2196F3' },
  card:        { icon: '🃏', color: '#8E24AA' },
  cardUsed:    { icon: '🃏', color: '#8E24AA' },
  rob:         { icon: '🦹', color: '#E53935' },
  weather:     { icon: '🌤️', color: '#00BCD4' },
  maintenance: { icon: '🔧', color: '#FF9800' },
  game_over:   { icon: '🏆', color: '#FFD700' },
};

function getEventMessage(
  event: GameEvent,
  lang: string,
  getPlayerName?: (id: string) => string,
): { title: string; desc: string; amount?: { value: number; positive: boolean }; detail?: string } {
  const isZh = lang === 'zh';

  switch (event.kind) {
    case 'rent': {
      const tileName = isZh ? event.tileNameCN : event.tileName;
      const targetName = getPlayerName?.(event.targetId) || event.targetId;
      return {
        title: isZh ? '支付租金' : 'Rent Paid',
        desc: isZh
          ? `支付 ${tileName} 的租金`
          : `Rent for ${tileName}`,
        amount: { value: event.amount, positive: false },
        detail: isZh ? `💰 收款人：${targetName}` : `💰 Paid to ${targetName}`,
      };
    }
    case 'tax': {
      const label = event.isLuxury ? (isZh ? '奢侈品税' : 'Luxury Tax') : (isZh ? '所得税' : 'Income Tax');
      return {
        title: isZh ? '缴纳税费' : 'Tax Paid',
        desc: label,
        amount: { value: event.amount, positive: false },
        detail: isZh ? '支付给银行' : 'Paid to Bank',
      };
    }
    case 'go_salary':
      return {
        title: isZh ? '经过起点' : 'Passed GO',
        desc: isZh ? '银行发放工资' : 'Salary from bank',
        amount: { value: event.amount, positive: true },
      };
    case 'jail_in': {
      const reasonMap: Record<string, string> = {
        goto_jail: isZh ? '踩到"进入监狱"格' : 'Landed on Go To Jail',
        three_doubles: isZh ? '连续三次掷出对子' : 'Three doubles in a row',
        wheel: isZh ? '转盘结果' : 'Wheel result',
        card: isZh ? '机会/命运卡' : 'Chance/Community card',
      };
      return {
        title: isZh ? '进入监狱' : 'Sent to Jail',
        desc: reasonMap[event.reason] || event.reason,
      };
    }
    case 'jail_out': {
      const methodMap: Record<string, string> = {
        pay_fine: isZh ? '缴纳保释金' : 'Paid bail',
        use_card: isZh ? '使用出狱卡' : 'Used jail card',
        doubles: isZh ? '掷出对子越狱' : 'Rolled doubles',
        forced: isZh ? '关押期满释放' : 'Served full term',
      };
      return {
        title: isZh ? '离开监狱' : 'Released',
        desc: methodMap[event.method] || event.method,
      };
    }
    case 'dividend': {
      const stockName = isZh ? event.stockNameCN : event.stockName;
      return {
        title: isZh ? '股票分红' : 'Dividend',
        desc: isZh
          ? `${stockName}（${event.shares}股）`
          : `${stockName} (${event.shares} shares)`,
        amount: { value: event.amount, positive: true },
      };
    }
    case 'weather': {
      const weatherNames: Record<string, string> = {
        clear: isZh ? '☀️ 晴天' : '☀️ Clear',
        rain: isZh ? '🌧️ 雨天' : '🌧️ Rain',
        snow: isZh ? '❄️ 雪天' : '❄️ Snow',
        fog: isZh ? '🌫️ 雾天' : '🌫️ Fog',
        storm: isZh ? '⛈️ 暴风雨' : '⛈️ Storm',
      };
      return {
        title: isZh ? '天气变化' : 'Weather Change',
        desc: `${weatherNames[event.from] || event.from} → ${weatherNames[event.to] || event.to}`,
      };
    }
    case 'card': {
      const cardTypeLabel = event.cardType === 'chance'
        ? (isZh ? '🎴 机会卡' : '🎴 Chance Card')
        : (isZh ? '📦 公益卡' : '📦 Community Chest');
      const playerName = getPlayerName?.(event.playerId) || event.playerId;
      return {
        title: cardTypeLabel,
        desc: isZh ? event.descriptionCN : event.description,
        detail: isZh ? `🎯 ${playerName} 抽到此卡` : `🎯 Drawn by ${playerName}`,
      };
    }
    case 'cardUsed': {
      const playerName = getPlayerName?.(event.playerId) || event.playerId;
      return {
        title: isZh ? '🃏 使用行动卡' : '🃏 Action Card Used',
        desc: isZh ? event.descriptionCN : event.description,
        amount: event.amount !== undefined ? { value: event.amount, positive: true } : undefined,
        detail: isZh ? `🎯 ${playerName}` : `🎯 ${playerName}`,
      };
    }
    case 'rob': {
      const actorName = getPlayerName?.(event.actorId) || event.actorId;
      const targetName = getPlayerName?.(event.targetId) || event.targetId;
      return {
        title: isZh ? '🦹 偷钱' : '🦹 Robbed',
        desc: isZh ? `${actorName} 偷走了 ${targetName} 的钱` : `${actorName} robbed ${targetName}`,
        amount: { value: event.amount, positive: true },
      };
    }
    case 'maintenance':
      return {
        title: isZh ? '资产维护费' : 'Maintenance Fee',
        desc: isZh
          ? `银行收取 ${event.rate}% 维护费`
          : `Bank charges ${event.rate}% fee`,
        amount: { value: event.amount, positive: false },
        detail: isZh ? '支付给银行' : 'Paid to Bank',
      };
    default:
      return { title: '', desc: '' };
  }
}

export default function EventCard() {
  const gameEvent = useUIStore(s => s.gameEvent);
  const showEventCard = useUIStore(s => s.showEventCard);
  const setGameEvent = useUIStore(s => s.setGameEvent);
  const players = useGameStore(s => s.players);
  const { lang } = useI18n();
  const [visible, setVisible] = useState(false);

  const getPlayerName = useMemo(() => (id: string) => {
    const p = players.find(p => p.id === id);
    return p ? p.name : id;
  }, [players]);

  useEffect(() => {
    if (showEventCard && gameEvent) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [showEventCard, gameEvent]);

  if (!showEventCard || !gameEvent || gameEvent.kind === 'game_over') return null;

  const config = EVENT_CONFIG[gameEvent.kind] || { icon: '📋', color: '#607D8B' };
  const msg = getEventMessage(gameEvent, lang, getPlayerName);

  return (
    <div
      className={`event-card-overlay ${visible ? 'visible' : ''}`}
      onClick={() => setGameEvent(null)}
    >
      <div
        className="event-card"
        style={{ '--event-color': config.color } as React.CSSProperties}
      >
        <div className="event-card-glow" style={{ '--event-color': config.color } as React.CSSProperties} />
        <div className="event-card-color-bar" style={{ backgroundColor: config.color }} />
        <div className="event-card-icon">{config.icon}</div>
        <div className="event-card-title" style={{ color: config.color }}>
          {msg.title}
        </div>
        <div className="event-card-desc">{msg.desc}</div>
        {msg.amount !== undefined && (
          <div className={`event-card-amount ${msg.amount.positive ? 'positive' : 'negative'}`}>
            {msg.amount.positive ? '+' : '-'}${msg.amount.value.toLocaleString()}
          </div>
        )}
        {msg.detail && (
          <div className="event-card-detail">{msg.detail}</div>
        )}
      </div>
    </div>
  );
}
