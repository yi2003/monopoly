// ============================================================
// CityBuilder — Procedural city around the Monopoly board
// Buildings use opus5-style canvas-generated facade textures
// ============================================================

import * as THREE from 'three';
import type { ThemeId, EraId } from '@monopoly/shared';
import {
  ALL_PROPERTIES,
  TILE_W, TILE_D,
  INNER_BOARD_HALF, OUTER_BOARD_HALF, OUTER_RING_OFFSET,
  getGroundTilePosition, isCornerIndex,
  ERAS, getEra,
} from '@monopoly/shared';
import type { EraDef } from '@monopoly/shared';
import { Rng } from '../util/rng';
import { boxGeo, boxMesh, cylMesh } from '../util/geom';
import {
  brickFacade, glassFacade, midcenturyFacade, bioFacade,
  storefrontTex,
} from '../textures/surfaces';
import type { ShopDef } from '../textures/surfaces';
import { billboardTex } from '../textures/signs';
import type { AdDef } from '../textures/signs';

// ---- Configuration ----

const SIDEWALK_WIDTH = 2.0;
const ROAD_WIDTH = 4.0;
const BUILDING_SETBACK = 0.5;
const OUTER_BUILDING_COVERAGE = 0.85;
const INNER_BUILDING_COVERAGE = 0.60;
const LAMP_POST_SPACING_OUTER = 2;
const LAMP_POST_SPACING_INNER = 3;

// ---- Shared Materials (reused across buildings) ----

function mat(color: string, rough = 0.8, metal = 0.1): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  (m as any).userData = { shared: true };
  return m;
}

const SHARED = {
  dark: mat('#1a1814', 0.9, 0.2),
  metal: mat('#6a7078', 0.4, 0.85),
  chrome: mat('#c8d0d8', 0.2, 1.0),
  awning: mat('#8a2030', 0.85, 0.15),
  roof: mat('#2a2824', 0.95, 0.1),
  neonGlass: (() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#ffffff', emissive: '#ff40a0', emissiveIntensity: 1.2,
      roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85,
    });
    (m as any).userData = { shared: true };
    return m;
  })(),
  green: mat('#2a5a30', 0.9, 0.05),
};

// ---- Facade style per color group ----

type FacadeStyle = 'brick' | 'glass' | 'midcentury' | 'stone';

interface BuildingStyle {
  floors: [number, number];
  facadeStyle: FacadeStyle;
  bodyColor: string;      // fallback for non-facade sides
  accentColor: string;
  hasCornice: boolean;
  hasFireEscape: boolean;
  hasWaterTower: boolean;
  hasAcUnits: boolean;
  hasAntenna: boolean;
  hasGreenRoof: boolean;
  heightMul: number;
}

const STYLES: Record<string, BuildingStyle> = {
  brown:        { floors: [2, 3], facadeStyle: 'brick', bodyColor: '#8B4513', accentColor: '#5D4037', hasCornice: true,  hasFireEscape: true,  hasWaterTower: true,  hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.55 },
  lightblue:    { floors: [2, 4], facadeStyle: 'midcentury', bodyColor: '#87CEEB', accentColor: '#4682B4', hasCornice: false, hasFireEscape: true,  hasWaterTower: false, hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.7 },
  teal:         { floors: [3, 5], facadeStyle: 'stone', bodyColor: '#008080', accentColor: '#006060', hasCornice: true,  hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: false, hasGreenRoof: false, heightMul: 0.85 },
  pink:         { floors: [3, 4], facadeStyle: 'brick', bodyColor: '#FF69B4', accentColor: '#C04080', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.75 },
  orange:       { floors: [3, 6], facadeStyle: 'stone', bodyColor: '#FF8C00', accentColor: '#CC7000', hasCornice: true,  hasFireEscape: true,  hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: false, heightMul: 0.9 },
  red:          { floors: [4, 6], facadeStyle: 'stone', bodyColor: '#DC143C', accentColor: '#A01028', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: false, heightMul: 0.95 },
  yellow:       { floors: [4, 7], facadeStyle: 'stone', bodyColor: '#FFD700', accentColor: '#C8A800', hasCornice: true,  hasFireEscape: true,  hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: false, heightMul: 1.0 },
  plum:         { floors: [5, 8], facadeStyle: 'glass', bodyColor: '#8B008B', accentColor: '#6A006A', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: false, heightMul: 1.1 },
  green:        { floors: [5, 9], facadeStyle: 'glass', bodyColor: '#228B22', accentColor: '#186018', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: true,  heightMul: 1.2 },
  blue:         { floors: [6, 10], facadeStyle: 'glass', bodyColor: '#0000CD', accentColor: '#00008B', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: true,  heightMul: 1.35 },
  // Outer ring groups
  outer_amber:  { floors: [2, 3], facadeStyle: 'brick', bodyColor: '#FFBF00', accentColor: '#CC9900', hasCornice: true,  hasFireEscape: true,  hasWaterTower: true,  hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.55 },
  outer_mint:   { floors: [2, 4], facadeStyle: 'midcentury', bodyColor: '#98FB98', accentColor: '#66CC66', hasCornice: false, hasFireEscape: true,  hasWaterTower: false, hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.7 },
  outer_coral:  { floors: [3, 5], facadeStyle: 'stone', bodyColor: '#FF7F50', accentColor: '#CC6640', hasCornice: true,  hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: false, hasGreenRoof: false, heightMul: 0.85 },
  outer_lime:   { floors: [3, 4], facadeStyle: 'brick', bodyColor: '#32CD32', accentColor: '#28A428', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.75 },
  outer_violet: { floors: [3, 6], facadeStyle: 'stone', bodyColor: '#8A2BE2', accentColor: '#6A20B0', hasCornice: true,  hasFireEscape: true,  hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: false, heightMul: 0.9 },
  outer_rose:   { floors: [4, 6], facadeStyle: 'stone', bodyColor: '#FF1493', accentColor: '#CC1078', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: false, heightMul: 0.95 },
  outer_sky:    { floors: [4, 7], facadeStyle: 'stone', bodyColor: '#00BFFF', accentColor: '#0099CC', hasCornice: true,  hasFireEscape: true,  hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: false, heightMul: 1.0 },
  outer_ruby:   { floors: [5, 8], facadeStyle: 'glass', bodyColor: '#E0115F', accentColor: '#B00E4A', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: false, heightMul: 1.1 },
  outer_copper: { floors: [2, 4], facadeStyle: 'brick', bodyColor: '#B87333', accentColor: '#8B5522', hasCornice: true,  hasFireEscape: true,  hasWaterTower: true,  hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.6 },
  outer_navy:   { floors: [6, 10], facadeStyle: 'glass', bodyColor: '#000080', accentColor: '#000060', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: true,  hasAntenna: true,  hasGreenRoof: true,  heightMul: 1.35 },
  railway:      { floors: [2, 3], facadeStyle: 'stone', bodyColor: '#B8860B', accentColor: '#8B6508', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.55 },
  utility:      { floors: [2, 3], facadeStyle: 'stone', bodyColor: '#708090', accentColor: '#556070', hasCornice: false, hasFireEscape: false, hasWaterTower: false, hasAcUnits: false, hasAntenna: false, hasGreenRoof: false, heightMul: 0.55 },
};

function getStyle(groupName: string): BuildingStyle {
  return STYLES[groupName] || STYLES.brown;
}

// ---- Building type system ----

type BuildingType =
  | 'residential' | 'shop' | 'cafe' | 'restaurant'
  | 'hospital' | 'bank' | 'office' | 'hotel'
  | 'convenience' | 'pharmacy';

interface BuildingTypeConfig {
  type: BuildingType;
  label: string;
  weight: number;
  widthMul: number;
  depthMul: number;
  floorsAdd: number;
  groundFloorHeight: number;
  accentColor: string;
  shopStyle: string; // for storefrontTex
}

const BUILDING_TYPES: BuildingTypeConfig[] = [
  { type: 'residential',  label: 'Residence',  weight: 30, widthMul: 1.0, depthMul: 1.0, floorsAdd: 0, groundFloorHeight: 0.9, accentColor: '#795548', shopStyle: 'residential' },
  { type: 'shop',         label: 'Shop',       weight: 18, widthMul: 1.3, depthMul: 0.9, floorsAdd: 0, groundFloorHeight: 1.1, accentColor: '#FF9800', shopStyle: 'retail' },
  { type: 'cafe',         label: 'Café',       weight: 9,  widthMul: 1.1, depthMul: 1.0, floorsAdd: 0, groundFloorHeight: 0.9, accentColor: '#8D6E63', shopStyle: 'cafe' },
  { type: 'restaurant',   label: 'Restaurant', weight: 10, widthMul: 1.4, depthMul: 1.1, floorsAdd: 0, groundFloorHeight: 1.0, accentColor: '#E53935', shopStyle: 'fastfood' },
  { type: 'hospital',     label: 'Hospital',   weight: 5,  widthMul: 1.8, depthMul: 1.3, floorsAdd: 1, groundFloorHeight: 1.2, accentColor: '#FFFFFF', shopStyle: 'clinic' },
  { type: 'bank',         label: 'Bank',       weight: 6,  widthMul: 1.3, depthMul: 1.2, floorsAdd: 1, groundFloorHeight: 1.3, accentColor: '#D4AF37', shopStyle: 'bank' },
  { type: 'office',       label: 'Office',     weight: 10, widthMul: 1.2, depthMul: 1.0, floorsAdd: 3, groundFloorHeight: 1.2, accentColor: '#607D8B', shopStyle: 'office' },
  { type: 'hotel',        label: 'Hotel',      weight: 5,  widthMul: 1.3, depthMul: 1.1, floorsAdd: 4, groundFloorHeight: 1.2, accentColor: '#FFD700', shopStyle: 'hotel' },
  { type: 'convenience',  label: 'Store',      weight: 4,  widthMul: 0.9, depthMul: 0.8, floorsAdd: 0, groundFloorHeight: 1.0, accentColor: '#4CAF50', shopStyle: 'grocer' },
  { type: 'pharmacy',     label: 'Pharmacy',   weight: 3,  widthMul: 1.0, depthMul: 0.9, floorsAdd: 0, groundFloorHeight: 1.0, accentColor: '#4CAF50', shopStyle: 'pharmacy' },
];

// ---- Utility ----

function seededRandom(seed: number): number {
  let s = Math.sin(seed) * 43758.5453;
  return s - Math.floor(s);
}

function propJitter(base: number, seed: number, amount: number): number {
  return base + (seededRandom(seed) - 0.5) * amount;
}

function getTileBoardPos(index: number): { x: number; z: number; rotation: number; isCorner: boolean } {
  const pos = getGroundTilePosition(index);
  return { x: pos.x, z: pos.z, rotation: pos.rotation, isCorner: isCornerIndex(index) };
}

// ---- GLB model mapping ----

export const TREE_MODEL_URL = '/models/street-tree-01.glb';

export const PRELOAD_MODEL_URLS = [
  TREE_MODEL_URL,
] as const;

// ---- Shop names by type for storefronts ----

const SHOP_NAMES: Record<BuildingType, { name: string; kind: string; color: string }[]> = {
  residential: [],
  shop: [
    { name: 'CORNER MART', kind: 'retail', color: '#e07020' },
    { name: 'CITY BAZAAR', kind: 'retail', color: '#2080c0' },
    { name: 'MERIDIAN GOODS', kind: 'retail', color: '#c04040' },
  ],
  cafe: [
    { name: 'DAILY BREW', kind: 'cafe', color: '#8D6E63' },
    { name: 'SUNRISE CAFÉ', kind: 'cafe', color: '#6D4C41' },
    { name: 'THE COFFEE SPOT', kind: 'cafe', color: '#5D4037' },
  ],
  restaurant: [
    { name: 'GOLDEN WOK', kind: 'fastfood', color: '#c02020' },
    { name: 'BELLA TABLE', kind: 'diner', color: '#c04030' },
    { name: 'SMOKE & GRILL', kind: 'diner', color: '#8a3a2a' },
  ],
  hospital: [
    { name: 'CITY CLINIC', kind: 'clinic', color: '#e0e0e0' },
    { name: 'MED CENTER', kind: 'clinic', color: '#f5f5f5' },
  ],
  bank: [
    { name: 'FIRST MERIDIAN', kind: 'bank', color: '#3a4a6a' },
    { name: 'CROWN TRUST', kind: 'bank', color: '#2a3a5a' },
  ],
  office: [
    { name: 'TOWER PLAZA', kind: 'office', color: '#4a6070' },
    { name: 'METRO CENTER', kind: 'office', color: '#506878' },
  ],
  hotel: [
    { name: 'GRAND HOTEL', kind: 'hotel', color: '#FFD700' },
    { name: 'ROYAL INN', kind: 'hotel', color: '#DAA520' },
  ],
  convenience: [
    { name: 'QUICK STOP', kind: 'grocer', color: '#4CAF50' },
    { name: '24/7 MART', kind: 'grocer', color: '#388E3C' },
  ],
  pharmacy: [
    { name: 'MEDI CARE', kind: 'pharmacy', color: '#4CAF50' },
    { name: 'HEALTH PLUS', kind: 'pharmacy', color: '#2E7D32' },
  ],
};

export class CityBuilder {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private buildingGroup: THREE.Group;
  private roadGroup: THREE.Group;
  private propGroup: THREE.Group;
  private theme: ThemeId = 'classic';
  private era: EraId = '2025';
  private hasBuilt = false;

  nightGlowMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'city';
    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'buildings';
    this.roadGroup = new THREE.Group();
    this.roadGroup.name = 'roads';
    this.propGroup = new THREE.Group();
    this.propGroup.name = 'props';
    this.group.add(this.buildingGroup);
    this.group.add(this.roadGroup);
    this.group.add(this.propGroup);
    this.scene.add(this.group);
  }

  setTheme(theme: ThemeId): void {
    this.theme = theme;
  }

  setEra(era: EraId): boolean {
    if (this.era === era) return false;
    this.era = era;
    if (this.hasBuilt) {
      this.clearAndRebuild();
      return true; // caller needs to re-register colliders & glow
    }
    return false;
  }

  private getEraDef(): EraDef {
    return getEra(this.era);
  }

  build(): void {
    this.buildRingRoadSurfaces();
    this.buildInnerRing();
    this.buildOuterRing();
    this.buildStreetProps();
    this.buildInnerCityRoads();
    this.buildLandmarks();
    this.buildSkyline();
    this.hasBuilt = true;
  }

  /** Dispose all building/road/prop children and re-build with current era */
  private clearAndRebuild(): void {
    const groups = [this.buildingGroup, this.roadGroup, this.propGroup];
    for (const g of groups) {
      g.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      while (g.children.length > 0) {
        g.remove(g.children[0]);
      }
    }
    this.nightGlowMaterials = [];
    this.build();
  }

  // ---- Ring Road Surfaces ----

  private buildRingRoadSurfaces(): void {
    // Era-responsive road & sidewalk colours
    const roadColors: Record<string, string> = {
      '1945': '#2a2a26', '1985': '#2e2e2c', '2025': '#383838', '2055': '#1a2828',
    };
    const sidewalkColors: Record<string, string> = {
      '1945': '#7a7468', '1985': '#8a7e78', '2025': '#c0b8b0', '2055': '#4a6058',
    };
    const roadColor = roadColors[this.era] || '#3D3D3D';
    const sidewalkColor = sidewalkColors[this.era] || '#C8C0B8';

    const roadMat = new THREE.MeshStandardMaterial({ color: roadColor, roughness: 0.95 });
    const laneMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.5, emissive: '#FFD700', emissiveIntensity: 0.1 });
    const curbMat = new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.7 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: sidewalkColor, roughness: 0.85 });

    const roadCenterOffset = TILE_D / 2 + SIDEWALK_WIDTH + BUILDING_SETBACK + 2.0 + ROAD_WIDTH / 2;
    const roadExtend = 50;
    const rings = [{ half: OUTER_BOARD_HALF }];

    for (const ring of rings) {
      const roadZ = ring.half + roadCenterOffset;
      const length = ring.half * 2 + roadExtend;

      const roadConfigs: { x: number; z: number; w: number; d: number }[] = [
        { x: 0, z: -roadZ, w: length, d: ROAD_WIDTH },
        { x: 0, z: roadZ, w: length, d: ROAD_WIDTH },
        { x: roadZ, z: 0, w: ROAD_WIDTH, d: length },
        { x: -roadZ, z: 0, w: ROAD_WIDTH, d: length },
      ];

      for (const rc of roadConfigs) {
        const roadGeo = new THREE.BoxGeometry(rc.w, 0.06, rc.d);
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.set(rc.x, 0.02, rc.z);
        road.receiveShadow = true;
        this.roadGroup.add(road);

        const isHorizontal = rc.w > rc.d;
        const dashLen = 1.5, dashGap = 1.5;
        const dashCount = Math.floor((isHorizontal ? rc.w : rc.d) / (dashLen + dashGap));
        for (let d = 0; d < dashCount; d++) {
          const dashPos = -((isHorizontal ? rc.w : rc.d) / 2) + dashLen / 2 + d * (dashLen + dashGap);
          const dashGeo = new THREE.BoxGeometry(
            isHorizontal ? dashLen : 0.12, 0.07, isHorizontal ? 0.12 : dashLen,
          );
          const dash = new THREE.Mesh(dashGeo, laneMat);
          dash.position.set(isHorizontal ? dashPos : rc.x, 0.04, isHorizontal ? rc.z : dashPos);
          this.roadGroup.add(dash);
        }

        for (const sideSign of [1]) {
          const curbGeo = new THREE.BoxGeometry(
            isHorizontal ? rc.w : 0.3, 0.14, isHorizontal ? 0.3 : rc.d,
          );
          const curb = new THREE.Mesh(curbGeo, curbMat);
          curb.position.set(
            isHorizontal ? 0 : rc.x + sideSign * (ROAD_WIDTH / 2 + 0.3),
            0.06,
            isHorizontal ? rc.z + sideSign * (ROAD_WIDTH / 2 + 0.3) : 0,
          );
          curb.receiveShadow = true;
          this.roadGroup.add(curb);

          const swGeo = new THREE.BoxGeometry(
            isHorizontal ? rc.w : SIDEWALK_WIDTH, 0.08, isHorizontal ? SIDEWALK_WIDTH : rc.d,
          );
          const sw = new THREE.Mesh(swGeo, sidewalkMat);
          sw.position.set(
            isHorizontal ? 0 : rc.x + sideSign * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2 + 0.3),
            0.03,
            isHorizontal ? rc.z + sideSign * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2 + 0.3) : 0,
          );
          sw.receiveShadow = true;
          this.roadGroup.add(sw);
        }
      }
    }
  }

  // ---- Inner Ring Buildings ----

  private buildInnerRing(): void {
    for (let i = 0; i < 48; i++) {
      const { x, z, rotation, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;

      const propDef = ALL_PROPERTIES.find(p => p.index === i);
      const groupName = propDef?.group || 'railway';

      const seed = i * 137 + (this.theme === 'shanghai' ? 1000 : this.theme === 'tokyo' ? 2000 : 0);
      if (seededRandom(seed) > OUTER_BUILDING_COVERAGE) continue;

      const style = getStyle(groupName);
      const buildingType = this.selectBuildingType(seed);
      this.createBuilding(x, z, rotation, style, seed, 'outer', buildingType);
    }
  }

  // ---- Outer Ring Buildings ----

  private selectBuildingType(seed: number): BuildingTypeConfig {
    const totalWeight = BUILDING_TYPES.reduce((sum, t) => sum + t.weight, 0);
    let r = seededRandom(seed + 55) * totalWeight;
    for (const bt of BUILDING_TYPES) {
      r -= bt.weight;
      if (r <= 0) return bt;
    }
    return BUILDING_TYPES[0];
  }

  private selectOuterRingType(seed: number): BuildingTypeConfig {
    const commercialWeights: { type: BuildingType; weight: number }[] = [
      { type: 'shop', weight: 25 }, { type: 'cafe', weight: 15 },
      { type: 'restaurant', weight: 18 }, { type: 'convenience', weight: 8 },
      { type: 'pharmacy', weight: 5 }, { type: 'hotel', weight: 6 },
      { type: 'hospital', weight: 4 }, { type: 'bank', weight: 5 },
      { type: 'office', weight: 6 }, { type: 'residential', weight: 8 },
    ];
    const totalWeight = commercialWeights.reduce((sum, t) => sum + t.weight, 0);
    let r = seededRandom(seed + 55) * totalWeight;
    for (const cw of commercialWeights) {
      r -= cw.weight;
      if (r <= 0) return BUILDING_TYPES.find(bt => bt.type === cw.type) || BUILDING_TYPES[1];
    }
    return BUILDING_TYPES[1];
  }

  private buildOuterRing(): void {
    const OUTER_COMMERCIAL_COVERAGE = 0.90;

    for (let i = 0; i < 48; i++) {
      const tileIndex = OUTER_RING_OFFSET + i;
      const pos = getGroundTilePosition(tileIndex);
      if (isCornerIndex(tileIndex)) continue;

      const propDef = ALL_PROPERTIES.find(p => p.index === tileIndex);
      const groupName = propDef?.group || 'railway';

      const seed = tileIndex * 137 + (this.theme === 'shanghai' ? 1000 : this.theme === 'tokyo' ? 2000 : 0);
      if (seededRandom(seed) > OUTER_COMMERCIAL_COVERAGE) continue;

      const style = getStyle(groupName);
      const outerType = this.selectOuterRingType(seed);
      this.createBuilding(pos.x, pos.z, pos.rotation, style, seed, 'outer', outerType);
    }
  }

  // ====================================================================
  // Building Creation — Opus5-style with facade textures & rich details
  // ====================================================================

  private createBuilding(
    tileX: number, tileZ: number, tileRot: number,
    style: BuildingStyle, seed: number, position: 'outer' | 'inner',
    btConfig: BuildingTypeConfig,
    extraOffset = 0,
  ): void {
    const group = new THREE.Group();

    const sign = position === 'outer' ? -1 : 1;
    const depthOffset = sign * (TILE_D / 2 + SIDEWALK_WIDTH + BUILDING_SETBACK + extraOffset);
    const sidewalkOffset = sign * (TILE_D / 2 + SIDEWALK_WIDTH / 2 + extraOffset);

    const dirX = Math.sin(tileRot);
    const dirZ = Math.cos(tileRot);

    const rng = new Rng(`${seed}:bldg`);
    const eraDef = this.getEraDef();
    const eb = eraDef.buildings;

    // --- Dimensions (scaled for monopoly board proportions, era-modulated) ---
    const baseFloors = Math.max(2,
      style.floors[0] + Math.floor(seededRandom(seed + 10) * (style.floors[1] - style.floors[0] + 1)) + btConfig.floorsAdd
    );
    const floors = Math.max(2, Math.min(
      eb.maxFloors,
      Math.round(baseFloors * eb.heightMul)
    ));
    const floorH = 0.9;
    const storeH = btConfig.groundFloorHeight > 1.0 ? 1.2 : 0.9;
    const H = storeH + (floors - 1) * floorH;
    const W = propJitter(2.4, seed + 20, 0.6) * btConfig.widthMul * 0.96;
    const D = propJitter(2.0, seed + 30, 0.6) * btConfig.depthMul * 0.92;

    // --- Make facade texture ---
    // Use era style weights to influence facade selection
    const styleWeight = eb.styles;
    const facadeStyle = this.pickEraFacadeStyle(style.facadeStyle, styleWeight, rng);
    const eraOverrides: EraFacadeOverrides = { soot: eb.soot, windowLit: eb.windowLit, windowWarmth: eb.windowWarmth };
    const facadeMap = makeFacade(facadeStyle, `${seed}-f`, floors, rng, this.era, false, eraOverrides);
    const sideMap = makeFacade(facadeStyle, `${seed}-s`, floors, rng, this.era, true, eraOverrides);

    // --- Main mass: multi-material box ---
    const geo = boxGeo(W, H, D);
    const mats: THREE.Material[] = [
      sideMat(sideMap),  // +x
      sideMat(sideMap),  // -x
      SHARED.roof,       // +y
      SHARED.dark,       // -y
      frontMat(facadeMap), // +z front
      sideMat(sideMap),  // -z
    ];
    const body = new THREE.Mesh(geo, mats);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // --- Storefront overlay ---
    const centerX = tileX + dirX * depthOffset;
    const centerZ = tileZ + dirZ * depthOffset;
    const isShop = btConfig.type !== 'residential';

    if (isShop) {
      // Prefer era shops, fall back to hardcoded shop names
      const eraShops = eraDef.shops;
      const shopDef: ShopDef = (eraShops && eraShops.length > 0)
        ? eraShops[seed % eraShops.length]
        : { name: btConfig.label.toUpperCase(), kind: btConfig.shopStyle, color: btConfig.accentColor };
      const sfTex = storefrontTex(shopDef, this.era, `${seed}`);
      const sfMat = new THREE.MeshStandardMaterial({
        map: sfTex, roughness: 0.55, metalness: 0.15,
        emissive: new THREE.Color(shopDef.color), emissiveIntensity: 0.08,
      });
      const sfMesh = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, storeH * 0.92), sfMat);
      sfMesh.position.set(0, storeH * 0.5, D / 2 + 0.03);
      group.add(sfMesh);

      // Awning (scaled for monopoly-size buildings)
      const awningDepth = 0.4;
      const awn = boxMesh(W * 0.9, 0.08, awningDepth, SHARED.awning, 0, storeH * 0.92, D / 2 + awningDepth * 0.5);
      group.add(awn);
      // Awning supports
      for (const sx of [-W * 0.35, W * 0.35]) {
        group.add(boxMesh(0.04, storeH * 0.35, 0.04, SHARED.metal, sx, storeH * 0.75, D / 2 + awningDepth));
      }

      this.nightGlowMaterials.push(sfMat);
    }

    // --- Cornice (era-aware) ---
    if (eb.cornice && (facadeStyle === 'brick' || facadeStyle === 'stone')) {
      group.add(boxMesh(W * 1.06, 0.15, D * 1.06, SHARED.dark, 0, H, 0));
      group.add(boxMesh(W * 1.02, 0.08, D * 1.02, mat('#c8b8a0', 0.7, 0.05), 0, H + 0.12, 0));
    }

    // --- Roof details (era-aware) ---
    addRoofDetails(group, W, D, H, style, rng, this.nightGlowMaterials, eb);

    // --- Fire escape (era-aware) ---
    if (eb.fireEscapes && rng.bool(0.7) && facadeStyle !== 'glass') {
      addFireEscape(group, W, D, H, storeH, floorH, floors, rng);
    }

    // --- Green roof (more common in future eras) ---
    const eraYear = eraDef.year;
    const greenRoofChance = eraYear >= 2025 ? 0.55 : (eraYear >= 1985 ? 0.15 : 0.05);
    if (rng.bool(greenRoofChance)) {
      const greenery = boxMesh(W * 0.85, 0.15 + rng.f(0, 0.3), D * 0.85, SHARED.green, 0, H, 0);
      group.add(greenery);
    }

    // --- Neon strip accent on glass buildings (era-aware) ---
    if (facadeStyle === 'glass' && floors >= (eraYear >= 1985 ? 7 : 10)) {
      const neonColors = eraYear >= 2025
        ? ['#ff40a0', '#40e0ff', '#e0ff40', '#40ffc0']
        : eraYear >= 1985
          ? ['#ff40a0', '#40e0ff', '#e0ff40', '#e02080']
          : ['#ffaa40', '#ff6040'];
      const col = rng.pick(neonColors);
      const neonIntensity = eraYear === 1985 ? 2.2 : (eraYear >= 2025 ? 1.6 : 1.0);
      const neon = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.95, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: neonIntensity, roughness: 0.3 }),
      );
      neon.position.set(0, storeH + 0.05, D / 2 + 0.03);
      group.add(neon);
      this.nightGlowMaterials.push(neon.material as THREE.MeshStandardMaterial);
    }

    // --- Billboard / rooftop ad (era-aware) ---
    if (rng.bool(0.15) && eraDef.ads.length > 0) {
      const ad = eraDef.ads[seed % eraDef.ads.length];
      this.addBuildingAd(group, W, D, H, storeH, ad);
    }

    // --- Orient so local +Z faces the street ---
    group.rotation.y = tileRot;

    // 2055: floating buildings with hover pads
    const isFuturistic = eraDef.id === '2055';
    const floatHeight = isFuturistic ? 4 + rng.f(0, 18) * (floors / eb.maxFloors) : 0;
    group.position.set(centerX, floatHeight, centerZ);

    if (isFuturistic && floatHeight > 0) {
      // Hover glow disc beneath building
      const glowGeo = new THREE.CylinderGeometry(W * 0.45, W * 0.55, 0.15, 16);
      const glowMat = new THREE.MeshStandardMaterial({
        color: '#40ffe0', emissive: '#40ffe0', emissiveIntensity: 0.5,
        roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.3,
      });
      const glowDisc = new THREE.Mesh(glowGeo, glowMat);
      glowDisc.position.y = -H / 2;
      group.add(glowDisc);
      this.nightGlowMaterials.push(glowMat);

      // Support pillars for larger buildings
      if (floors > 10) {
        const pillarMat = new THREE.MeshStandardMaterial({
          color: '#80ffe0', emissive: '#40ffe0', emissiveIntensity: 0.15,
          roughness: 0.3, metalness: 0.8,
        });
        for (const [cx, cz] of [[-W * 0.3, -D * 0.3], [W * 0.3, -D * 0.3], [-W * 0.3, D * 0.3], [W * 0.3, D * 0.3]]) {
          const pillarGeo = new THREE.CylinderGeometry(0.15, 0.2, floatHeight, 8);
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(cx, -H / 2 - floatHeight / 2, cz);
          group.add(pillar);
        }
        this.nightGlowMaterials.push(pillarMat);
      }
    }

    // --- Sidewalk slab (always on ground, not part of floating group) ---
    if (!isFuturistic) {
      const swGeo = new THREE.BoxGeometry(W + 0.4, 0.1, SIDEWALK_WIDTH);
      const swM = new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.8 });
      const sw = new THREE.Mesh(swGeo, swM);
      sw.position.set(
        tileX + dirX * sidewalkOffset,
        0.05,
        tileZ + dirZ * sidewalkOffset,
      );
      sw.rotation.y = tileRot;
      sw.receiveShadow = true;
      group.add(sw);
    }

    this.buildingGroup.add(group);
  }

  // ---- Street Props ----

  private buildStreetProps(): void {
    this.buildLampPosts();
    this.buildFireHydrants();
    this.buildMailboxes();
    this.buildTrashCans();
    this.buildBenches();
    this.buildTramRails();
    this.buildEraTrees();
  }

  private buildLampPosts(): void {
    for (let i = 0; i < 48; i++) {
      if (i % LAMP_POST_SPACING_OUTER !== 0) continue;
      const { x, z, rotation, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      this.createLampPost(x, z, rotation, 'outer');
    }
    for (let i = 0; i < 48; i++) {
      if (i % LAMP_POST_SPACING_INNER !== 0) continue;
      const { x, z, rotation, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      this.createLampPost(x, z, rotation, 'inner');
    }
  }

  private createLampPost(tileX: number, tileZ: number, tileRot: number, side: string): void {
    const group = new THREE.Group();
    const offset = side === 'outer' ? -(TILE_D / 2 + SIDEWALK_WIDTH) : (TILE_D / 2 + SIDEWALK_WIDTH);
    const eraDef = this.getEraDef();
    const lampStyle = eraDef.street.lampStyle;
    const eraId = eraDef.id;

    // ── Opus5-style lamp geometries per style ──
    if (lampStyle === 'gas-electric') {
      // Ornate post with glass housing
      const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 2.5, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: '#3a3a30', roughness: 0.3, metalness: 0.7 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 1.25;
      pole.castShadow = true;
      group.add(pole);

      const baseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.3, 8);
      group.add(new THREE.Mesh(baseGeo, poleMat)).position.y = 0.15;

      const capGeo = new THREE.BoxGeometry(0.6, 0.12, 0.6);
      group.add(new THREE.Mesh(capGeo, poleMat)).position.y = 2.55;

      const glassMat = new THREE.MeshStandardMaterial({
        color: '#ffe0a0', emissive: '#ffe0a0', emissiveIntensity: 1.8,
        transparent: true, opacity: 0.9, roughness: 0.2,
      });
      const glassGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.5, 8);
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = 2.8;
      group.add(glass);
      this.nightGlowMaterials.push(glassMat);
    } else if (lampStyle === 'cobra' || lampStyle === 'sodium') {
      // Curved arm reaching over street
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.1, 2.8, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: '#5a6a70', roughness: 0.3, metalness: 0.7 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 1.4;
      pole.castShadow = true;
      group.add(pole);

      const armGeo = new THREE.BoxGeometry(1.8, 0.06, 0.06);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(0.8, 2.8, 0);
      group.add(arm);

      const col = lampStyle === 'sodium' ? '#ffaa40' : '#e8f0ff';
      const headMat = new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: 1.5, roughness: 0.3,
      });
      const headGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(1.6, 2.7, 0);
      group.add(head);
      this.nightGlowMaterials.push(headMat);
    } else if (lampStyle === 'biolume') {
      // Thin bio-pole with glowing orb
      const poleGeo = new THREE.CylinderGeometry(0.05, 0.08, 3.5, 8);
      const bioMat = new THREE.MeshStandardMaterial({
        color: '#20c8a0', emissive: '#20c8a0', emissiveIntensity: 0.6, roughness: 0.4,
      });
      const pole = new THREE.Mesh(poleGeo, bioMat);
      pole.position.y = 1.75;
      group.add(pole);
      this.nightGlowMaterials.push(bioMat);

      const orbGeo = new THREE.SphereGeometry(0.3, 12, 12);
      const orbMat = new THREE.MeshStandardMaterial({
        color: '#80ffe0', emissive: '#40ffe0', emissiveIntensity: 2.2,
        transparent: true, opacity: 0.85, roughness: 0.2,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 3.7;
      group.add(orb);
      this.nightGlowMaterials.push(orbMat);
    } else {
      // modern / led
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 2.8, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: '#3a4048', roughness: 0.3, metalness: 0.7 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 1.4;
      pole.castShadow = true;
      group.add(pole);

      const armGeo = new THREE.BoxGeometry(1.5, 0.05, 0.05);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(0.6, 2.8, 0);
      group.add(arm);

      const headMat = new THREE.MeshStandardMaterial({
        color: '#e8f4ff', emissive: '#c0e0ff', emissiveIntensity: 1.8, roughness: 0.3,
      });
      const headGeo = new THREE.BoxGeometry(0.6, 0.1, 0.25);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(1.3, 2.75, 0);
      group.add(head);
      this.nightGlowMaterials.push(headMat);
    }

    const dirX = Math.sin(tileRot);
    const dirZ = Math.cos(tileRot);
    group.position.set(tileX + dirX * offset, 0, tileZ + dirZ * offset);
    this.propGroup.add(group);
  }

  private buildFireHydrants(): void {
    const eraId = this.era;
    for (let i = 0; i < 48; i++) {
      if (i % 5 !== 1) continue;
      const { x, z, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      const hydrantColor = eraId === '2055' ? '#20c8a0' : '#c03020';
      const hydrantGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.5, 8);
      const hydrantMat = new THREE.MeshStandardMaterial({ color: hydrantColor, roughness: 0.4 });
      const hydrant = new THREE.Mesh(hydrantGeo, hydrantMat);
      hydrant.position.set(x, 0.25, z + (i % 2 === 0 ? TILE_D / 2 + SIDEWALK_WIDTH - 0.5 : -(TILE_D / 2 + SIDEWALK_WIDTH - 0.5)));
      hydrant.castShadow = true;
      this.propGroup.add(hydrant);
    }
  }

  private buildMailboxes(): void {
    const eraId = this.era;
    for (let i = 0; i < 48; i++) {
      if (i % 7 !== 3) continue;
      const { x, z, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      const boxGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
      const boxColor = eraId === '2055' ? '#1a5a40' : '#1a3a7a';
      const boxMat = new THREE.MeshStandardMaterial({ color: boxColor, roughness: 0.4 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(x + (i % 2 === 0 ? TILE_D / 2 + SIDEWALK_WIDTH - 0.8 : -(TILE_D / 2 + SIDEWALK_WIDTH - 0.8)), 0.3, z);
      box.castShadow = true;
      this.propGroup.add(box);
    }
  }

  private buildTrashCans(): void {
    const eraId = this.era;
    for (let i = 0; i < 48; i++) {
      if (i % 6 !== 2) continue;
      const { x, z, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      const px = x + (i % 3 === 0 ? TILE_D / 2 + SIDEWALK_WIDTH - 0.5 : -(TILE_D / 2 + SIDEWALK_WIDTH - 0.5));
      let can: THREE.Mesh;
      if (eraId === '2055') {
        can = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.6, 8),
          new THREE.MeshStandardMaterial({ color: '#20c8a0', roughness: 0.4 }));
      } else if (eraId === '1945') {
        can = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.6, 8),
          new THREE.MeshStandardMaterial({ color: '#2a2a28', roughness: 0.5, metalness: 0.7 }));
      } else {
        can = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.7, 8),
          new THREE.MeshStandardMaterial({ color: '#4CAF50', roughness: 0.5 }));
      }
      can.position.set(px, 0.35, z + 0.5);
      can.castShadow = true;
      this.propGroup.add(can);
    }
  }

  private buildBenches(): void {
    const eraId = this.era;
    for (let i = 0; i < 48; i++) {
      if (i % 8 !== 4) continue;
      const { x, z, rotation, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      const grp = new THREE.Group();
      const seatGeo = new THREE.BoxGeometry(1.2, 0.1, 0.4);
      const seatColor = eraId === '2055' ? '#20c8a0' : eraId === '1945' ? '#5a3a20' : '#795548';
      const seatMat = new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.5 });
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.y = 0.3;
      seat.castShadow = true;
      grp.add(seat);
      for (let l = -1; l <= 1; l += 2) {
        const legGeo = new THREE.BoxGeometry(0.08, 0.3, 0.35);
        const legColor = eraId === '2055' ? '#1a4030' : '#5D4037';
        const legMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.5 });
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(l * 0.5, 0.15, 0);
        leg.castShadow = true;
        grp.add(leg);
      }
      const dirX = Math.sin(rotation), dirZ = Math.cos(rotation);
      grp.position.set(x + dirX * (TILE_D / 2 + SIDEWALK_WIDTH - 0.8), 0, z + dirZ * (TILE_D / 2 + SIDEWALK_WIDTH - 0.8));
      grp.rotation.y = rotation;
      this.propGroup.add(grp);
    }
  }

  // ---- Inner City Roads ----

  private buildInnerCityRoads(): void {
    const roadMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.9 });
    const laneMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.5, emissive: '#FFD700', emissiveIntensity: 0.1 });
    const curbMat = new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.7 });

    const innerCenter = 0;
    const roadLen = 60;

    const nsGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.05, roadLen);
    const ns = new THREE.Mesh(nsGeo, roadMat);
    ns.position.set(innerCenter, 0.02, innerCenter);
    ns.receiveShadow = true;
    this.roadGroup.add(ns);

    const ewGeo = new THREE.BoxGeometry(roadLen, 0.05, ROAD_WIDTH);
    const ew = new THREE.Mesh(ewGeo, roadMat);
    ew.position.set(innerCenter, 0.02, innerCenter);
    ew.receiveShadow = true;
    this.roadGroup.add(ew);

    for (let s = -30; s <= 30; s += 1.5) {
      const dashGeo = new THREE.BoxGeometry(0.12, 0.06, 1.0);
      const dash = new THREE.Mesh(dashGeo, laneMat);
      dash.position.set(innerCenter, 0.03, s);
      this.roadGroup.add(dash);
    }

    for (const [dx, _dz] of [[ROAD_WIDTH / 2 + 0.5, 0], [-(ROAD_WIDTH / 2 + 0.5), 0]]) {
      const curbGeo = new THREE.BoxGeometry(0.3, 0.12, roadLen);
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(innerCenter + dx, 0.06, innerCenter);
      this.roadGroup.add(curb);
    }

    for (let s = -28; s <= 28; s += 3.5) {
      for (const [dx, dz] of [[ROAD_WIDTH / 2 + 1.0, s], [-(ROAD_WIDTH / 2 + 1.0), s], [s, ROAD_WIDTH / 2 + 1.0], [s, -(ROAD_WIDTH / 2 + 1.0)]]) {
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.3, metalness: 0.5 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(innerCenter + dx, 0.9, innerCenter + dz);
        pole.castShadow = true;
        this.propGroup.add(pole);

        const bulbGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const bulbMat = new THREE.MeshStandardMaterial({
          color: '#FFF9C4', roughness: 0.2, emissive: '#FFF9C4', emissiveIntensity: 0.5,
        });
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(innerCenter + dx, 1.85, innerCenter + dz);
        this.propGroup.add(bulb);
        this.nightGlowMaterials.push(bulbMat);
      }
    }
  }

  // ---- Theme Landmarks ----

  private buildLandmarks(): void {
    this.applyThemeSigns();
    switch (this.theme) {
      case 'shanghai': this.buildShanghaiLandmarks(); break;
      case 'tokyo': this.buildTokyoLandmarks(); break;
      default: this.buildClassicLandmarks(); break;
    }
  }

  private applyThemeSigns(): void {
    const roads = this.theme === 'shanghai'
      ? ['南京路', '淮海路', '外滩', '陆家嘴', '城隍庙', '静安寺', '新天地', '田子坊']
      : this.theme === 'tokyo'
        ? ['渋谷', '新宿', '銀座', '秋葉原', '浅草', '六本木', '原宿', 'お台場']
        : ['Main St', 'Park Ave', 'Broadway', 'Fifth Ave', 'Wall St', 'Oak Ln', 'Elm St', 'Market St'];

    let nameIdx = 0;
    this.buildingGroup.traverse((child) => {
      if (child.name && child.name.startsWith('storefront-')) {
        const roadName = roads[nameIdx % roads.length];
        nameIdx++;
        if (child instanceof THREE.Mesh) this.addRoadSign(child, roadName);
      }
    });
  }

  private addRoadSign(storefrontMesh: THREE.Mesh, roadName: string): void {
    const parent = storefrontMesh.parent;
    if (!parent) return;
    const signGroup = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.3, metalness: 0.5 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.4;
    signGroup.add(pole);
    const plateGeo = new THREE.BoxGeometry(1.2, 0.3, 0.08);
    const plateMat = new THREE.MeshStandardMaterial({
      color: this.theme === 'tokyo' ? '#FFFFFF' : '#2E7D32',
      roughness: 0.3, emissive: this.theme === 'tokyo' ? '#FFFFFF' : '#2E7D32', emissiveIntensity: 0.3,
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.85;
    plate.name = `roadsign-${roadName}`;
    signGroup.add(plate);
    this.nightGlowMaterials.push(plateMat);
    signGroup.position.copy(storefrontMesh.position);
    signGroup.position.y += 0.5;
    parent.add(signGroup);
  }

  private buildShanghaiLandmarks(): void {
    const cx = 0, cz = 0;
    const group = new THREE.Group();
    group.name = 'oriental_pearl';

    const pearlMat = new THREE.MeshStandardMaterial({ color: '#C0C0C0', roughness: 0.2, metalness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#FF6B8A', roughness: 0.2, metalness: 0.3, emissive: '#FF6B8A', emissiveIntensity: 0.3 });
    const legMat = new THREE.MeshStandardMaterial({ color: '#B0B0B0', roughness: 0.3, metalness: 0.8 });

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const legLen = 5;
      const legGeo = new THREE.CylinderGeometry(0.3, 0.5, legLen, 8);
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(Math.cos(angle) * 2.5, legLen / 2, Math.sin(angle) * 2.5);
      leg.rotation.z = (Math.cos(angle) > 0 ? 1 : -1) * 0.35;
      leg.rotation.x = (Math.sin(angle) > 0 ? 1 : -1) * 0.35;
      leg.castShadow = true;
      group.add(leg);
    }

    const shaftGeo = new THREE.CylinderGeometry(0.3, 0.5, 16, 12);
    const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshStandardMaterial({ color: '#D0D0D0', roughness: 0.2, metalness: 0.8 }));
    shaft.position.y = 8;
    shaft.castShadow = true;
    group.add(shaft);

    const sphereHeights = [3.5, 7.5, 12];
    const sphereRadii = [1.2, 2.0, 1.5];
    for (let i = 0; i < 3; i++) {
      const pearlGeo = new THREE.SphereGeometry(sphereRadii[i], 24, 18);
      const pearl = new THREE.Mesh(pearlGeo, pearlMat);
      pearl.position.y = sphereHeights[i];
      pearl.castShadow = true;
      group.add(pearl);
      const ringGeo = new THREE.TorusGeometry(sphereRadii[i] + 0.15, 0.12, 12, 24);
      const ring = new THREE.Mesh(ringGeo, glassMat);
      ring.position.y = sphereHeights[i];
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    const antGeo = new THREE.CylinderGeometry(0.08, 0.15, 3, 8);
    const ant = new THREE.Mesh(antGeo, new THREE.MeshStandardMaterial({ color: '#E0E0E0', roughness: 0.2, metalness: 0.9 }));
    ant.position.y = 15;
    group.add(ant);

    const topGeo = new THREE.SphereGeometry(0.35, 16, 12);
    const topSphere = new THREE.Mesh(topGeo, pearlMat);
    topSphere.position.y = 16.5;
    group.add(topSphere);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);
    this.nightGlowMaterials.push(glassMat);
    this.addShikumenBuildings();
  }

  private addShikumenBuildings(): void {
    const positions = [
      { x: -10, z: -10 }, { x: 10, z: -10 }, { x: -10, z: 10 }, { x: 10, z: 10 },
    ];
    for (const pos of positions) {
      const grp = new THREE.Group();
      const brickMat = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.6 });
      const bodyGeo = new THREE.BoxGeometry(3, 4, 2.5);
      const body = new THREE.Mesh(bodyGeo, brickMat);
      body.position.y = 2;
      body.castShadow = true;
      body.receiveShadow = true;
      grp.add(body);
      const roofGeo = new THREE.BoxGeometry(3.5, 0.3, 3);
      const roofMat = new THREE.MeshStandardMaterial({ color: '#4A3728', roughness: 0.4 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 4.15;
      roof.castShadow = true;
      grp.add(roof);
      for (let s = -1; s <= 1; s += 2) {
        const eaveGeo = new THREE.BoxGeometry(3.8, 0.1, 0.6);
        const eave = new THREE.Mesh(eaveGeo, roofMat);
        eave.position.set(0, 4.05, s * 1.6);
        grp.add(eave);
      }
      const gateGeo = new THREE.BoxGeometry(1.2, 2.2, 0.3);
      const gateMat = new THREE.MeshStandardMaterial({ color: '#757575', roughness: 0.4, metalness: 0.3 });
      const gate = new THREE.Mesh(gateGeo, gateMat);
      gate.position.set(0, 1.1, 1.4);
      grp.add(gate);
      grp.position.set(pos.x, 0, pos.z);
      this.buildingGroup.add(grp);
    }
  }

  private buildTokyoLandmarks(): void {
    const eraId = this.era;
    const cx = 0, cz = 0;

    if (eraId === '2055') {
      // Futuristic floating crystal pagoda
      this.buildFuturisticTokyo(cx, cz);
      return;
    }

    const group = new THREE.Group();
    group.name = 'tokyo_tower';

    const redMat = new THREE.MeshStandardMaterial({ color: '#E65100', roughness: 0.35, metalness: 0.15, emissive: '#E65100', emissiveIntensity: 0.2 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#FAFAFA', roughness: 0.35, metalness: 0.1 });
    const baseMat = new THREE.MeshStandardMaterial({ color: '#E0E0E0', roughness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#87CEEB', roughness: 0.1, metalness: 0.2, emissive: '#87CEEB', emissiveIntensity: 0.35,
    });

    const legH = 28; // total leg height
    const baseW = 3.5; // half-width at base
    const topW = 0.6; // half-width at top

    // ── Base building (FootTown) ──
    addBox(group, 9, 2, 9, baseMat, 0, 1, 0);
    // Entrance arches on all 4 sides
    for (let side = 0; side < 4; side++) {
      const angle = (side * Math.PI) / 2;
      addBox(group, side % 2 === 0 ? 4 : 0.4, 1.2, side % 2 === 0 ? 0.4 : 4, whiteMat,
        Math.sin(angle) * 2.2, 0.6, Math.cos(angle) * 2.2);
    }
    // Base roof
    addBox(group, 10, 0.3, 10, whiteMat, 0, 2.2, 0);

    // ── 4 main legs with taper ──
    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const segments = 14;
        for (let s = 0; s < segments; s++) {
          const t = s / (segments - 1);
          const y = 2.3 + t * legH;
          const segH = legH / segments + 0.15;
          const rx = lx * (baseW + (topW - baseW) * t);
          const rz = lz * (baseW + (topW - baseW) * t);
          const thk = 0.35 * (1 - t * 0.5);
          const segColor = s % 2 === 0 ? redMat : whiteMat;
          addBox(group, thk, segH, thk, segColor, rx, y + segH / 2, rz);
        }
      }
    }

    // ── Center shaft visible through lattice ──
    const shaftGeo = new THREE.CylinderGeometry(0.25, 0.5, legH, 8);
    const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.5, metalness: 0.3 }));
    shaft.position.y = 2.3 + legH / 2;
    group.add(shaft);

    // ── Lattice: horizontal braces + diagonal crosses between each floor ──
    const FLOORS = 12;
    for (let f = 0; f < FLOORS; f++) {
      const tBot = f / FLOORS;
      const tTop = (f + 1) / FLOORS;
      const yBot = 2.3 + tBot * legH;
      const yTop = 2.3 + tTop * legH;
      const yMid = (yBot + yTop) / 2;
      const wBot = baseW + (topW - baseW) * tBot;
      const wTop = baseW + (topW - baseW) * tTop;

      // Horizontal braces at top and bottom of each bay
      for (const y of [yBot, yTop]) {
        const t = (y - 2.3) / legH;
        const hw = baseW + (topW - baseW) * t;
        for (const [x1, z1, x2, z2] of [[-hw, -hw, hw, -hw], [hw, -hw, hw, hw], [hw, hw, -hw, hw], [-hw, hw, -hw, -hw]]) {
          const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
          const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
          const ang = Math.atan2(x2 - x1, z2 - z1);
          const geo = new THREE.BoxGeometry(len, 0.12, 0.1);
          const mesh = new THREE.Mesh(geo, f % 2 === 0 ? redMat : whiteMat);
          mesh.position.set(mx, y, mz);
          mesh.rotation.y = ang;
          group.add(mesh);
        }
      }

      // Diagonal X-braces in each bay on all 4 faces
      for (const [cx1, cz1, cx2, cz2] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
        const xBot1 = cx1 * wBot, zBot1 = cz1 * wBot;
        const xBot2 = cx2 * wBot, zBot2 = cz2 * wBot;
        const xTop1 = cx1 * wTop, zTop1 = cz1 * wTop;
        const xTop2 = cx2 * wTop, zTop2 = cz2 * wTop;

        // Diagonal 1: bottom-left to top-right
        const d1 = Math.sqrt((xTop2 - xBot1) ** 2 + (zTop2 - zBot1) ** 2 + (yTop - yBot) ** 2);
        if (d1 > 0.5) {
          const md1x = (xBot1 + xTop2) / 2, md1z = (zBot1 + zTop2) / 2;
          const d1h = Math.sqrt((xTop2 - xBot1) ** 2 + (zTop2 - zBot1) ** 2);
          const d1angY = Math.atan2(xTop2 - xBot1, zTop2 - zBot1);
          const d1angX = -Math.atan2(yTop - yBot, d1h);
          const d1Geo = new THREE.CylinderGeometry(0.05, 0.05, d1, 6);
          const d1Mesh = new THREE.Mesh(d1Geo, redMat);
          d1Mesh.position.set(md1x, yMid, md1z);
          d1Mesh.rotation.z = Math.PI / 2;
          d1Mesh.rotation.y = d1angY;
          d1Mesh.rotateX(d1angX);
          group.add(d1Mesh);
        }
        // Diagonal 2: bottom-right to top-left
        const d2 = Math.sqrt((xTop1 - xBot2) ** 2 + (zTop1 - zBot2) ** 2 + (yTop - yBot) ** 2);
        if (d2 > 0.5) {
          const md2x = (xBot2 + xTop1) / 2, md2z = (zBot2 + zTop1) / 2;
          const d2h = Math.sqrt((xTop1 - xBot2) ** 2 + (zTop1 - zBot2) ** 2);
          const d2angY = Math.atan2(xTop1 - xBot2, zTop1 - zBot2);
          const d2angX = -Math.atan2(yTop - yBot, d2h);
          const d2Geo = new THREE.CylinderGeometry(0.05, 0.05, d2, 6);
          const d2Mesh = new THREE.Mesh(d2Geo, redMat);
          d2Mesh.position.set(md2x, yMid, md2z);
          d2Mesh.rotation.z = Math.PI / 2;
          d2Mesh.rotation.y = d2angY;
          d2Mesh.rotateX(d2angX);
          group.add(d2Mesh);
        }
      }
    }

    // ── Main observation deck (lower, larger) ──
    const mainDeckY = 2.3 + legH * 0.45;
    const mainDeckW = 3.8;
    addBox(group, mainDeckW * 2, 0.8, mainDeckW * 2, whiteMat, 0, mainDeckY, 0);
    // Glass curtain wall
    for (let side = 0; side < 4; side++) {
      const angle = (side * Math.PI) / 2;
      const gx = Math.sin(angle) * (mainDeckW - 0.2);
      const gz = Math.cos(angle) * (mainDeckW - 0.2);
      const glassGeo = side % 2 === 0
        ? new THREE.BoxGeometry(mainDeckW * 2 - 0.4, 0.6, 0.05)
        : new THREE.BoxGeometry(0.05, 0.6, mainDeckW * 2 - 0.4);
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(gx, mainDeckY, gz);
      group.add(glass);
    }

    // ── Upper observation deck (smaller) ──
    const upperDeckY = 2.3 + legH * 0.78;
    const upperDeckW = 2.0;
    addBox(group, upperDeckW * 2, 0.5, upperDeckW * 2, redMat, 0, upperDeckY, 0);
    for (let side = 0; side < 4; side++) {
      const angle = (side * Math.PI) / 2;
      const gx = Math.sin(angle) * (upperDeckW - 0.1);
      const gz = Math.cos(angle) * (upperDeckW - 0.1);
      const glassGeo = side % 2 === 0
        ? new THREE.BoxGeometry(upperDeckW * 2 - 0.2, 0.4, 0.04)
        : new THREE.BoxGeometry(0.04, 0.4, upperDeckW * 2 - 0.2);
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(gx, upperDeckY, gz);
      group.add(glass);
    }

    // ── Antenna spire ──
    const antY = 2.3 + legH;
    const antMat = new THREE.MeshStandardMaterial({ color: '#E0E0E0', roughness: 0.2, metalness: 0.9 });
    // Tapered antenna in sections
    const antSections = [
      { rBot: 0.2, rTop: 0.12, h: 2 },
      { rBot: 0.12, rTop: 0.06, h: 2 },
      { rBot: 0.06, rTop: 0.03, h: 2 },
      { rBot: 0.03, rTop: 0.015, h: 2 },
    ];
    let ay = antY;
    for (const sec of antSections) {
      const geo = new THREE.CylinderGeometry(sec.rTop, sec.rBot, sec.h, 8);
      const mesh = new THREE.Mesh(geo, antMat);
      mesh.position.y = ay + sec.h / 2;
      group.add(mesh);
      ay += sec.h;
    }

    // Top beacon
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, emissive: '#FFD700', emissiveIntensity: 0.8 }),
    );
    beacon.position.y = ay + 0.2;
    group.add(beacon);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);
    this.nightGlowMaterials.push(redMat, glassMat, beacon.material as THREE.MeshStandardMaterial);

    this.addPagoda(6, -8);
    this.addPagoda(-6, 8);
    this.addToriiGate(0, 10);
  }

  /** 2055: Futuristic floating tower for Tokyo theme */
  private buildFuturisticTokyo(cx: number, cz: number): void {
    const group = new THREE.Group();
    group.name = 'futuristic_tokyo';

    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#c0ffe0', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7,
    });
    const bioMat = new THREE.MeshStandardMaterial({
      color: '#40ffe0', emissive: '#40ffe0', emissiveIntensity: 0.6, roughness: 0.2,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#80ffc0', emissive: '#80ffc0', emissiveIntensity: 0.8, roughness: 0.1, transparent: true, opacity: 0.5,
    });

    const floatH = 2;

    // Central crystal pillar
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.8, 20, 12);
    const pillar = new THREE.Mesh(pillarGeo, crystalMat);
    pillar.position.y = floatH + 10;
    group.add(pillar);

    // 4 floating crystal shards orbiting
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const r = 2.5;
      const shardGeo = new THREE.CylinderGeometry(0.05, 0.2, 8 + i * 2, 8);
      const shard = new THREE.Mesh(shardGeo, crystalMat);
      shard.position.set(Math.cos(angle) * r, floatH + 5 + i * 2, Math.sin(angle) * r);
      shard.rotation.z = 0.25;
      shard.rotation.x = 0.15;
      group.add(shard);
    }

    // Biolume rings at different heights
    for (let r = 0; r < 5; r++) {
      const ringGeo = new THREE.TorusGeometry(2 + r * 0.3, 0.06, 8, 24);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = floatH + 2 + r * 4;
      ring.rotation.x = Math.PI / 2 + r * 0.4;
      group.add(ring);
    }

    // Top glow orb
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), bioMat);
    orb.position.y = floatH + 21;
    group.add(orb);

    // Hover disc
    const discGeo = new THREE.CylinderGeometry(2.5, 3, 0.2, 24);
    const discMat = new THREE.MeshStandardMaterial({
      color: '#40ffe0', emissive: '#40ffe0', emissiveIntensity: 0.4, roughness: 0.3, transparent: true, opacity: 0.35,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.1;
    group.add(disc);

    this.nightGlowMaterials.push(bioMat, ringMat, discMat, orb.material as THREE.MeshStandardMaterial);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);

    // Futuristic pagodas
    this.addPagoda(6, -8);
    this.addPagoda(-6, 8);
    this.addToriiGate(0, 10);
  }

  private addPagoda(x: number, z: number): void {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#8D6E63', roughness: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#4A3728', roughness: 0.4 });

    const baseGeo = new THREE.BoxGeometry(2.5, 0.5, 2.5);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.5 }));
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    for (let t = 0; t < 3; t++) {
      const tierSize = 2 - t * 0.5;
      const y = 0.5 + t * 2;
      const bodyGeo = new THREE.BoxGeometry(tierSize, 1.5, tierSize);
      const body = new THREE.Mesh(bodyGeo, woodMat);
      body.position.y = y + 0.75;
      body.castShadow = true;
      group.add(body);
      const rfGeo = new THREE.BoxGeometry(tierSize + 1, 0.3, tierSize + 1);
      const roof = new THREE.Mesh(rfGeo, roofMat);
      roof.position.y = y + 1.65;
      roof.castShadow = true;
      group.add(roof);
      for (let c = 0; c < 4; c++) {
        const tipGeo = new THREE.BoxGeometry(0.15, 0.1, 0.5);
        const tip = new THREE.Mesh(tipGeo, roofMat);
        const cx = (c % 2 === 0 ? 1 : -1) * (tierSize / 2 + 0.4);
        const cz = (c < 2 ? 1 : -1) * (tierSize / 2 + 0.4);
        tip.position.set(cx, y + 1.8, cz);
        tip.rotation.y = c % 2 === 0 ? 0 : Math.PI / 2;
        group.add(tip);
      }
    }

    const spireGeo = new THREE.ConeGeometry(0.2, 1.2, 8);
    const spire = new THREE.Mesh(spireGeo, new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.9 }));
    spire.position.y = 7.1;
    group.add(spire);

    group.position.set(x, 0, z);
    this.buildingGroup.add(group);
  }

  private addToriiGate(x: number, z: number): void {
    const group = new THREE.Group();
    const redMat = new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.3, emissive: '#E53935', emissiveIntensity: 0.2 });

    for (let s = -1; s <= 1; s += 2) {
      const pillarGeo = new THREE.CylinderGeometry(0.25, 0.3, 5, 8);
      const pillar = new THREE.Mesh(pillarGeo, redMat);
      pillar.position.set(s * 2, 2.5, 0);
      pillar.castShadow = true;
      group.add(pillar);
    }

    const topBeamGeo = new THREE.BoxGeometry(5, 0.4, 0.7);
    const topBeam = new THREE.Mesh(topBeamGeo, redMat);
    topBeam.position.y = 5.2;
    topBeam.castShadow = true;
    group.add(topBeam);

    const midBeamGeo = new THREE.BoxGeometry(4.5, 0.25, 0.5);
    const midBeam = new THREE.Mesh(midBeamGeo, redMat);
    midBeam.position.y = 4.6;
    group.add(midBeam);

    const plateGeo = new THREE.BoxGeometry(0.6, 1.0, 0.08);
    const plateMat = new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.3, emissive: '#212121', emissiveIntensity: 0.1 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 4.3, 0);
    group.add(plate);

    group.position.set(x, 0, z);
    this.propGroup.add(group);
    this.nightGlowMaterials.push(redMat);
  }

  private buildClassicLandmarks(): void {
    const eraDef = this.getEraDef();
    const eraId = eraDef.id;
    const cx = 0, cz = 0;

    if (eraId === '2055') {
      this.buildCrystalSpire(cx, cz);
    } else if (eraId === '1985') {
      this.buildNeonTower(cx, cz);
    } else if (eraId === '2025') {
      this.buildGlassTower(cx, cz);
    } else {
      this.buildClockTower(cx, cz);
    }
  }

  /** 1945: Classic stone clock tower */
  private buildClockTower(cx: number, cz: number): void {
    const group = new THREE.Group();
    group.name = 'clock_tower';

    const stoneMat = new THREE.MeshStandardMaterial({ color: '#8a7868', roughness: 0.6 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#5a4840', roughness: 0.6 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#8a7a3a', roughness: 0.3, metalness: 0.7 });

    addBox(group, 5, 1, 5, darkStoneMat, 0, 0.5, 0);
    for (let s = 0; s < 3; s++) {
      addBox(group, 5.5 + s * 1, 0.2, 5.5 + s * 1, stoneMat, 0, 0.1 + s * 0.2, 0);
    }
    addBox(group, 2.5, 8, 2.5, stoneMat, 0, 5, 0);

    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        addCyl(group, 0.2, 0.25, 8, darkStoneMat, lx * 1, 5, lz * 1);
      }
    }

    addBox(group, 3.5, 2, 3.5, darkStoneMat, 0, 9.5, 0);
    addClockFaces(group, brassMat, '#ffffe0', 0.4);
    addCone(group, 0.6, 2.5, darkStoneMat, 0, 11.75, 0);
    addSphere(group, 0.2, brassMat, 0, 13.1, 0);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);
  }

  /** 1985: Dark neon clock tower */
  private buildNeonTower(cx: number, cz: number): void {
    const group = new THREE.Group();
    group.name = 'neon_tower';

    const darkMat = new THREE.MeshStandardMaterial({ color: '#15151a', roughness: 0.3, metalness: 0.6 });
    const neonPink = new THREE.MeshStandardMaterial({
      color: '#ff40a0', emissive: '#ff40a0', emissiveIntensity: 1.5, roughness: 0.2,
    });
    const neonCyan = new THREE.MeshStandardMaterial({
      color: '#40e0ff', emissive: '#40e0ff', emissiveIntensity: 1.5, roughness: 0.2,
    });

    addBox(group, 4, 1, 4, darkMat, 0, 0.5, 0);
    addBox(group, 2, 12, 2, darkMat, 0, 7, 0);

    // Neon strips up the tower
    for (let y = 1.5; y < 13; y += 2.5) {
      addBox(group, 2.3, 0.08, 0.08, neonPink, 1.1, y, 0);
      addBox(group, 2.3, 0.08, 0.08, neonPink, -1.1, y, 0);
      addBox(group, 0.08, 0.08, 2.3, neonCyan, 0, y, 1.1);
      addBox(group, 0.08, 0.08, 2.3, neonCyan, 0, y, -1.1);
    }

    // Glowing clock section
    addBox(group, 3.2, 1.8, 3.2, darkMat, 0, 13.2, 0);
    addClockFaces(group, neonPink, '#ffffff', 1.2);

    // Neon crown
    addCone(group, 0.5, 2.5, darkMat, 0, 15, 0);
    const topGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      neonCyan,
    );
    topGlow.position.set(0, 16.5, 0);
    group.add(topGlow);

    this.nightGlowMaterials.push(neonPink, neonCyan, topGlow.material as THREE.MeshStandardMaterial);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);
  }

  /** 2025: Modern glass/steel tower */
  private buildGlassTower(cx: number, cz: number): void {
    const group = new THREE.Group();
    group.name = 'glass_tower';

    const glassMat = new THREE.MeshStandardMaterial({
      color: '#5a8090', roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.8,
    });
    const steelMat = new THREE.MeshStandardMaterial({ color: '#d0d4d8', roughness: 0.25, metalness: 0.9 });
    const ledMat = new THREE.MeshStandardMaterial({
      color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.3,
    });

    addBox(group, 4.5, 0.5, 4.5, steelMat, 0, 0.25, 0);
    addBox(group, 3, 16, 3, glassMat, 0, 8.5, 0);

    // Steel frame edges
    for (const [ex, ez] of [[1.4, 1.4], [1.4, -1.4], [-1.4, 1.4], [-1.4, -1.4]]) {
      addCyl(group, 0.15, 0.15, 16, steelMat, ex, 8.5, ez);
    }

    // LED display band
    addBox(group, 3.2, 1.5, 3.2, steelMat, 0, 16.8, 0);
    addBox(group, 2.2, 1, 0.1, ledMat, 0, 16.8, 1.6);
    addBox(group, 2.2, 1, 0.1, ledMat, 0, 16.8, -1.6);
    addBox(group, 0.1, 1, 2.2, ledMat, 1.6, 16.8, 0);
    addBox(group, 0.1, 1, 2.2, ledMat, -1.6, 16.8, 0);

    // Green roof
    const greenRoof = new THREE.MeshStandardMaterial({ color: '#2a5a30', roughness: 0.8 });
    addBox(group, 3.2, 0.4, 3.2, greenRoof, 0, 18, 0);

    this.nightGlowMaterials.push(ledMat);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);
  }

  /** 2055: Floating crystal biolume spire */
  private buildCrystalSpire(cx: number, cz: number): void {
    const group = new THREE.Group();
    group.name = 'crystal_spire';

    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#c0ffe0', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7,
    });
    const bioMat = new THREE.MeshStandardMaterial({
      color: '#40ffe0', emissive: '#40ffe0', emissiveIntensity: 0.8, roughness: 0.2,
    });
    const bioRing = new THREE.MeshStandardMaterial({
      color: '#80ffc0', emissive: '#80ffc0', emissiveIntensity: 1.0, roughness: 0.1, transparent: true, opacity: 0.6,
    });

    const floatH = 3;

    // Crystal shards forming a spire
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const r = 0.8;
      const shardGeo = new THREE.CylinderGeometry(0.06, 0.35, 10 + i * 3, 8);
      const shard = new THREE.Mesh(shardGeo, crystalMat);
      shard.position.set(Math.cos(angle) * r, floatH + 5, Math.sin(angle) * r);
      shard.rotation.z = (Math.cos(angle) > 0 ? 1 : -1) * 0.15;
      shard.rotation.x = (Math.sin(angle) > 0 ? 1 : -1) * 0.15;
      group.add(shard);
    }

    // Central crystal
    const centerGeo = new THREE.CylinderGeometry(0.08, 0.5, 16, 12);
    const center = new THREE.Mesh(centerGeo, crystalMat);
    center.position.y = floatH + 8;
    group.add(center);

    // Biolume rings
    for (let r = 0; r < 4; r++) {
      const ringGeo = new THREE.TorusGeometry(1.5 + r * 0.4, 0.08, 8, 24);
      const ring = new THREE.Mesh(ringGeo, bioRing);
      ring.position.y = floatH + 3 + r * 3.5;
      ring.rotation.x = Math.PI / 2 + r * 0.3;
      group.add(ring);
    }

    // Top glow orb
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), bioMat);
    orb.position.y = floatH + 17;
    group.add(orb);

    // Hover glow disc
    const discGeo = new THREE.CylinderGeometry(1.8, 2.2, 0.2, 24);
    const discMat = new THREE.MeshStandardMaterial({
      color: '#40ffe0', emissive: '#40ffe0', emissiveIntensity: 0.6, roughness: 0.3, transparent: true, opacity: 0.4,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.1;
    group.add(disc);

    this.nightGlowMaterials.push(bioMat, bioRing, discMat, orb.material as THREE.MeshStandardMaterial);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);
  }

  // ---- Skyline (distant silhouette ring) ----

  private buildSkyline(): void {
    const eraDef = this.getEraDef();
    const skylineGroup = new THREE.Group();
    skylineGroup.name = 'skyline';
    const rng = new Rng(`skyline-${eraDef.id}`);

    const color = eraDef.id === '2055' ? '#0a2018'
      : eraDef.id === '1985' ? '#120818'
      : eraDef.id === '1945' ? '#1a1410'
      : '#101820';

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      metalness: 0.05,
      emissive: eraDef.id === '2055' ? '#104030' : eraDef.id === '1985' ? '#201028' : '#0a1018',
      emissiveIntensity: eraDef.id === '2055' || eraDef.id === '1985' ? 0.35 : 0.12,
    });

    const winColor = eraDef.buildings.windowWarmth > 0.4 ? '#ffc070' : '#a0c8ff';
    const radius = 120;
    const count = 36;
    const hMul = eraDef.buildings.heightMul;

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rng.j(0.05);
      const h = (8 + rng.f(0, 40) * hMul) * rng.f(0.7, 1.2);
      const w = rng.f(4, 12);
      const d = rng.f(4, 12);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(Math.cos(ang) * radius, h / 2, Math.sin(ang) * radius);
      mesh.rotation.y = -ang + Math.PI;
      skylineGroup.add(mesh);

      if (rng.bool(0.5)) {
        const fleck = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.65, h * 0.55),
          new THREE.MeshStandardMaterial({
            color: winColor,
            emissive: winColor,
            emissiveIntensity: 0.7 + rng.f(0, 0.5),
            roughness: 0.5,
            transparent: true,
            opacity: 0.4 + rng.f(0, 0.35),
            depthWrite: false,
          }),
        );
        const r = radius - d / 2 - 0.2;
        fleck.position.set(Math.cos(ang) * r, h * 0.5, Math.sin(ang) * r);
        fleck.lookAt(new THREE.Vector3(0, h * 0.5, 0));
        skylineGroup.add(fleck);
        this.nightGlowMaterials.push(fleck.material as THREE.MeshStandardMaterial);
      }
    }

    this.propGroup.add(skylineGroup);
  }

  // ---- Tram rails (1945 only) ----

  private buildTramRails(): void {
    if (this.era !== '1945') return;
    const railMat = new THREE.MeshStandardMaterial({ color: '#3a3a38', roughness: 0.4, metalness: 0.9 });
    const roadCenterOffset = TILE_D / 2 + SIDEWALK_WIDTH + BUILDING_SETBACK + 2.0 + ROAD_WIDTH / 2;
    const rings = [{ half: OUTER_BOARD_HALF }];

    for (const ring of rings) {
      const roadZ = ring.half + roadCenterOffset;
      for (const dz of [-ROAD_WIDTH * 0.2, ROAD_WIDTH * 0.2]) {
        // N/S rails
        const railGeo = new THREE.BoxGeometry(ring.half * 2 + 50, 0.03, 0.06);
        const rail1 = new THREE.Mesh(railGeo, railMat);
        rail1.position.set(0, 0.05, -roadZ + dz);
        this.roadGroup.add(rail1);
        const rail2 = new THREE.Mesh(railGeo, railMat);
        rail2.position.set(0, 0.05, roadZ + dz);
        this.roadGroup.add(rail2);
        // E/W rails
        const rail3 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, ring.half * 2 + 50), railMat);
        rail3.position.set(-roadZ + dz, 0.05, 0);
        this.roadGroup.add(rail3);
        const rail4 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, ring.half * 2 + 50), railMat);
        rail4.position.set(roadZ + dz, 0.05, 0);
        this.roadGroup.add(rail4);
      }
    }
  }

  // ---- Era trees ----

  private buildEraTrees(): void {
    const eraDef = this.getEraDef();
    const treeAge = eraDef.id === '1945' ? 'mature'
      : eraDef.id === '1985' ? 'sparse'
      : eraDef.id === '2055' ? 'canopy'
      : 'young';
    const rng = new Rng(`trees-${eraDef.id}`);

    for (let i = 0; i < 48; i++) {
      if (i % 8 !== 2) continue;
      const { x, z, rotation, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;

      const density = treeAge === 'sparse' ? 0.4 : 0.85;
      if (!rng.bool(density)) continue;

      const h = treeAge === 'canopy' ? rng.f(4, 6) : treeAge === 'mature' ? rng.f(3.5, 5) : rng.f(2.5, 3.5);
      const trunkR = treeAge === 'canopy' ? 0.14 : 0.08;
      const treeGroup = new THREE.Group();

      const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.7, trunkR, h * 0.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.85, metalness: 0.1 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = h * 0.25;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const canopyMat = treeAge === 'canopy'
        ? new THREE.MeshStandardMaterial({ color: '#2a8a50', emissive: '#104020', emissiveIntensity: 0.15, roughness: 0.9 })
        : new THREE.MeshStandardMaterial({ color: '#1a4a28', roughness: 0.9, metalness: 0.05 });

      const layers = treeAge === 'sparse' ? 1 : treeAge === 'canopy' ? 3 : 2;
      for (let l = 0; l < layers; l++) {
        const r = (treeAge === 'canopy' ? 1.4 : 1.0) * (1 - l * 0.15) * rng.f(0.85, 1.1);
        const foliage = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), canopyMat);
        foliage.position.set(rng.j(0.15), h * 0.35 + l * 0.5, rng.j(0.15));
        foliage.scale.y = 0.6;
        foliage.castShadow = true;
        treeGroup.add(foliage);
      }

      const dirX = Math.sin(rotation), dirZ = Math.cos(rotation);
      const sidewalkOffset = (i < 48 ? 1 : -1) * (TILE_D / 2 + SIDEWALK_WIDTH / 2);
      treeGroup.position.set(x + dirX * (TILE_D / 2 + SIDEWALK_WIDTH - 1.2), 0, z + dirZ * (TILE_D / 2 + SIDEWALK_WIDTH - 1.2));
      this.propGroup.add(treeGroup);
    }
  }

  // ---- Quality mode ----

  setQuality(quality: 'performance' | 'balanced'): void {
    const visible = quality === 'balanced';
    this.propGroup.visible = visible;
    this.buildingGroup.children.forEach((child, i) => {
      if (quality === 'performance') {
        child.visible = i % 3 !== 0;
      } else {
        child.visible = true;
      }
    });
  }

  // ---- Era helpers ----

  /** Pick a facade style blending property group style with era preferences */
  private pickEraFacadeStyle(baseStyle: FacadeStyle, eraStyles: string[], rng: Rng): FacadeStyle {
    // Map era style strings to FacadeStyle
    const styleMap: Record<string, FacadeStyle> = {
      brick: 'brick', limestone: 'stone', walkup: 'brick',
      midcentury: 'midcentury', curtain: 'glass', postmodern: 'stone',
      mirror: 'glass', glass: 'glass', 'brick-reno': 'brick',
      podium: 'stone', 'mass-timber': 'midcentury', 'reno-green': 'stone',
      bio: 'glass', crystal: 'glass', habitat: 'stone', spire: 'glass',
    };
    // Use era style weights: prefer era styles, fall back to property group style
    const viable = eraStyles
      .map(s => styleMap[s])
      .filter((s): s is FacadeStyle => s !== undefined);
    if (viable.length > 0 && rng.bool(0.6)) {
      return rng.pick(viable);
    }
    return baseStyle;
  }

  /** Add a billboard/ad sign on a building */
  private addBuildingAd(root: THREE.Group, W: number, _D: number, H: number, storeH: number, ad: { text: string; sub: string; style: string; color: string }): void {
    const adTex = billboardTex(ad as AdDef, this.era, `${ad.text}-${Math.random()}`);
    const billH = 1.2;
    const billW = 2.0;
    const adMat = new THREE.MeshStandardMaterial({
      map: adTex, roughness: 0.4, metalness: 0.1,
      emissive: new THREE.Color(ad.color), emissiveIntensity: 0.3,
    });
    const adMesh = new THREE.Mesh(new THREE.PlaneGeometry(billW, billH), adMat);
    // Place on the roof or upper wall
    const onRoof = Math.random() < 0.5;
    const yPos = onRoof ? H + billH / 2 : storeH + (H - storeH) * 0.75;
    adMesh.position.set(0, yPos, _D / 2 + 0.05);
    root.add(adMesh);
    this.nightGlowMaterials.push(adMat);

    // Support poles
    const poleMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.3, metalness: 0.5 });
    for (const sx of [-billW * 0.4, billW * 0.4]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, billH * 0.3, 6), poleMat);
      pole.position.set(sx, yPos - billH * 0.5, _D / 2 + 0.2);
      root.add(pole);
    }
  }

  // ---- Collision registration ----

  registerColliders(addBox: (center: THREE.Vector3, halfSize: THREE.Vector3) => void): void {
    this.buildingGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name === '' && child.geometry.type === 'BoxGeometry') {
        const bbox = new THREE.Box3().setFromObject(child);
        const center = bbox.getCenter(new THREE.Vector3());
        const halfSize = bbox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
        if (halfSize.x > 0.5 && halfSize.y > 0.5) {
          addBox(center, halfSize);
        }
      }
    });
  }

  dispose(): void {
    [this.buildingGroup, this.roadGroup, this.propGroup].forEach(g => {
      g.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      g.clear();
    });
    this.group.clear();
    this.scene.remove(this.group);
    this.nightGlowMaterials = [];
  }
}

// ====================================================================
// Standalone helper functions — opus5-style building detail generators
// ====================================================================

interface EraFacadeOverrides {
  soot: number;
  windowLit: number;
  windowWarmth: number;
}

function makeFacade(style: FacadeStyle, seed: string, floors: number, rng: Rng, eraId: string, isSide = false, eraOverrides?: EraFacadeOverrides): THREE.CanvasTexture {
  const bays = isSide ? rng.i(3, 5) : rng.i(4, 7);
  const soot = eraOverrides?.soot ?? 0.2;
  const windowLit = eraOverrides?.windowLit ?? (isSide ? 0.5 : 0.72);
  const windowWarmth = eraOverrides?.windowWarmth ?? 0.55;
  const opts = {
    floors: Math.max(2, floors - 1),
    bays,
    soot,
    lit: isSide ? windowLit * 0.7 : windowLit,
    warmth: windowWarmth,
    eraId,
  };
  if (style === 'glass') {
    return glassFacade(seed, { ...opts, tint: rng.pick(['#3a5a6a', '#2a4050', '#4a6070', '#1a3040']), lit: isSide ? 0.6 : 0.9, warmth: 0.15 });
  }
  if (style === 'midcentury') {
    return midcenturyFacade(seed, opts);
  }
  if (style === 'stone') {
    // stone/concrete — use brick with lighter color
    const stone = rng.pick(['#b0a8a0', '#a09890', '#c0b8b0', '#908880']);
    return brickFacade(seed, { ...opts, brick: stone, soot: 0.15 });
  }
  const brick = rng.pick(['#8a4a38', '#6a3a2a', '#9a5a48', '#7a6050', '#a08060']);
  return brickFacade(seed, { ...opts, brick });
}

function frontMat(map: THREE.CanvasTexture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map, roughness: 0.75, metalness: 0.08,
    emissive: new THREE.Color('#ffe8c0'), emissiveIntensity: 0.04,
  });
}

function sideMat(map: THREE.CanvasTexture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map, roughness: 0.82, metalness: 0.06,
    emissive: new THREE.Color('#ffe8c0'), emissiveIntensity: 0.03,
  });
}

function addRoofDetails(
  root: THREE.Group, W: number, D: number, H: number,
  style: BuildingStyle, rng: Rng, glowMats: THREE.MeshStandardMaterial[],
  eb?: { antennas: number; waterTower?: boolean; acUnits?: boolean },
): void {
  // Parapet / flat roof
  root.add(boxMesh(W * 0.98, 0.12, D * 0.98, SHARED.roof, 0, H, 0));

  const antennaChance = eb ? eb.antennas : 0.55;

  // Water tower (more common in older eras)
  const waterTowerChance = eb && eb.antennas !== undefined ? (antennaChance > 0.4 ? 0.4 : 0.05) : 0.4;
  if (style.hasWaterTower && rng.bool(waterTowerChance)) {
    const tw = cylMesh(0.4, 0.4, 0.8, mat('#6a5040', 0.7, 0.2), rng.j(W * 0.2), H + 0.12, rng.j(D * 0.2), 10);
    root.add(tw);
    root.add(cylMesh(0.05, 0.05, 1.0, SHARED.metal, tw.position.x, H + 0.12, tw.position.z - 0.4, 6));
  }

  // HVAC units — more common in modern eras
  const acChance = eb && eb.antennas !== undefined ? (antennaChance < 0.3 ? 0.7 : 0.4) : 0.5;
  if (rng.bool(acChance)) {
    const n = rng.i(1, 3);
    for (let i = 0; i < n; i++) {
      root.add(boxMesh(rng.f(0.4, 0.8), rng.f(0.3, 0.6), rng.f(0.4, 0.7), SHARED.metal,
        rng.j(W * 0.3), H + 0.12, rng.j(D * 0.3)));
    }
  }

  // TV antenna — era-controlled probability
  if (rng.bool(antennaChance)) {
    const ax = rng.j(W * 0.25), az = rng.j(D * 0.25);
    root.add(boxMesh(0.03, 1.2, 0.03, SHARED.metal, ax, H + 0.12, az));
    root.add(boxMesh(0.8, 0.03, 0.03, SHARED.metal, ax, H + 1.1, az));
    root.add(boxMesh(0.03, 0.03, 0.5, SHARED.metal, ax, H + 0.9, az));
  }

  // Rooftop sign for hotels — scaled down
  if (style.bodyColor === '#FFD700' && style.facadeStyle === 'glass') {
    const signGeo = new THREE.BoxGeometry(W * 0.5, 0.25, 0.08);
    const signMat = new THREE.MeshStandardMaterial({
      color: '#FFD700', roughness: 0.3, emissive: '#FFD700', emissiveIntensity: 0.6,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.y = H + 0.2;
    sign.name = 'hotel-sign';
    root.add(sign);
    glowMats.push(signMat);
  }
}

// ── Landmark helper functions ──

function addBox(g: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): void {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
}

function addCyl(g: THREE.Group, rTop: number, rBot: number, h: number, mat: THREE.Material, x: number, y: number, z: number): void {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 8), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
}

function addCone(g: THREE.Group, r: number, h: number, mat: THREE.Material, x: number, y: number, z: number): void {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
}

function addSphere(g: THREE.Group, r: number, mat: THREE.Material, x: number, y: number, z: number): void {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), mat);
  m.position.set(x, y, z);
  g.add(m);
}

function addClockFaces(g: THREE.Group, handMat: THREE.Material, faceColor: string, emissiveIntensity: number): void {
  for (let side = 0; side < 4; side++) {
    const fg = new THREE.Group();
    const discGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 24);
    const discMat = new THREE.MeshStandardMaterial({
      color: faceColor, roughness: 0.2, emissive: faceColor, emissiveIntensity,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = Math.PI / 2;
    fg.add(disc);

    const hourGeo = new THREE.BoxGeometry(0.06, 0.35, 0.03);
    const hour = new THREE.Mesh(hourGeo, handMat);
    hour.position.y = 0.15;
    hour.rotation.z = (side * Math.PI) / 2;
    fg.add(hour);

    const minGeo = new THREE.BoxGeometry(0.04, 0.5, 0.03);
    const min = new THREE.Mesh(minGeo, handMat);
    min.position.y = 0.22;
    min.rotation.z = (side * Math.PI) / 2 + 0.5;
    fg.add(min);

    const dotGeo = new THREE.SphereGeometry(0.08, 8, 8);
    fg.add(new THREE.Mesh(dotGeo, handMat));

    const angle = (side * Math.PI) / 2;
    fg.position.set(Math.sin(angle) * 1.8, 0, Math.cos(angle) * 1.8);
    fg.rotation.y = angle;
    g.add(fg);
  }
}

function addFireEscape(
  root: THREE.Group, W: number, D: number, H: number,
  storeH: number, floorH: number, floors: number, _rng: Rng,
): void {
  const g = new THREE.Group();
  const x = W / 2 - 0.15;
  const z = D / 2 + 0.15;
  const platW = Math.min(1.2, W * 0.5);
  const platD = 0.45;
  for (let f = 1; f < floors; f++) {
    const y = storeH + (f - 1) * floorH;
    g.add(boxMesh(platW, 0.05, platD, SHARED.metal, x - platW * 0.22, y, z));
    g.add(boxMesh(0.04, floorH, 0.04, SHARED.metal, x - platW * 0.6, y, z + platD * 0.4));
    g.add(boxMesh(0.04, floorH, 0.04, SHARED.metal, x + platW * 0.2, y, z + platD * 0.4));
    g.add(boxMesh(platW, 0.04, 0.04, SHARED.metal, x - platW * 0.22, y + floorH * 0.5, z + platD * 0.5));
  }
  g.add(boxMesh(0.05, storeH * 0.7, 0.05, SHARED.metal, x - platW * 0.22, 0.2, z + platD * 0.2));
  root.add(g);
}
