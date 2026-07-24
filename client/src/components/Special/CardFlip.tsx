import { useEffect, useState } from 'react';
import { useUIStore } from '../../store/uiStore';

export default function CardFlip() {
  const lastCardDrawn = useUIStore(s => s.lastCardDrawn);
  const showCardModal = useUIStore(s => s.showCardModal);
  const setCardDrawn = useUIStore(s => s.setCardDrawn);

  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (showCardModal) {
      setFlipped(false);
      // Delay flip for 450ms
      const timer = setTimeout(() => setFlipped(true), 450);
      // Auto close after 4.2s
      const closeTimer = setTimeout(() => {
        setCardDrawn(null);
      }, 4200);

      return () => {
        clearTimeout(timer);
        clearTimeout(closeTimer);
      };
    }
  }, [showCardModal]);

  if (!showCardModal || !lastCardDrawn) return null;

  const isChance = lastCardDrawn.type === 'chance';

  return (
    <div className="card-flip-overlay" onClick={() => setCardDrawn(null)}>
      <div className={`card-flip ${flipped ? 'flipped' : ''}`}>
        <div className="card-inner">
          {/* Front (?) */}
          <div className={`card-front ${isChance ? 'chance' : 'community'}`}>
            <div className="card-symbol">?</div>
            <div className="card-type">{isChance ? '机会' : '公益金'}</div>
          </div>
          {/* Back (content) */}
          <div className={`card-back ${isChance ? 'chance' : 'community'}`}>
            <div className="card-type-label">{isChance ? '机会' : '公益金'}</div>
            <div className="card-text">{lastCardDrawn.descriptionCN}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
