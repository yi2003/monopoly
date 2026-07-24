import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../network/socket';

export default function QuizModal() {
  const gameState = useGameStore(s => s.gameState);
  const phase = useGameStore(s => s.phase);
  const quizData = useUIStore(s => s.quizData);
  const quizResult = useUIStore(s => s.quizResult);
  const quizRewardAmount = useUIStore(s => s.quizRewardAmount);
  const showQuizModal = useUIStore(s => s.showQuizModal);
  const setQuizData = useUIStore(s => s.setQuizData);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Reset when new quiz appears
  useEffect(() => {
    if (showQuizModal && quizData) {
      setSelectedIndex(null);
      setSubmitted(false);
    }
  }, [showQuizModal, quizData]);

  // Auto-close after showing result for 2s
  useEffect(() => {
    if (quizResult && submitted) {
      const timer = setTimeout(() => {
        setQuizData(null);
        setSelectedIndex(null);
        setSubmitted(false);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [quizResult, submitted]);

  if (!showQuizModal || !quizData) return null;

  const handleAnswer = (index: number) => {
    if (submitted) return;
    setSelectedIndex(index);
    setSubmitted(true);
    getSocket()?.emit('answerQuiz', index);
  };

  // If we have a result, show the result screen
  if (submitted && quizResult) {
    const isCorrect = quizResult === 'correct';
    return (
      <div className="modal-overlay">
        <div className={`modal quiz-modal quiz-result ${isCorrect ? 'correct' : 'wrong'}`}>
          <div className="quiz-result-icon">{isCorrect ? '🎉' : '😞'}</div>
          <h2 style={{ color: isCorrect ? '#4CAF50' : '#E53935' }}>
            {isCorrect ? '回答正确！' : '回答错误！'}
          </h2>
          {quizRewardAmount !== null && (
            <p className="quiz-result-amount" style={{ color: isCorrect ? '#4CAF50' : '#E53935', fontSize: '1.5em', fontWeight: 'bold' }}>
              {isCorrect ? '+' : '-'}${quizRewardAmount.toLocaleString()}
            </p>
          )}
          <p className="quiz-result-hint" style={{ color: '#aaa', fontSize: '0.85em' }}>
            {isCorrect ? '奖励已发放' : '罚金已扣除'}
          </p>
        </div>
      </div>
    );
  }

  const question = quizData;

  return (
    <div className="modal-overlay">
      <div className="modal quiz-modal">
        <h2>🧠 知识问答</h2>
        <div className="quiz-question">
          <p>{question.question}</p>
        </div>
        <div className="quiz-options">
          {question.options.map((opt, i) => (
            <button
              key={i}
              className={`btn btn-outline quiz-option ${submitted && i === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleAnswer(i)}
              disabled={submitted}
            >
              {String.fromCharCode(65 + i)}. {opt}
            </button>
          ))}
        </div>
        {!submitted && (
          <div className="quiz-info">
            <small>✅ 正确: 获得奖励 (租金倍率) | ❌ 错误: 支付罚金 (税费倍率)</small>
          </div>
        )}
        {submitted && !quizResult && (
          <div className="quiz-waiting">
            <p>⏳ 等待结果...</p>
          </div>
        )}
      </div>
    </div>
  );
}
