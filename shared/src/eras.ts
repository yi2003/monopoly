// ============================================================
// Era definitions — time machine for the city block
// Ported from opus5/src/eras.js, simplified to 4 key eras
// ============================================================

import type { EraId } from './types';

export interface EraPalette {
  skyZenith: string;
  skyHorizon: string;
  fog: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  ambient: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  bloom: number;
  grade: EraGrade;
}

export interface EraGrade {
  contrast: number;
  saturation: number;
  warmth: number;
  vignette: number;
  grain: number;
}

export interface EraBuildings {
  heightMul: number;
  maxFloors: number;
  styles: string[];
  windowLit: number;
  windowWarmth: number;
  soot: number;
  cornice: boolean;
  fireEscapes: boolean;
  antennas: number;
}

export interface EraStreet {
  surface: string;
  sidewalk: string;
  markings: string;
  lampStyle: string;
}

export interface EraTraffic {
  density: number;
  speed: number;
  types: string[];
}

export interface EraPeople {
  density: number;
  outfits: string[];
  pace: number;
}

export interface EraShop {
  name: string;
  kind: string;
  color: string;
}

export interface EraAd {
  text: string;
  sub: string;
  style: string;
  color: string;
}

export interface EraDef {
  id: EraId;
  year: number;
  title: string;
  tagline: string;
  palette: EraPalette;
  buildings: EraBuildings;
  street: EraStreet;
  traffic: EraTraffic;
  people: EraPeople;
  shops: EraShop[];
  ads: EraAd[];
}

export const ERAS: Record<EraId, EraDef> = {
  '1945': {
    id: '1945',
    year: 1945,
    title: 'POSTWAR',
    tagline: 'Brick, soot & neon first light',
    palette: {
      skyZenith: '#1a2438',
      skyHorizon: '#c4784a',
      fog: '#8a6a55',
      fogDensity: 0.018,
      sunColor: '#ffb070',
      sunIntensity: 1.15,
      ambient: '#3a2a22',
      ambientIntensity: 0.45,
      hemiSky: '#6a7a9a',
      hemiGround: '#3a2818',
      bloom: 0.35,
      grade: { contrast: 1.04, saturation: 0.82, warmth: 0.18, vignette: 0.25, grain: 0.03 },
    },
    buildings: {
      heightMul: 0.55,
      maxFloors: 6,
      styles: ['brick', 'stone', 'brick'],
      windowLit: 0.72,
      windowWarmth: 0.85,
      soot: 0.55,
      cornice: true,
      fireEscapes: true,
      antennas: 0.15,
    },
    street: {
      surface: 'asphalt-worn',
      sidewalk: 'concrete-old',
      markings: 'faded',
      lampStyle: 'gas-electric',
    },
    traffic: {
      density: 0.45,
      speed: 0.55,
      types: ['sedan40s', 'sedan40s', 'coupe40s', 'truck40s'],
    },
    people: {
      density: 0.55,
      outfits: ['overcoat', 'fedora', 'dress40s', 'uniform', 'apron'],
      pace: 0.7,
    },
    shops: [
      { name: 'MERIDIAN HARDWARE', kind: 'hardware', color: '#8b3a2a' },
      { name: "ROSIE'S DINER", kind: 'diner', color: '#c45a3a' },
      { name: 'CROWN BARBER', kind: 'barber', color: '#e8e0d0' },
      { name: 'APEX PHARMACY', kind: 'pharmacy', color: '#2a5a4a' },
      { name: 'VICTORY LOANS', kind: 'office', color: '#3a4a6a' },
      { name: 'PALACE THEATRE', kind: 'theatre', color: '#6a1a2a' },
      { name: "MURPHY'S TAVERN", kind: 'bar', color: '#2a2218' },
      { name: 'CITY GROCER', kind: 'grocer', color: '#4a6a3a' },
    ],
    ads: [
      { text: 'BUY BONDS', sub: 'FINISH THE JOB', style: 'poster', color: '#c4302a' },
      { text: 'LUCKY STRIKE', sub: 'SO ROUND · SO FIRM', style: 'painted', color: '#1a3a2a' },
      { text: 'PEPSI-COLA', sub: 'HITS THE SPOT', style: 'neon', color: '#c02030' },
      { text: 'TRANSIT LINES', sub: 'RIDE THE TROLLEY', style: 'poster', color: '#2a4a7a' },
    ],
  },

  '1985': {
    id: '1985',
    year: 1985,
    title: 'NEON DECADE',
    tagline: 'Chrome, synth & midnight magenta',
    palette: {
      skyZenith: '#12081a',
      skyHorizon: '#ff4080',
      fog: '#402040',
      fogDensity: 0.014,
      sunColor: '#ff8090',
      sunIntensity: 0.85,
      ambient: '#2a1830',
      ambientIntensity: 0.55,
      hemiSky: '#604080',
      hemiGround: '#281820',
      bloom: 0.85,
      grade: { contrast: 1.10, saturation: 1.25, warmth: -0.05, vignette: 0.28, grain: 0.02 },
    },
    buildings: {
      heightMul: 1.0,
      maxFloors: 14,
      styles: ['brick', 'glass', 'midcentury', 'glass'],
      windowLit: 0.88,
      windowWarmth: 0.25,
      soot: 0.2,
      cornice: false,
      fireEscapes: true,
      antennas: 0.4,
    },
    street: {
      surface: 'asphalt-cracked',
      sidewalk: 'concrete-stained',
      markings: 'worn',
      lampStyle: 'sodium',
    },
    traffic: {
      density: 0.85,
      speed: 0.9,
      types: ['sedan80s', 'muscle80s', 'van80s', 'taxi80s'],
    },
    people: {
      density: 0.9,
      outfits: ['power', 'punk', 'aerobics', 'denim', 'suit80s'],
      pace: 1.0,
    },
    shops: [
      { name: 'VIDEO ZONE', kind: 'video', color: '#e02080' },
      { name: 'SYNTH CITY', kind: 'records', color: '#8020e0' },
      { name: 'ARCADE WORLD', kind: 'arcade', color: '#20c0e0' },
      { name: 'POWER SUITS', kind: 'fashion', color: '#e0a020' },
      { name: 'NEON BURGER', kind: 'fastfood', color: '#e04020' },
      { name: 'WALKMAN MART', kind: 'electronics', color: '#2080c0' },
      { name: 'CLUB MERIDIAN', kind: 'club', color: '#c020a0' },
      { name: '24HR GYM', kind: 'gym', color: '#e0e020' },
    ],
    ads: [
      { text: 'WALKMAN', sub: 'MUSIC TO GO', style: 'neon', color: '#e02080' },
      { text: 'MTV', sub: 'I WANT MY MTV', style: 'billboard', color: '#c01040' },
      { text: 'APPLE', sub: 'THINK DIFFERENT', style: 'backlit', color: '#202020' },
      { text: 'PEPSI', sub: 'THE CHOICE', style: 'neon', color: '#2040c0' },
    ],
  },

  '2025': {
    id: '2025',
    year: 2025,
    title: 'NOW',
    tagline: 'E-bikes, glass, green roofs',
    palette: {
      skyZenith: '#0e1828',
      skyHorizon: '#5a7090',
      fog: '#3a4858',
      fogDensity: 0.008,
      sunColor: '#ffe8d0',
      sunIntensity: 1.1,
      ambient: '#283038',
      ambientIntensity: 0.6,
      hemiSky: '#5a7088',
      hemiGround: '#2a3228',
      bloom: 0.55,
      grade: { contrast: 1.02, saturation: 1.00, warmth: 0.00, vignette: 0.15, grain: 0.01 },
    },
    buildings: {
      heightMul: 1.35,
      maxFloors: 24,
      styles: ['glass', 'glass', 'midcentury', 'stone'],
      windowLit: 0.92,
      windowWarmth: 0.2,
      soot: 0.04,
      cornice: false,
      fireEscapes: false,
      antennas: 0.1,
    },
    street: {
      surface: 'asphalt-marked',
      sidewalk: 'wide-paver',
      markings: 'bike',
      lampStyle: 'led',
    },
    traffic: {
      density: 0.75,
      speed: 0.7,
      types: ['evSedan', 'suv25', 'scooter', 'delivery', 'bike'],
    },
    people: {
      density: 1.0,
      outfits: ['athleisure', 'tech', 'delivery', 'casual25'],
      pace: 1.1,
    },
    shops: [
      { name: 'SWEETGREEN', kind: 'salad', color: '#2d5a27' },
      { name: 'APPLE STORE', kind: 'electronics', color: '#1d1d1f' },
      { name: 'EQUINOX', kind: 'gym', color: '#111111' },
      { name: 'BLUE BOTTLE', kind: 'coffee', color: '#0066cc' },
      { name: 'WARBY PARKER', kind: 'fashion', color: '#00a0e0' },
      { name: 'CVS', kind: 'pharmacy', color: '#cc0000' },
      { name: 'WEEWORK', kind: 'cowork', color: '#ff3b30' },
      { name: 'TARGET', kind: 'retail', color: '#cc0000' },
    ],
    ads: [
      { text: 'TESLA', sub: 'FULL SELF-DRIVE', style: 'oled', color: '#cc0000' },
      { text: 'OPENAI', sub: 'CHAT WITH US', style: 'oled', color: '#10a37f' },
      { text: 'SPOTIFY', sub: 'LISTEN NOW', style: 'led', color: '#1db954' },
      { text: 'UBER', sub: 'GO ANYWHERE', style: 'led', color: '#000000' },
    ],
  },

  '2055': {
    id: '2055',
    year: 2055,
    title: 'HORIZON',
    tagline: 'Biolume, pods & living glass',
    palette: {
      skyZenith: '#061018',
      skyHorizon: '#20c8a0',
      fog: '#0a2830',
      fogDensity: 0.007,
      sunColor: '#a0ffe0',
      sunIntensity: 0.95,
      ambient: '#0a2030',
      ambientIntensity: 0.65,
      hemiSky: '#208060',
      hemiGround: '#0a2018',
      bloom: 0.95,
      grade: { contrast: 1.06, saturation: 1.15, warmth: -0.12, vignette: 0.18, grain: 0.01 },
    },
    buildings: {
      heightMul: 1.6,
      maxFloors: 32,
      styles: ['glass', 'glass', 'stone', 'brick'],
      windowLit: 0.95,
      windowWarmth: -0.15,
      soot: 0,
      cornice: false,
      fireEscapes: false,
      antennas: 0,
    },
    street: {
      surface: 'smart',
      sidewalk: 'living',
      markings: 'glow',
      lampStyle: 'biolume',
    },
    traffic: {
      density: 0.55,
      speed: 1.1,
      types: ['pod', 'pod', 'droneTaxi', 'maglev', 'cycle'],
    },
    people: {
      density: 0.65,
      outfits: ['softsuit', 'techwear', 'casual25', 'tech'],
      pace: 0.9,
    },
    shops: [
      { name: 'NEXUS HABITAT', kind: 'habitat', color: '#20c8a0' },
      { name: 'MYCO CAFÉ', kind: 'cafe', color: '#80e040' },
      { name: 'AETHER LAB', kind: 'lab', color: '#40a0e0' },
      { name: 'VERT FARM MART', kind: 'grocer', color: '#40c060' },
      { name: 'HOLO ATELIER', kind: 'fashion', color: '#c040e0' },
      { name: 'PULSE CLINIC', kind: 'clinic', color: '#e0e0ff' },
      { name: 'DRONE HUB', kind: 'transit', color: '#2080c0' },
      { name: 'LUMEN THEATRE', kind: 'theatre', color: '#e080ff' },
    ],
    ads: [
      { text: 'ORBIT LINK', sub: 'EARTH ↔ LUNA', style: 'holo', color: '#40ffe0' },
      { text: 'NEXUS', sub: 'LIVE CONNECTED', style: 'holo', color: '#80ffc0' },
      { text: 'AURORA', sub: 'CLEAN AIR CREDIT', style: 'biolume', color: '#20e080' },
      { text: 'SYNTHMEAT', sub: 'GROWN NOT RAISED', style: 'oled', color: '#e04080' },
    ],
  },
};

export const ERA_IDS: EraId[] = ['1945', '1985', '2025', '2055'];

export const ERA_NAMES: Record<EraId, string> = {
  '1945': '1945 战后',
  '1985': '1985 霓虹',
  '2025': '2025 现代',
  '2055': '2055 未来',
};

export function getEra(eraId: EraId): EraDef {
  return ERAS[eraId] || ERAS['2025'];
}
