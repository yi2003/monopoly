// ============================================================
// 家庭大富翁 — Theme & Difficulty Configuration
// ============================================================

import type { ThemeId, DifficultyId } from './types';
import { DEFAULT_STARTING_CASH, GO_SALARY } from './constants';

// ---- Theme Configuration ----

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  nameCN: string;
  startingCash: number;
  goSalary: number;
  dividendChance: number;   // probability per round
  dividendRate: number;     // % of stock price
  railwayRent: number[];
  railwayComboBonus: boolean; // shanghai: ≥2 railways ×1.5
  extraChanceCards: number;
  extraCommunityCards: number;
  description: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    nameCN: '经典版',
    startingCash: DEFAULT_STARTING_CASH.classic,
    goSalary: GO_SALARY.classic,
    dividendChance: 0.12,
    dividendRate: 0.05,
    railwayRent: [25, 50, 100, 200],
    railwayComboBonus: false,
    extraChanceCards: 0,
    extraCommunityCards: 0,
    description: '标准大富翁规则',
  },
  shanghai: {
    id: 'shanghai',
    name: 'Shanghai',
    nameCN: '上海版',
    startingCash: DEFAULT_STARTING_CASH.shanghai,
    goSalary: GO_SALARY.shanghai,
    dividendChance: 0.18,
    dividendRate: 0.08,
    railwayRent: [25, 50, 100, 200],
    railwayComboBonus: true,
    extraChanceCards: 2,
    extraCommunityCards: 2,
    description: '上海主题，铁路组合加成',
  },
  tokyo: {
    id: 'tokyo',
    name: 'Tokyo',
    nameCN: '东京版',
    startingCash: DEFAULT_STARTING_CASH.tokyo,
    goSalary: GO_SALARY.tokyo,
    dividendChance: 0.12,
    dividendRate: 0.05,
    railwayRent: [30, 60, 120, 240],
    railwayComboBonus: false,
    extraChanceCards: 2,
    extraCommunityCards: 2,
    description: '东京主题，提高铁路租金',
  },
};

// ---- Difficulty Configuration ----

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  nameCN: string;
  cashMultiplier: number;   // starting cash × multiplier
  goSalaryMultiplier: number;
  rentMultiplier: number;
  taxMultiplier: number;
  stockVolatility: number;  // additional volatility
  drainPct: number;         // per-turn cash drain
  turnLimit: number;        // 0 = unlimited
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    nameCN: '简单',
    cashMultiplier: 1.0,
    goSalaryMultiplier: 0.9,
    rentMultiplier: 0.9,
    taxMultiplier: 1.0,
    stockVolatility: 0.15,
    drainPct: 0,
    turnLimit: 0,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    nameCN: '标准',
    cashMultiplier: 1.0,
    goSalaryMultiplier: 0.7,
    rentMultiplier: 1.3,
    taxMultiplier: 1.3,
    stockVolatility: 0.20,
    drainPct: 0.03,
    turnLimit: 0,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    nameCN: '困难',
    cashMultiplier: 0.8,
    goSalaryMultiplier: 0.55,
    rentMultiplier: 1.7,
    taxMultiplier: 1.6,
    stockVolatility: 0.30,
    drainPct: 0.05,
    turnLimit: 30,
  },
  extreme: {
    id: 'extreme',
    name: 'Extreme',
    nameCN: '极限',
    cashMultiplier: 0.6,
    goSalaryMultiplier: 0.4,
    rentMultiplier: 2.3,
    taxMultiplier: 2.0,
    stockVolatility: 0.40,
    drainPct: 0.08,
    turnLimit: 15,
  },
};

// ---- Helper: combine theme + difficulty for effective values ----

export interface EffectiveConfig {
  startingCash: number;
  goSalary: number;
  rentMultiplier: number;
  taxMultiplier: number;
  stockVolatility: number;
  drainPct: number;
  turnLimit: number;
}

export function getEffectiveConfig(theme: ThemeId, difficulty: DifficultyId): EffectiveConfig {
  const t = THEMES[theme];
  const d = DIFFICULTIES[difficulty];
  return {
    startingCash: Math.round(t.startingCash * d.cashMultiplier),
    goSalary: Math.round(t.goSalary * d.goSalaryMultiplier),
    rentMultiplier: d.rentMultiplier,
    taxMultiplier: d.taxMultiplier,
    stockVolatility: d.stockVolatility,
    drainPct: d.drainPct,
    turnLimit: d.turnLimit,
  };
}
