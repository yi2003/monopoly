import { create } from 'zustand';
import type { GameEvent } from '@monopoly/shared';

interface UIStore {
  // Language
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;

  // Modal visibility
  showBuyModal: boolean;
  showBuildModal: boolean;
  showStockModal: boolean;
  showPortfolioModal: boolean;
  showWheelModal: boolean;
  showCardModal: boolean;
  showHandModal: boolean;
  showBankruptcyModal: boolean;
  showGameOverModal: boolean;

  // Card / Wheel data
  lastCardDrawn: { type: string; description: string; descriptionCN: string } | null;
  wheelResult: number | null;

  // Dice timing
  diceRolledAt: number;

  // Event card
  gameEvent: GameEvent | null;
  showEventCard: boolean;
  eventTriggerId: number; // monotonic counter for SceneManager dedup

  // Toast
  toasts: { id: number; message: string; type: string }[];

  // Actions
  openModal: (modal: string) => void;
  closeModal: (modal: string) => void;
  setCardDrawn: (card: any) => void;
  setWheelResult: (index: number | null) => void;
  markDiceRolled: () => void;
  setGameEvent: (event: GameEvent | null) => void;
  toggleHandModal: () => void;
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
  showWheelModal: false,
  showCardModal: false,
  showHandModal: false,
  showBankruptcyModal: false,
  showGameOverModal: false,

  gameEvent: null,
  showEventCard: false,
  eventTriggerId: 0,
  lastCardDrawn: null,
  wheelResult: null,
  diceRolledAt: 0,
  toasts: [],

  openModal: (modal) => set({ [`show${modal}Modal`]: true } as any),
  closeModal: (modal) => set({ [`show${modal}Modal`]: false } as any),

  setGameEvent: (event) => {
    if (event) {
      set(s => ({ gameEvent: event, showEventCard: true, eventTriggerId: s.eventTriggerId + 1 }));
      // Auto-dismiss after 3.5s
      setTimeout(() => {
        set(s => s.showEventCard ? { showEventCard: false } : {});
        setTimeout(() => set({ gameEvent: null }), 400);
      }, 3500);
    } else {
      set({ gameEvent: null, showEventCard: false });
    }
  },

  setCardDrawn: (card) => set({ lastCardDrawn: card, showCardModal: card !== null }),
  setWheelResult: (index) => set({ wheelResult: index, showWheelModal: index !== null }),
  markDiceRolled: () => set({ diceRolledAt: Date.now() }),
  toggleHandModal: () => set(s => ({ showHandModal: !s.showHandModal })),

  addToast: (message, type = 'info') => {
    const id = ++toastId;
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 2500);
  },

  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
