import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

const CATEGORY_ICONS: Record<string, string> = {
  rent: '💰',
  buy: '✅',
  sell: '💸',
  dividend: '📈',
  bankrupt: '💀',
  victory: '🏆',
  jail: '🔒',
  card: '🃏',
  info: '📢',
};

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
  const [current, setCurrent] = useState<{ message: string; type: string } | null>(null);
  const shownIds = useRef<Set<number>>(new Set());
  const queueRef = useRef<{ message: string; type: string }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect new log entries by watching the logs array
  useEffect(() => {
    if (logs.length === 0) return;

    for (let i = logs.length - 1; i >= 0; i--) {
      const log = logs[i];
      if (!shownIds.current.has(log.id)) {
        shownIds.current.add(log.id);
        queueRef.current.push({ message: log.message, type: log.type });
      }
    }

    // Show next if nothing is currently displayed
    if (!current && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setCurrent(next);
    }
  }, [logs]);

  // Auto-dismiss and show next in queue
  useEffect(() => {
    if (!current) return;

    timerRef.current = setTimeout(() => {
      setCurrent(null);
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current]);

  // When current dismisses, check queue for more
  useEffect(() => {
    if (current) return; // still showing something
    if (queueRef.current.length === 0) return;

    // Small delay between toasts
    const t = setTimeout(() => {
      const next = queueRef.current.shift()!;
      setCurrent(next);
    }, 300);

    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const bgColor = CATEGORY_COLORS[current.type] || CATEGORY_COLORS.info;
  const icon = CATEGORY_ICONS[current.type] || '📢';

  return (
    <div className="event-toast" style={{ borderLeftColor: bgColor }}>
      <div className="event-toast-icon">{icon}</div>
      <div className="event-toast-text">{current.message}</div>
    </div>
  );
}
