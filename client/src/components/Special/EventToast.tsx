import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

const CATEGORY_COLORS: Record<string, string> = {
  rent: '#E53935',
  buy: '#4CAF50',
  sell: '#FF9800',
  dividend: '#2196F3',
  bankrupt: '#424242',
  victory: '#FFD700',
  jail: '#9E9E9E',
  card: '#8E24AA',
  info: '#607D8B',
};

export default function EventToast() {
  const logs = useGameStore(s => s.logs);
  const [currentLog, setCurrentLog] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);

  // Track last log ID to detect new entries
  const [lastLogId, setLastLogId] = useState(-1);

  useEffect(() => {
    if (logs.length === 0) return;
    const latest = logs[logs.length - 1];
    if (latest.id > lastLogId && lastLogId >= 0) {
      setQueue(q => [...q, latest]);
    }
    setLastLogId(latest.id);
  }, [logs.length]);

  useEffect(() => {
    if (queue.length > 0 && !visible) {
      const next = queue[0];
      setCurrentLog(next);
      setQueue(q => q.slice(1));
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
        setCurrentLog(null);
      }, 2800);

      return () => clearTimeout(timer);
    }
  }, [queue, visible]);

  if (!visible || !currentLog) return null;

  const bgColor = CATEGORY_COLORS[currentLog.type] || CATEGORY_COLORS.info;

  return (
    <div className={`event-toast ${visible ? 'slide-in' : ''}`} style={{ borderLeftColor: bgColor }}>
      <div className="event-toast-icon">
        {currentLog.type === 'rent' && '💰'}
        {currentLog.type === 'buy' && '✅'}
        {currentLog.type === 'sell' && '💸'}
        {currentLog.type === 'dividend' && '📈'}
        {currentLog.type === 'bankrupt' && '💀'}
        {currentLog.type === 'victory' && '🏆'}
        {currentLog.type === 'jail' && '🔒'}
        {currentLog.type === 'card' && '🃏'}
        {currentLog.type === 'info' && '📢'}
      </div>
      <div className="event-toast-text">{currentLog.message}</div>
    </div>
  );
}
