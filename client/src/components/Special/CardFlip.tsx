import { useEffect, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useI18n } from '../../i18n/useI18n';

export default function CardFlip() {
  const lastCardDrawn = useUIStore(s => s.lastCardDrawn);
  const showCardModal = useUIStore(s => s.showCardModal);
  const setCardDrawn = useUIStore(s => s.setCardDrawn);
  const { t } = useI18n();

  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (showCardModal) {
      setFlipped(false);
      const timer = setTimeout(() => setFlipped(true), 450);
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
  const cardType = isChance ? t('card.chance') : t('card.community');

  return (
    <div className="card-flip-overlay" onClick={() => setCardDrawn(null)}>
      <div className={`card-flip ${flipped ? 'flipped' : ''}`}>
        <div className="card-inner">
          {/* Front (?) */}
          <div className={`card-front ${isChance ? 'chance' : 'community'}`}>
            <div className="card-symbol">?</div>
            <div className="card-type">{cardType}</div>
          </div>
          {/* Back (content) */}
          <div className={`card-back ${isChance ? 'chance' : 'community'}`}>
            <div className="card-type-label">{cardType}</div>
            <div className="card-text">{lastCardDrawn.descriptionCN}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
