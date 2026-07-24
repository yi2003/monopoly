import { useEffect, useState } from 'react';
import { useUIStore } from '../../store/uiStore';

const SECTORS = [
  { label: '+$200', color: '#4CAF50' },
  { label: '+$500', color: '#66BB6A' },
  { label: '+$1000', color: '#2E7D32' },
  { label: '-$100', color: '#EF5350' },
  { label: '-$300', color: '#E53935' },
  { label: '监狱', color: '#424242' },
  { label: 'GO', color: '#FFD700' },
  { label: '每人付你$50', color: '#2196F3' },
  { label: '你付每人$50', color: '#FF9800' },
  { label: '出狱卡', color: '#9C27B0' },
  { label: '免费建房', color: '#00BCD4' },
  { label: '科技股×2', color: '#3F51B5' },
  { label: '黄金股×1', color: '#FFC107' },
  { label: 'AI股×2', color: '#E91E63' },
];

export default function WheelSpinner() {
  const wheelResult = useUIStore(s => s.wheelResult);
  const showWheelModal = useUIStore(s => s.showWheelModal);
  const setWheelResult = useUIStore(s => s.setWheelResult);

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (showWheelModal && wheelResult !== null) {
      setSpinning(true);
      const sectorAngle = 360 / SECTORS.length;
      const targetAngle = 360 * 5 + wheelResult * sectorAngle + sectorAngle / 2;
      setRotation(targetAngle);

      const timer = setTimeout(() => {
        setSpinning(false);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [showWheelModal, wheelResult]);

  if (!showWheelModal) return null;

  return (
    <div className="wheel-overlay" onClick={() => setWheelResult(null)}>
      <div className="wheel-container">
        <div className="wheel-pointer">▼</div>
        <div
          className="wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            background: `conic-gradient(${SECTORS.map((s, i) => {
              const start = (i / SECTORS.length) * 360;
              const end = ((i + 1) / SECTORS.length) * 360;
              return `${s.color} ${start}deg ${end}deg`;
            }).join(', ')})`,
          }}
        />
        <div className="wheel-center">🎡</div>
        {!spinning && wheelResult !== null && (
          <div className="wheel-result">
            🎉 {SECTORS[wheelResult]?.label}
          </div>
        )}
      </div>
    </div>
  );
}
