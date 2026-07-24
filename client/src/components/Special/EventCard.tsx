import { useEffect, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useI18n } from '../../i18n/useI18n';
import type { GameEvent } from '@monopoly/shared';

const EVENT_CONFIG: Record<GameEvent['kind'], { icon: string; color: string }> = {
  rent:        { icon: '💸', color: '#E53935' },
  tax:         { icon: '🏛️', color: '#FF5722' },
  go_salary:   { icon: '💰', color: '#4CAF50' },
  jail_in:     { icon: '🔒', color: '#9E9E9E' },
  jail_out:    { icon: '🔓', color: '#FFD700' },
  dividend:    { icon: '📈', color: '#2196F3' },
  weather:     { icon: '🌤️', color: '#00BCD4' },
  maintenance: { icon: '🔧', color: '#FF9800' },
  game_over:   { icon: '🏆', color: '#FFD700' },
};

function getEventMessage(
  event: GameEvent,
  lang: string,
): { title: string; desc: string; amount?: { value: number; positive: boolean }; detail?: string } {
  const isZh = lang === 'zh';

  switch (event.kind) {
    case 'rent': {
      const tileName = isZh ? event.tileNameCN : event.tileName;
      return {
        title: isZh ? '支付租金' : 'Rent Paid',
        desc: isZh
          ? `支付 ${tileName} 的租金`
          : `Rent for ${tileName}`,
        amount: { value: event.amount, positive: false },
        detail: isZh ? `收款人：付给了另一位玩家` : `Paid to another player`,
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
  const { lang } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (showEventCard && gameEvent) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [showEventCard, gameEvent]);

  if (!showEventCard || !gameEvent || gameEvent.kind === 'game_over') return null;

  const config = EVENT_CONFIG[gameEvent.kind];
  const msg = getEventMessage(gameEvent, lang);

  return (
    <div
      className={`event-card-overlay ${visible ? 'visible' : ''}`}
      onClick={() => setGameEvent(null)}
    >
      <div
        className="event-card"
        style={{ '--event-color': config.color } as React.CSSProperties}
      >
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
