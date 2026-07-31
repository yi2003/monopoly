import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useI18n } from '../../i18n/useI18n';

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
  const { lang } = useI18n();
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
        const next = [...prev, { id: log.id, message: (lang === 'en' && log.messageEN) ? log.messageEN : log.message, type: log.type }];
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
        title={lang === 'zh' ? (logExpanded ? '收起日志' : '展开日志') : (logExpanded ? 'Collapse log' : 'Expand log')}
        style={toasts.length > 0 ? { top: 80 + toasts.length * 50 + 10 } : { top: 80 }}
      >
        📋 {logs.length > 0 && <span className="event-log-badge">{logs.length}</span>}
      </button>

      {/* Log panel */}
      {logExpanded && (
        <div className="event-log-panel">
          <div className="event-log-header">
            <span>{lang === 'zh' ? `📋 事件日志（${logs.length}条）` : `📋 Event Log (${logs.length})`}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const text = logs.map(l => `[R${l.round}] ${(lang === 'en' && l.messageEN) ? l.messageEN : l.message}`).join('\n');
                  navigator.clipboard.writeText(text).then(() => {
                    useUIStore.getState().addToast(lang === 'zh' ? '已复制日志' : 'Log copied', 'info');
                  }).catch(() => {});
                }}
                title={lang === 'zh' ? '复制全部日志' : 'Copy all logs'}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#999', cursor: 'pointer', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}
              >
                {lang === 'zh' ? '📋 复制' : '📋 Copy'}
              </button>
              <button
                onClick={() => useGameStore.getState().clearLogs()}
                title={lang === 'zh' ? '清空日志' : 'Clear logs'}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#999', cursor: 'pointer', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}
              >
                {lang === 'zh' ? '🗑️ 清空' : '🗑️ Clear'}
              </button>
              <button onClick={() => setLogExpanded(false)}>✕</button>
            </div>
          </div>
          <div className="event-log-list" ref={listRef} onScroll={handleScroll}>
            {allLogs.map(log => (
              <div
                key={log.id}
                className="event-log-entry"
                style={{ borderLeftColor: CATEGORY_COLORS[log.type] || CATEGORY_COLORS.info }}
              >
                <span className="event-log-round">R{log.round}</span>
                <span className="event-log-msg">{(lang === 'en' && log.messageEN) ? log.messageEN : log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
