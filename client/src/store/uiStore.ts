import { create } from 'zustand';

interface UIStore {
  // Language
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;

  // Modal visibility
  showBuyModal: boolean;
  showBuildModal: boolean;
  showStockModal: boolean;
  showPortfolioModal: boolean;
  showQuizModal: boolean;
  showWheelModal: boolean;
  showCardModal: boolean;
  showBankruptcyModal: boolean;
  showGameOverModal: boolean;

  // Card / Wheel / Quiz data
  lastCardDrawn: { type: string; description: string; descriptionCN: string } | null;
  wheelResult: number | null;
  quizData: { question: string; options: string[]; reward: string; penalty: string } | null;
  quizResult: 'correct' | 'wrong' | null;
  quizRewardAmount: number | null;

  // Dice timing
  diceRolledAt: number;

  // Toast
  toasts: { id: number; message: string; type: string }[];

  // Actions
  openModal: (modal: string) => void;
  closeModal: (modal: string) => void;
  setCardDrawn: (card: any) => void;
  setWheelResult: (index: number | null) => void;
  setQuizData: (data: any) => void;
  setQuizResult: (result: 'correct' | 'wrong' | null, amount?: number) => void;
  markDiceRolled: () => void;
  addToast: (message: string, type?: string) => void;
  removeToast: (id: number) => void;
}

let toastId = 0;

export const useUIStore = create<UIStore>((set) => ({
  language: (localStorage.getItem('monopoly_lang') as 'zh' | 'en') || 'zh',
  setLanguage: (lang) => {
    localStorage.setItem('monopoly_lang', lang);
    set({ language: lang });
  },

  showBuyModal: false,
  showBuildModal: false,
  showStockModal: false,
  showPortfolioModal: false,
  showQuizModal: false,
  showWheelModal: false,
  showCardModal: false,
  showBankruptcyModal: false,
  showGameOverModal: false,

  lastCardDrawn: null,
  wheelResult: null,
  quizData: null,
  quizResult: null,
  quizRewardAmount: null,
  diceRolledAt: 0,
  toasts: [],

  openModal: (modal) => set({ [`show${modal}Modal`]: true } as any),
  closeModal: (modal) => set({ [`show${modal}Modal`]: false } as any),

  setCardDrawn: (card) => set({ lastCardDrawn: card, showCardModal: true }),
  setWheelResult: (index) => set({ wheelResult: index, showWheelModal: index !== null }),
  setQuizData: (data) => set({ quizData: data, showQuizModal: true, quizResult: null, quizRewardAmount: null }),
  setQuizResult: (result, amount) => set({ quizResult: result, quizRewardAmount: amount ?? null }),
  markDiceRolled: () => set({ diceRolledAt: Date.now() }),

  addToast: (message, type = 'info') => {
    const id = ++toastId;
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 2500);
  },

  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
