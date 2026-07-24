// ============================================================
// 家庭大富翁 — Game Constants
// ============================================================

import type { Tile, Card, Stock, WheelSector, QuizQuestion, ColorGroup, ThemeId } from './types';

// ---- Board Layout (48 inner ground + 48 outer ground + 24 inner city) ----

export const GROUND_INNER_RING_SIZE = 48;
export const GROUND_OUTER_RING_SIZE = 48;
export const BOARD_SIZE = GROUND_INNER_RING_SIZE + GROUND_OUTER_RING_SIZE; // 96
export const INNER_CITY_SIZE = 24;
export const TOTAL_TILES = BOARD_SIZE + INNER_CITY_SIZE; // 120
export const TILES_PER_SIDE = 12; // tiles per side (excluding wrap count)

// Corner tile indices — inner ring
export const CORNER_GO = 0;
export const CORNER_JAIL = 12;
export const CORNER_STOCK = 24;
export const CORNER_GOTO_JAIL = 36;

// Outer ring starts after inner ring + inner city
export const OUTER_RING_OFFSET = GROUND_INNER_RING_SIZE + INNER_CITY_SIZE; // 72

// Corner tile indices — outer ring
export const OUTER_CORNER_GO = OUTER_RING_OFFSET;        // 72
export const OUTER_CORNER_JAIL = OUTER_RING_OFFSET + 12;  // 84
export const OUTER_CORNER_STOCK = OUTER_RING_OFFSET + 24; // 96
export const OUTER_CORNER_GOTO_JAIL = OUTER_RING_OFFSET + 36; // 108

// ---- Property Definitions ----

export interface PropertyDef {
  index: number;
  nameCN: string;
  nameEN: string;
  group: ColorGroup;
  price: number;
  rent: number[];
  houseCost: number;
  mortgageValue: number;
}

export const PROPERTIES: PropertyDef[] = [
  // ===== Brown Group =====
  { index: 1, nameCN: '滨海小筑', nameEN: 'Seaside Cottage', group: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgageValue: 30 },
  { index: 3, nameCN: '田园别墅', nameEN: 'Garden Villa', group: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgageValue: 30 },

  // ===== Light Blue Group =====
  { index: 6, nameCN: '湖滨公寓', nameEN: 'Lakeside Apt', group: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { index: 8, nameCN: '阳光花苑', nameEN: 'Sunshine Garden', group: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { index: 9, nameCN: '碧水湾', nameEN: 'Crystal Bay', group: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgageValue: 60 },

  // ===== Teal Group =====
  { index: 10, nameCN: '翡翠大道', nameEN: 'Jade Avenue', group: 'teal', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { index: 22, nameCN: '明珠广场', nameEN: 'Pearl Plaza', group: 'teal', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { index: 23, nameCN: '翠苑阁', nameEN: 'Emerald Court', group: 'teal', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgageValue: 80 },

  // ===== Pink Group =====
  { index: 13, nameCN: '樱花园', nameEN: 'Cherry Garden', group: 'pink', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { index: 15, nameCN: '玫瑰庄园', nameEN: 'Rose Estate', group: 'pink', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { index: 16, nameCN: '牡丹亭', nameEN: 'Peony Pavilion', group: 'pink', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgageValue: 100 },

  // ===== Orange Group =====
  { index: 18, nameCN: '金橘里', nameEN: 'Tangerine Lane', group: 'orange', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { index: 20, nameCN: '枫林路', nameEN: 'Maple Road', group: 'orange', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { index: 21, nameCN: '橙光天地', nameEN: 'Amber Heights', group: 'orange', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgageValue: 120 },

  // ===== Red Group =====
  { index: 25, nameCN: '红磡广场', nameEN: 'Hung Hom Square', group: 'red', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { index: 27, nameCN: '赤霞台', nameEN: 'Crimson Terrace', group: 'red', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { index: 28, nameCN: '红河谷', nameEN: 'Red Valley', group: 'red', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgageValue: 140 },

  // ===== Yellow Group =====
  { index: 30, nameCN: '金色海岸', nameEN: 'Gold Coast', group: 'yellow', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { index: 31, nameCN: '黄浦名邸', nameEN: 'Huangpu Mansion', group: 'yellow', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { index: 33, nameCN: '金茂府', nameEN: 'Jinmao Residency', group: 'yellow', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgageValue: 160 },

  // ===== Plum Group =====
  { index: 34, nameCN: '紫晶大道', nameEN: 'Amethyst Blvd', group: 'plum', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgageValue: 175 },
  { index: 44, nameCN: '丁香花园', nameEN: 'Lilac Garden', group: 'plum', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgageValue: 175 },
  { index: 47, nameCN: '紫藤山庄', nameEN: 'Wisteria Hills', group: 'plum', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 },

  // ===== Green Group =====
  { index: 37, nameCN: '绿洲花园', nameEN: 'Oasis Garden', group: 'green', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 },
  { index: 39, nameCN: '翠湖天地', nameEN: 'Green Lake Estate', group: 'green', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 },
  { index: 40, nameCN: '碧桂园', nameEN: 'Jade Heights', group: 'green', price: 420, rent: [55, 220, 650, 1500, 1800, 2100], houseCost: 200, mortgageValue: 210 },

  // ===== Blue Group =====
  { index: 43, nameCN: '派克街', nameEN: 'Park Street', group: 'blue', price: 450, rent: [70, 280, 800, 1800, 2200, 2500], houseCost: 200, mortgageValue: 225 },
  { index: 45, nameCN: '蓝钻广场', nameEN: 'Blue Diamond Plaza', group: 'blue', price: 480, rent: [80, 320, 880, 2000, 2400, 2800], houseCost: 200, mortgageValue: 240 },
];

// ---- Outer Ring Property Definitions (indices 72-119) ----

export const OUTER_PROPERTIES: PropertyDef[] = [
  // ===== Outer Amber Group =====
  { index: 73, nameCN: '琥珀巷', nameEN: 'Amber Alley', group: 'outer_amber', price: 80, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgageValue: 40 },
  { index: 75, nameCN: '蜜糖路', nameEN: 'Honey Lane', group: 'outer_amber', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },

  // ===== Outer Mint Group =====
  { index: 78, nameCN: '薄荷广场', nameEN: 'Mint Plaza', group: 'outer_mint', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgageValue: 60 },
  { index: 80, nameCN: '薄荷花园', nameEN: 'Mint Garden', group: 'outer_mint', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgageValue: 60 },
  { index: 81, nameCN: '翡翠台', nameEN: 'Mint Terrace', group: 'outer_mint', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },

  // ===== Outer Coral Group =====
  { index: 85, nameCN: '珊瑚街', nameEN: 'Coral Street', group: 'outer_coral', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgageValue: 80 },
  { index: 87, nameCN: '海贝湾', nameEN: 'Shell Bay', group: 'outer_coral', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { index: 88, nameCN: '海星阁', nameEN: 'Starfish Court', group: 'outer_coral', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgageValue: 100 },

  // ===== Outer Lime Group =====
  { index: 90, nameCN: '柠檬大道', nameEN: 'Lemon Avenue', group: 'outer_lime', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { index: 92, nameCN: '青柠花园', nameEN: 'Lime Garden', group: 'outer_lime', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgageValue: 120 },
  { index: 93, nameCN: '柑橘台', nameEN: 'Citrus Heights', group: 'outer_lime', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },

  // ===== Outer Violet Group =====
  { index: 97, nameCN: '紫罗兰路', nameEN: 'Violet Road', group: 'outer_violet', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgageValue: 140 },
  { index: 99, nameCN: '薰衣草巷', nameEN: 'Lavender Lane', group: 'outer_violet', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { index: 100, nameCN: '丁香台', nameEN: 'Lilac Terrace', group: 'outer_violet', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgageValue: 160 },

  // ===== Outer Rose Group =====
  { index: 102, nameCN: '玫瑰大道', nameEN: 'Rose Boulevard', group: 'outer_rose', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgageValue: 175 },
  { index: 103, nameCN: '芙蓉广场', nameEN: 'Hibiscus Plaza', group: 'outer_rose', price: 380, rent: [40, 200, 600, 1300, 1500, 1800], houseCost: 200, mortgageValue: 190 },
  { index: 106, nameCN: '牡丹大道', nameEN: 'Peony Avenue', group: 'outer_rose', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 },

  // ===== Outer Sky Group =====
  { index: 109, nameCN: '蓝天路', nameEN: 'Sky Way', group: 'outer_sky', price: 420, rent: [55, 220, 650, 1500, 1800, 2100], houseCost: 200, mortgageValue: 210 },
  { index: 111, nameCN: '云中阁', nameEN: 'Cloud Court', group: 'outer_sky', price: 440, rent: [60, 240, 700, 1600, 1900, 2200], houseCost: 200, mortgageValue: 220 },
  { index: 115, nameCN: '星光台', nameEN: 'Starlight Terrace', group: 'outer_sky', price: 460, rent: [65, 260, 750, 1700, 2000, 2300], houseCost: 200, mortgageValue: 230 },

  // ===== Outer Ruby Group =====
  { index: 82, nameCN: '红宝石街', nameEN: 'Ruby Street', group: 'outer_ruby', price: 500, rent: [70, 300, 850, 1850, 2200, 2600], houseCost: 200, mortgageValue: 250 },
  { index: 94, nameCN: '石榴石路', nameEN: 'Garnet Road', group: 'outer_ruby', price: 520, rent: [75, 320, 880, 1900, 2300, 2700], houseCost: 200, mortgageValue: 260 },
  { index: 107, nameCN: '钻石广场', nameEN: 'Diamond Plaza', group: 'outer_ruby', price: 550, rent: [85, 350, 950, 2100, 2500, 3000], houseCost: 200, mortgageValue: 275 },

  // ===== Outer Copper Group =====
  { index: 116, nameCN: '铜锣湾', nameEN: 'Copper Cove', group: 'outer_copper', price: 50, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgageValue: 25 },
  { index: 118, nameCN: '铜雀台', nameEN: 'Bronze Terrace', group: 'outer_copper', price: 70, rent: [4, 20, 60, 120, 250, 400], houseCost: 50, mortgageValue: 35 },

  // ===== Outer Navy Group =====
  { index: 112, nameCN: '深蓝港', nameEN: 'Navy Harbor', group: 'outer_navy', price: 580, rent: [90, 380, 1000, 2200, 2600, 3200], houseCost: 200, mortgageValue: 290 },
  { index: 119, nameCN: '海军路', nameEN: 'Marina Drive', group: 'outer_navy', price: 620, rent: [100, 420, 1100, 2400, 2800, 3500], houseCost: 200, mortgageValue: 310 },
];

// ---- Railway Definitions ----

export interface RailwayDef {
  index: number;
  nameCN: string;
  nameEN: string;
  price: number;
  mortgageValue: number;
  direction: number; // sector 0-3 for inner city entry
}

export const RAILWAYS: RailwayDef[] = [
  { index: 5, nameCN: '读书线', nameEN: 'Study Line', price: 200, mortgageValue: 100, direction: 0 },
  { index: 11, nameCN: '机场线', nameEN: 'Airport Line', price: 200, mortgageValue: 100, direction: 1 },
  { index: 17, nameCN: '宾州线', nameEN: 'Penn Line', price: 200, mortgageValue: 100, direction: 2 },
  { index: 29, nameCN: 'B&O线', nameEN: 'B&O Line', price: 200, mortgageValue: 100, direction: 3 },
  { index: 35, nameCN: '港口线', nameEN: 'Port Line', price: 200, mortgageValue: 100, direction: 4 },
  { index: 41, nameCN: '短线', nameEN: 'Short Line', price: 200, mortgageValue: 100, direction: 5 },
];

// Outer ring railways (offset by 72)
export const OUTER_RAILWAYS: RailwayDef[] = [
  { index: 77, nameCN: '环城线', nameEN: 'Loop Line', price: 250, mortgageValue: 125, direction: 0 },
  { index: 83, nameCN: '快线', nameEN: 'Express Line', price: 250, mortgageValue: 125, direction: 1 },
  { index: 89, nameCN: '高铁线', nameEN: 'HSR Line', price: 250, mortgageValue: 125, direction: 2 },
  { index: 101, nameCN: '城际线', nameEN: 'Intercity Line', price: 250, mortgageValue: 125, direction: 3 },
  { index: 107, nameCN: '观光线', nameEN: 'Scenic Line', price: 250, mortgageValue: 125, direction: 4 },
  { index: 113, nameCN: '滨海线', nameEN: 'Coastal Line', price: 250, mortgageValue: 125, direction: 5 },
];

// ---- Utility Definitions ----

export interface UtilityDef {
  index: number;
  nameCN: string;
  nameEN: string;
  price: number;
  mortgageValue: number;
}

export const UTILITIES: UtilityDef[] = [
  { index: 14, nameCN: '电力公司', nameEN: 'Electric Company', price: 150, mortgageValue: 75 },
  { index: 32, nameCN: '自来水厂', nameEN: 'Water Works', price: 150, mortgageValue: 75 },
];

// Outer ring utilities
export const OUTER_UTILITIES: UtilityDef[] = [
  { index: 86, nameCN: '通信公司', nameEN: 'Telecom Company', price: 180, mortgageValue: 90 },
  { index: 104, nameCN: '燃气公司', nameEN: 'Gas Company', price: 180, mortgageValue: 90 },
];

// ---- Tax Definitions ----

export interface TaxDef {
  index: number;
  nameCN: string;
  amount: number;
  isLuxury: boolean;
}

export const TAXES: TaxDef[] = [
  { index: 4, nameCN: '所得税', amount: 100, isLuxury: false },
  { index: 46, nameCN: '奢侈税', amount: 200, isLuxury: true },
];

// Outer ring taxes
export const OUTER_TAXES: TaxDef[] = [
  { index: 76, nameCN: '碳排放税', amount: 150, isLuxury: false },
  { index: 118, nameCN: '豪宅税', amount: 250, isLuxury: true },
];

// ---- Combined Arrays (for unified lookups) ----

export const ALL_PROPERTIES = [...PROPERTIES, ...OUTER_PROPERTIES];
export const ALL_RAILWAYS = [...RAILWAYS, ...OUTER_RAILWAYS];
export const ALL_UTILITIES = [...UTILITIES, ...OUTER_UTILITIES];

// ---- Complete Tiles Array ----

export function createTiles(): Tile[] {
  const tiles: Tile[] = [];
  const propMap = new Map(ALL_PROPERTIES.map(p => [p.index, p]));
  const railMap = new Map(ALL_RAILWAYS.map(r => [r.index, r]));
  const utilMap = new Map(ALL_UTILITIES.map(u => [u.index, u]));
  const taxMap = new Map([...TAXES, ...OUTER_TAXES].map(t => [t.index, t]));

  const isGroundInner = (i: number) => i < GROUND_INNER_RING_SIZE;
  const isGroundOuter = (i: number) => i >= OUTER_RING_OFFSET && i < TOTAL_TILES;

  const ringFor = (i: number) =>
    isGroundInner(i) ? 'ground-inner' as const :
    isGroundOuter(i) ? 'ground-outer' as const :
    'inner' as const;

  // Process all tile indices: inner ground (0-47) + inner city (48-71) + outer ground (72-119)
  for (let i = 0; i < TOTAL_TILES; i++) {
    // Inner city tiles (48-71)
    if (i >= GROUND_INNER_RING_SIZE && i < OUTER_RING_OFFSET) {
      tiles.push(createInnerTile(i));
      continue;
    }

    const ring = ringFor(i);

    if (propMap.has(i)) {
      const p = propMap.get(i)!;
      tiles.push({
        index: i, name: p.nameEN, nameCN: p.nameCN,
        type: 'property' as const, ring,
        group: p.group, price: p.price, rent: p.rent,
        houseCost: p.houseCost, mortgageValue: p.mortgageValue,
      });
    } else if (railMap.has(i)) {
      const r = railMap.get(i)!;
      tiles.push({
        index: i, name: r.nameEN, nameCN: r.nameCN,
        type: 'railway' as const, ring,
        price: r.price, mortgageValue: r.mortgageValue,
      });
    } else if (utilMap.has(i)) {
      const u = utilMap.get(i)!;
      tiles.push({
        index: i, name: u.nameEN, nameCN: u.nameCN,
        type: 'utility' as const, ring,
        price: u.price, mortgageValue: u.mortgageValue,
      });
    } else if (taxMap.has(i)) {
      const t = taxMap.get(i)!;
      tiles.push({
        index: i, name: t.nameCN, nameCN: t.nameCN,
        type: 'tax' as const, ring,
        amount: t.amount, isLuxury: t.isLuxury,
      });
    } else {
      tiles.push(createSpecialTile(i));
    }
  }

  return tiles;
}

function createSpecialTile(i: number): Tile {
  const ring = (i >= OUTER_RING_OFFSET) ? 'ground-outer' as const : 'ground-inner' as const;
  // Normalize to local position for outer ring
  const localIdx = i >= OUTER_RING_OFFSET ? i - OUTER_RING_OFFSET : i;

  // GO
  if (localIdx === 0) {
    return { index: i, name: 'GO', nameCN: '起点', type: 'go', ring };
  }
  // Jail
  if (localIdx === 12) {
    return { index: i, name: 'Jail', nameCN: '监狱', type: 'jail', ring };
  }
  // Stock Market
  if (localIdx === 24) {
    return { index: i, name: 'Stock Market', nameCN: '股市', type: 'stock_market', ring };
  }
  // Go To Jail
  if (localIdx === 36) {
    return { index: i, name: 'Go To Jail', nameCN: '进监狱', type: 'goto_jail', ring };
  }

  // Community Chest
  if ((i >= OUTER_RING_OFFSET && (localIdx === 2 || localIdx === 19)) ||
      (i < GROUND_INNER_RING_SIZE && (i === 2 || i === 19))) {
    return { index: i, name: 'Community Chest', nameCN: '公益金', type: 'community_chest', ring };
  }

  // Chance
  if ((i >= OUTER_RING_OFFSET && [7, 26, 42].includes(localIdx)) ||
      (i < GROUND_INNER_RING_SIZE && [7, 26, 42].includes(i))) {
    return { index: i, name: 'Chance', nameCN: '机会', type: 'chance', ring };
  }

  // Wheel
  if (localIdx === 38) {
    return { index: i, name: 'Wheel of Fortune', nameCN: '大转盘', type: 'wheel', ring };
  }

  return { index: i, name: 'Unknown', nameCN: '未知', type: 'go', ring };
}

function createInnerTile(i: number): Tile {
  const localIdx = i - BOARD_SIZE; // 0-23
  const ring = Math.floor(localIdx / 8); // 0=outer, 1=middle, 2=inner
  const sector = localIdx % 8;
  const ringNames = ['外环', '中环', '内环'];
  const ringFees = [50, 100, 200];

  const innerTypes = [
    'inner_square', 'inner_cafe', 'inner_chance', 'inner_rest',
    'inner_fountain', 'inner_shop', 'inner_food', 'inner_community',
  ] as const;

  const innerNamesCN = ['广场', '咖啡馆', '机会', '休息', '喷泉', '商店', '美食', '公益金'];
  const innerNamesEN = ['Square', 'Café', 'Chance', 'Rest', 'Fountain', 'Shop', 'Food', 'Community'];
  const innerValues = [40, 15, 0, 0, 25, 0, -15, 0];

  const type = innerTypes[sector];
  const nameCN = `${ringNames[ring]}${innerNamesCN[sector]}`;
  const nameEN = `${['Outer', 'Middle', 'Inner'][ring]} ${innerNamesEN[sector]}`;

  return {
    index: i,
    name: nameEN,
    nameCN,
    type,
    ring: 'inner',
    fee: ringFees[ring] + innerValues[sector],
  };
}

// ---- Railway Rent Table ----

export const RAILWAY_RENT: Record<ThemeId, number[]> = {
  classic: [25, 50, 100, 200],
  shanghai: [25, 50, 100, 200], // + 1.5x combo bonus handled in rules
  tokyo: [30, 60, 120, 240],
};

// ---- Color Group Hex Values ----

export const GROUP_COLORS: Record<ColorGroup, string> = {
  brown: '#8B4513',
  lightblue: '#87CEEB',
  teal: '#008080',
  pink: '#FF69B4',
  orange: '#FF8C00',
  red: '#DC143C',
  yellow: '#FFD700',
  plum: '#8B008B',
  green: '#228B22',
  blue: '#0000CD',
  // Outer ring groups
  outer_amber: '#FFBF00',
  outer_mint: '#98FB98',
  outer_coral: '#FF7F50',
  outer_lime: '#32CD32',
  outer_violet: '#8A2BE2',
  outer_rose: '#FF1493',
  outer_sky: '#00BFFF',
  outer_ruby: '#E0115F',
  outer_copper: '#B87333',
  outer_navy: '#000080',
  railway: '#FFD700',
  utility: '#C0C0C0',
};

// ---- Chance Cards ----

export const CHANCE_CARDS: Card[] = [
  { id: 0, type: 'chance', description: 'Advance to GO', descriptionCN: '前进到起点', effect: { kind: 'move', target: 0, collectGo: true } },
  { id: 1, type: 'chance', description: 'Bank pays you $50', descriptionCN: '银行付给你$50', effect: { kind: 'cash', amount: 50 } },
  { id: 2, type: 'chance', description: 'Pay poor tax of $15', descriptionCN: '缴纳济贫税$15', effect: { kind: 'cash', amount: -15 } },
  { id: 3, type: 'chance', description: 'Advance to Stock Market', descriptionCN: '前进到股市', effect: { kind: 'move', target: 24, collectGo: true } },
  { id: 4, type: 'chance', description: 'Go to Jail', descriptionCN: '进监狱', effect: { kind: 'jail' } },
  { id: 5, type: 'chance', description: 'Get Out of Jail Free', descriptionCN: '免费出狱卡', effect: { kind: 'getOutOfJail' } },
  { id: 6, type: 'chance', description: 'Advance to nearest Railway', descriptionCN: '前进到最近的铁路', effect: { kind: 'moveToNearest', tileType: 'railway', payMultiplier: 2 } },
  { id: 7, type: 'chance', description: 'Advance to nearest Utility', descriptionCN: '前进到最近的公共事业', effect: { kind: 'moveToNearest', tileType: 'utility', payMultiplier: 10 } },
  { id: 8, type: 'chance', description: 'Bank pays you $150', descriptionCN: '银行付给你$150', effect: { kind: 'cash', amount: 150 } },
  { id: 9, type: 'chance', description: 'Pay each player $50', descriptionCN: '付给每位玩家$50', effect: { kind: 'cashPerPlayer', amount: -50 } },
  { id: 10, type: 'chance', description: 'Collect $50 from each player', descriptionCN: '向每位玩家收取$50', effect: { kind: 'cashPerPlayer', amount: 50 } },
  { id: 11, type: 'chance', description: 'Make general repairs: $25 per house, $100 per hotel', descriptionCN: '房屋维修：每栋$25，酒店$100', effect: { kind: 'repairs', perHouse: 25, perHotel: 100 } },
  { id: 12, type: 'chance', description: 'Go back 3 spaces', descriptionCN: '后退3格', effect: { kind: 'moveBack', spaces: 3 } },
  { id: 13, type: 'chance', description: 'Building loan matures: collect $150', descriptionCN: '建筑贷款到期：获得$150', effect: { kind: 'cash', amount: 150 } },
];

// ---- Theme-specific Extra Chance Cards ----

export const SHANGHAI_EXTRA_CHANCE_CARDS: Card[] = [
  { id: 200, type: 'chance', description: 'Shanghai Metro upgrade: collect $100', descriptionCN: '上海地铁升级：获得$100', effect: { kind: 'cash', amount: 100 } },
  { id: 201, type: 'chance', description: 'Pudong development bonus: collect $200', descriptionCN: '浦东开发红利：获得$200', effect: { kind: 'cash', amount: 200 } },
];

export const TOKYO_EXTRA_CHANCE_CARDS: Card[] = [
  { id: 300, type: 'chance', description: 'Shibuya crossing event: collect $120', descriptionCN: '涩谷十字路口活动：获得$120', effect: { kind: 'cash', amount: 120 } },
  { id: 301, type: 'chance', description: 'Tsukiji fish market windfall: collect $180', descriptionCN: '筑地鱼市横财：获得$180', effect: { kind: 'cash', amount: 180 } },
];

// ---- Theme-specific Extra Community Chest Cards ----

export const SHANGHAI_EXTRA_COMMUNITY_CHEST_CARDS: Card[] = [
  { id: 210, type: 'community_chest', description: 'Shanghai Disney ticket refund: collect $80', descriptionCN: '上海迪士尼退票：获得$80', effect: { kind: 'cash', amount: 80 } },
  { id: 211, type: 'community_chest', description: 'Nanjing Road shopping rebate: collect $120', descriptionCN: '南京路购物返利：获得$120', effect: { kind: 'cash', amount: 120 } },
];

export const TOKYO_EXTRA_COMMUNITY_CHEST_CARDS: Card[] = [
  { id: 310, type: 'community_chest', description: 'Akihabara electronics rebate: collect $90', descriptionCN: '秋叶原电器返利：获得$90', effect: { kind: 'cash', amount: 90 } },
  { id: 311, type: 'community_chest', description: 'Ginza department store credit: collect $150', descriptionCN: '银座百货抵扣：获得$150', effect: { kind: 'cash', amount: 150 } },
];

// ---- Community Chest Cards ----

export const COMMUNITY_CHEST_CARDS: Card[] = [
  { id: 100, type: 'community_chest', description: 'Bank error in your favor: collect $200', descriptionCN: '银行错误：获得$200', effect: { kind: 'cash', amount: 200 } },
  { id: 101, type: 'community_chest', description: 'Doctor\'s fee: pay $50', descriptionCN: '医疗费：支付$50', effect: { kind: 'cash', amount: -50 } },
  { id: 102, type: 'community_chest', description: 'From sale of stock: collect $50', descriptionCN: '股票收益：获得$50', effect: { kind: 'cash', amount: 50 } },
  { id: 103, type: 'community_chest', description: 'Get Out of Jail Free', descriptionCN: '免费出狱卡', effect: { kind: 'getOutOfJail' } },
  { id: 104, type: 'community_chest', description: 'Go to Jail', descriptionCN: '进监狱', effect: { kind: 'jail' } },
  { id: 105, type: 'community_chest', description: 'Grand opera night: collect $50 from each player', descriptionCN: '歌剧之夜：向每位玩家收取$50', effect: { kind: 'cashPerPlayer', amount: 50 } },
  { id: 106, type: 'community_chest', description: 'Holiday fund matures: collect $100', descriptionCN: '假日基金到期：获得$100', effect: { kind: 'cash', amount: 100 } },
  { id: 107, type: 'community_chest', description: 'Income tax refund: collect $20', descriptionCN: '退税：获得$20', effect: { kind: 'cash', amount: 20 } },
  { id: 108, type: 'community_chest', description: 'Life insurance matures: collect $100', descriptionCN: '人寿保险到期：获得$100', effect: { kind: 'cash', amount: 100 } },
  { id: 109, type: 'community_chest', description: 'Hospital fees: pay $100', descriptionCN: '住院费：支付$100', effect: { kind: 'cash', amount: -100 } },
  { id: 110, type: 'community_chest', description: 'School fees: pay $50', descriptionCN: '学费：支付$50', effect: { kind: 'cash', amount: -50 } },
  { id: 111, type: 'community_chest', description: 'Consultancy fee: collect $25', descriptionCN: '咨询费：获得$25', effect: { kind: 'cash', amount: 25 } },
  { id: 112, type: 'community_chest', description: 'Street repairs: $40 per house, $115 per hotel', descriptionCN: '街道维修：每栋$40，酒店$115', effect: { kind: 'repairs', perHouse: 40, perHotel: 115 } },
  { id: 113, type: 'community_chest', description: 'Beauty contest second prize: collect $10', descriptionCN: '选美比赛二等奖：获得$10', effect: { kind: 'cash', amount: 10 } },
  { id: 114, type: 'community_chest', description: 'Inheritance: collect $100', descriptionCN: '遗产继承：获得$100', effect: { kind: 'cash', amount: 100 } },
  { id: 115, type: 'community_chest', description: 'Birthday: collect $10 from each player', descriptionCN: '生日：向每位玩家收取$10', effect: { kind: 'cashPerPlayer', amount: 10 } },
];

// ---- Stock Market ----

export interface StockDef {
  symbol: string;
  name: string;
  nameCN: string;
  sector: string;
  initialPrice: number;
  volatility: number;
}

export const STOCKS: StockDef[] = [
  { symbol: 'FOOD', name: 'Food Corp', nameCN: '食品公司', sector: 'Consumer', initialPrice: 50, volatility: 0.18 },
  { symbol: 'RETAIL', name: 'Retail Group', nameCN: '零售集团', sector: 'Consumer', initialPrice: 65, volatility: 0.20 },
  { symbol: 'AUTO', name: 'Auto Motors', nameCN: '汽车工业', sector: 'Industrial', initialPrice: 80, volatility: 0.22 },
  { symbol: 'REIT', name: 'Real Estate Trust', nameCN: '房地产信托', sector: 'Real Estate', initialPrice: 90, volatility: 0.19 },
  { symbol: 'ENERGY', name: 'Energy Power', nameCN: '能源电力', sector: 'Energy', initialPrice: 70, volatility: 0.25 },
  { symbol: 'MINING', name: 'Mining Resources', nameCN: '矿业资源', sector: 'Materials', initialPrice: 60, volatility: 0.28 },
  { symbol: 'AGRI', name: 'Agriculture Co', nameCN: '农业公司', sector: 'Materials', initialPrice: 45, volatility: 0.17 },
  { symbol: 'BANK', name: 'National Bank', nameCN: '国民银行', sector: 'Financial', initialPrice: 100, volatility: 0.16 },
  { symbol: 'INSURE', name: 'Insurance Ltd', nameCN: '保险有限公司', sector: 'Financial', initialPrice: 85, volatility: 0.15 },
  { symbol: 'TECH', name: 'Tech Innovators', nameCN: '科技创新', sector: 'Technology', initialPrice: 120, volatility: 0.30 },
  { symbol: 'AI', name: 'AI Dynamics', nameCN: '人工智能', sector: 'Technology', initialPrice: 150, volatility: 0.35 },
  { symbol: 'CHIP', name: 'Chip Semiconductor', nameCN: '芯片半导体', sector: 'Technology', initialPrice: 130, volatility: 0.32 },
  { symbol: 'NET', name: 'Net Communications', nameCN: '网络通讯', sector: 'Technology', initialPrice: 95, volatility: 0.26 },
  { symbol: 'PHARMA', name: 'Pharma Health', nameCN: '医药健康', sector: 'Healthcare', initialPrice: 75, volatility: 0.20 },
  { symbol: 'BIO', name: 'Bio Genetics', nameCN: '生物基因', sector: 'Healthcare', initialPrice: 110, volatility: 0.33 },
  { symbol: 'GOLD', name: 'Gold Reserve', nameCN: '黄金储备', sector: 'Precious Metals', initialPrice: 140, volatility: 0.24 },
  { symbol: 'LUXURY', name: 'Luxury Brands', nameCN: '奢侈品牌', sector: 'Consumer', initialPrice: 160, volatility: 0.20 },
  { symbol: 'AIR', name: 'Airline Holdings', nameCN: '航空控股', sector: 'Industrial', initialPrice: 55, volatility: 0.27 },
];

// ---- Wheel of Fortune ----

export const WHEEL_SECTORS: WheelSector[] = [
  { index: 0, label: '+$200', effect: { kind: 'cash', amount: 200 }, color: '#4CAF50' },
  { index: 1, label: '+$500', effect: { kind: 'cash', amount: 500 }, color: '#66BB6A' },
  { index: 2, label: '+$1000', effect: { kind: 'cash', amount: 1000 }, color: '#2E7D32' },
  { index: 3, label: '-$100', effect: { kind: 'cash', amount: -100 }, color: '#EF5350' },
  { index: 4, label: '-$300', effect: { kind: 'cash', amount: -300 }, color: '#E53935' },
  { index: 5, label: '监狱', effect: { kind: 'jail' }, color: '#424242' },
  { index: 6, label: '前进到GO', effect: { kind: 'moveToGO' }, color: '#FFD700' },
  { index: 7, label: '每人付你$50', effect: { kind: 'cashPerPlayer', amount: 50 }, color: '#2196F3' },
  { index: 8, label: '你付每人$50', effect: { kind: 'cashPerPlayer', amount: -50 }, color: '#FF9800' },
  { index: 9, label: '出狱卡', effect: { kind: 'getOutOfJail' }, color: '#9C27B0' },
  { index: 10, label: '免费建房', effect: { kind: 'freeHouse' }, color: '#00BCD4' },
  { index: 11, label: '科技股×2', effect: { kind: 'freeStock', symbol: 'TECH', shares: 2 }, color: '#3F51B5' },
  { index: 12, label: '黄金股×1', effect: { kind: 'freeStock', symbol: 'GOLD', shares: 1 }, color: '#FFC107' },
  { index: 13, label: 'AI股×2', effect: { kind: 'freeStock', symbol: 'AI', shares: 2 }, color: '#E91E63' },
];

// ---- Quiz Questions ----

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 0, question: '标准大富翁棋盘有多少格地面环？', options: ['40格', '44格', '48格', '52格'], correctIndex: 2, category: '规则' },
  { id: 1, question: '掷出几次连续双数会直接进监狱？', options: ['2次', '3次', '4次', '5次'], correctIndex: 1, category: '规则' },
  { id: 2, question: '一座酒店相当于几栋房屋？', options: ['3栋', '4栋', '5栋', '6栋'], correctIndex: 2, category: '规则' },
  { id: 3, question: '经过起点(GO)可以领取多少工资？(经典模式)', options: ['$100', '$150', '$200', '$250'], correctIndex: 1, category: '规则' },
  { id: 4, question: '本游戏有几只可交易的股票？', options: ['12只', '15只', '18只', '20只'], correctIndex: 2, category: '特色' },
  { id: 5, question: '股市交易的手续费率是多少？', options: ['1%', '2%', '3%', '5%'], correctIndex: 2, category: '特色' },
  { id: 6, question: '大转盘有多少个扇区？', options: ['10个', '12个', '14个', '16个'], correctIndex: 2, category: '特色' },
  { id: 7, question: '知识问答在回合开始时的触发概率？', options: ['8%', '10%', '12%', '15%'], correctIndex: 2, category: '特色' },
  { id: 8, question: '监狱最多关押几个回合？', options: ['2回合', '3回合', '4回合', '5回合'], correctIndex: 1, category: '规则' },
  { id: 9, question: '拥有整组颜色地产时，无房屋的租金如何？', options: ['不变', '1.5倍', '双倍', '三倍'], correctIndex: 2, category: '规则' },
  { id: 10, question: '内城共有几个环？', options: ['2个', '3个', '4个', '5个'], correctIndex: 1, category: '特色' },
  { id: 11, question: '困难难度下回合维护费是多少？', options: ['2%', '3%', '5%', '8%'], correctIndex: 2, category: '规则' },
  { id: 12, question: '本游戏包含几种天气？', options: ['3种', '4种', '5种', '6种'], correctIndex: 2, category: '特色' },
  { id: 13, question: '拥有2个公共事业时，租金是骰点的几倍？', options: ['4倍', '6倍', '8倍', '10倍'], correctIndex: 3, category: '规则' },
  { id: 14, question: '第一大富翁比赛于哪一年举行？', options: ['1970年', '1973年', '1975年', '1977年'], correctIndex: 1, category: '历史' },
];

// ---- Player Colors ----

export const PLAYER_COLORS = [
  '#E53935', // Red
  '#1E88E5', // Blue
  '#43A047', // Green
  '#FB8C00', // Orange
  '#8E24AA', // Purple
  '#00ACC1', // Cyan
];

export const PLAYER_COLOR_NAMES = ['红', '蓝', '绿', '橙', '紫', '青'];

// ---- Default Game Config ----

export const DEFAULT_STARTING_CASH: Record<ThemeId, number> = {
  classic: 1500,
  shanghai: 1800,
  tokyo: 1600,
};

export const GO_SALARY: Record<ThemeId, number> = {
  classic: 150,
  shanghai: 180,
  tokyo: 150,
};

export const JAIL_FINE = 50;
export const MAX_JAIL_TURNS = 3;
export const MAX_HOUSES = 5;
export const HOUSE_HOTEL_THRESHOLD = 5; // 5 houses = hotel
export const STOCK_TRADE_FEE = 0.03; // 3%
export const MIN_STOCK_FEE = 5;
export const QUIZ_TRIGGER_CHANCE = 0.12; // 12% chance at turn start

// ---- Room Codes ----

export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
export const ROOM_CODE_LENGTH = 4;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS_TO_START = 2;
