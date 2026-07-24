import { useEffect, useState, useRef, useCallback } from 'react';
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

const TOAST_DURATION = 5000;
const MAX_VISIBLE = 4;

export default function EventToast() {
  const logs = useGameStore(s => s.logs);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);
  const lastLogId = useRef(-1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [logExpanded, setLogExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // Show new toasts as they arrive
  useEffect(() => {
    if (logs.length === 0) return;

    // Find logs we haven't toasted yet (by id)
    const newLogs = logs.filter(l => l.id > lastLogId.current);
    if (newLogs.length === 0) return;

    lastLogId.current = logs[logs.length - 1].id;

    for (const log of newLogs) {
      setToasts(prev => {
        const next = [...prev, { id: log.id, message: log.message, type: log.type }];
        // Keep only last MAX_VISIBLE
        if (next.length > MAX_VISIBLE) {
          const removed = next[next.length - MAX_VISIBLE - 1];
          if (removed && timers.current.has(removed.id)) {
            clearTimeout(timers.current.get(removed.id)!);
            timers.current.delete(removed.id);
          }
        }
        return next.slice(-MAX_VISIBLE);
      });

      // Auto-dismiss this toast after TOAST_DURATION
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== log.id));
        timers.current.delete(log.id);
      }, TOAST_DURATION);
      timers.current.set(log.id, timer);
    }
  }, [logs]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach(t => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  // Manage scroll position for log panel
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const el = listRef.current;
    userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 40;
  }, []);

  useEffect(() => {
    if (!logExpanded || !listRef.current || userScrolledUp.current) return;
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, [logs.length, logExpanded]);

  if (toasts.length === 0 && !logExpanded) return null;

  const allLogs = logs.slice(-50).reverse();

  return (
    <>
      {/* Toast stack */}
      <div className="event-toast-stack">
        {toasts.map(t => (
          <div
            key={t.id}
            className="event-toast"
            style={{ borderLeftColor: CATEGORY_COLORS[t.type] || CATEGORY_COLORS.info }}
          >
            <div className="event-toast-text">{t.message}</div>
          </div>
        ))}
      </div>

      {/* Log toggle */}
      <button
        className="event-log-toggle"
        onClick={() => {
          setLogExpanded(v => {
            if (!v) userScrolledUp.current = false;
            return !v;
          });
        }}
        title={logExpanded ? '收起日志' : '展开日志'}
        style={toasts.length > 0 ? { top: 80 + toasts.length * 50 + 10 } : { top: 80 }}
      >
        📋 {logs.length > 0 && <span className="event-log-badge">{logs.length}</span>}
      </button>

      {/* Log panel */}
      {logExpanded && (
        <div className="event-log-panel">
          <div className="event-log-header">
            <span>📋 事件日志（{logs.length}条）</span>
            <button onClick={() => setLogExpanded(false)}>✕</button>
          </div>
          <div className="event-log-list" ref={listRef} onScroll={handleScroll}>
            {allLogs.map(log => (
              <div
                key={log.id}
                className="event-log-entry"
                style={{ borderLeftColor: CATEGORY_COLORS[log.type] || CATEGORY_COLORS.info }}
              >
                <span className="event-log-round">R{log.round}</span>
                <span className="event-log-msg">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
