// ============================================================
// CityBuilder — Procedural city around the Monopoly board
// ============================================================

import * as THREE from 'three';
import type { ColorGroup, ThemeId } from '@monopoly/shared';
import {
  GROUP_COLORS, ALL_PROPERTIES,
  TILE_W, TILE_D, CORNER_SIZE, SIDE_LENGTH,
  INNER_BOARD_HALF, OUTER_BOARD_HALF, OUTER_RING_OFFSET,
  getGroundTilePosition, isCornerIndex,
} from '@monopoly/shared';

// ---- Configuration ----

const BOARD_HALF = INNER_BOARD_HALF + 1; // slight offset for building placement
const SIDEWALK_WIDTH = 2.0;
const ROAD_WIDTH = 4.0;
const BUILDING_SETBACK = 0.5;
const OUTER_BUILDING_COVERAGE = 0.85;
const INNER_BUILDING_COVERAGE = 0.60;
const LAMP_POST_SPACING_OUTER = 2; // every N tiles
const LAMP_POST_SPACING_INNER = 3;

// ---- Building style config per color group ----

interface BuildingStyle {
  floors: [number, number]; // min, max
  bodyColor: string;
  roofType: 'flat' | 'pitched' | 'mansard' | 'stepped';
  facadeType: 'brick' | 'stucco' | 'concrete' | 'stone' | 'glass';
  windowColor: string;
  hasAcUnits: boolean;
  hasAntenna: boolean;
  hasFireEscape: boolean;
  hasBalcony: boolean;
}

const STYLES: Record<ColorGroup, BuildingStyle> = {
  brown:   { floors: [2, 3], bodyColor: '#8B4513', roofType: 'pitched', facadeType: 'brick',   windowColor: '#FFE4B5', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: false },
  lightblue: { floors: [2, 4], bodyColor: '#87CEEB', roofType: 'flat', facadeType: 'stucco',    windowColor: '#F0F8FF', hasAcUnits: false, hasAntenna: false, hasFireEscape: true, hasBalcony: false },
  teal:    { floors: [3, 5], bodyColor: '#008080', roofType: 'stepped', facadeType: 'concrete', windowColor: '#E0FFFF', hasAcUnits: true, hasAntenna: false, hasFireEscape: false, hasBalcony: true },
  pink:    { floors: [3, 4], bodyColor: '#FF69B4', roofType: 'mansard',  facadeType: 'brick',    windowColor: '#FFF0F5', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: true },
  orange:  { floors: [3, 6], bodyColor: '#FF8C00', roofType: 'stepped', facadeType: 'stone',    windowColor: '#FFF5EE', hasAcUnits: true, hasAntenna: true, hasFireEscape: true, hasBalcony: false },
  red:     { floors: [4, 6], bodyColor: '#DC143C', roofType: 'flat', facadeType: 'concrete',   windowColor: '#FFE4E1', hasAcUnits: true, hasAntenna: true, hasFireEscape: false, hasBalcony: true },
  yellow:  { floors: [4, 7], bodyColor: '#FFD700', roofType: 'stepped', facadeType: 'stone',    windowColor: '#FFFFF0', hasAcUnits: true, hasAntenna: true, hasFireEscape: true, hasBalcony: true },
  plum:    { floors: [5, 8], bodyColor: '#8B008B', roofType: 'flat',    facadeType: 'glass',    windowColor: '#F5F5FF', hasAcUnits: true, hasAntenna: true, hasFireEscape: false, hasBalcony: true },
  green:   { floors: [5, 9], bodyColor: '#228B22', roofType: 'flat',    facadeType: 'glass',    windowColor: '#F0FFF0', hasAcUnits: true, hasAntenna: true, hasFireEscape: true, hasBalcony: false },
  blue:    { floors: [6, 10], bodyColor: '#0000CD', roofType: 'flat',   facadeType: 'glass',    windowColor: '#F0F0FF', hasAcUnits: true, hasAntenna: true, hasFireEscape: false, hasBalcony: true },
  // Outer ring groups
  outer_amber:  { floors: [2, 3], bodyColor: '#FFBF00', roofType: 'pitched', facadeType: 'brick',    windowColor: '#FFF8DC', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: false },
  outer_mint:   { floors: [2, 4], bodyColor: '#98FB98', roofType: 'flat',    facadeType: 'stucco',   windowColor: '#F0FFF0', hasAcUnits: false, hasAntenna: false, hasFireEscape: true, hasBalcony: false },
  outer_coral:  { floors: [3, 5], bodyColor: '#FF7F50', roofType: 'stepped', facadeType: 'concrete', windowColor: '#FFF5EE', hasAcUnits: true, hasAntenna: false, hasFireEscape: false, hasBalcony: true },
  outer_lime:   { floors: [3, 4], bodyColor: '#32CD32', roofType: 'mansard', facadeType: 'brick',    windowColor: '#F5FFF5', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: true },
  outer_violet: { floors: [3, 6], bodyColor: '#8A2BE2', roofType: 'stepped', facadeType: 'stone',    windowColor: '#F8F0FF', hasAcUnits: true, hasAntenna: true, hasFireEscape: true, hasBalcony: false },
  outer_rose:   { floors: [4, 6], bodyColor: '#FF1493', roofType: 'flat',    facadeType: 'concrete', windowColor: '#FFF0F5', hasAcUnits: true, hasAntenna: true, hasFireEscape: false, hasBalcony: true },
  outer_sky:    { floors: [4, 7], bodyColor: '#00BFFF', roofType: 'stepped', facadeType: 'stone',    windowColor: '#F0F8FF', hasAcUnits: true, hasAntenna: true, hasFireEscape: true, hasBalcony: true },
  outer_ruby:   { floors: [5, 8], bodyColor: '#E0115F', roofType: 'flat',    facadeType: 'glass',    windowColor: '#FFF0F5', hasAcUnits: true, hasAntenna: true, hasFireEscape: false, hasBalcony: true },
  outer_copper: { floors: [2, 4], bodyColor: '#B87333', roofType: 'pitched', facadeType: 'brick',    windowColor: '#FFF8DC', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: false },
  outer_navy:   { floors: [6, 10], bodyColor: '#000080', roofType: 'flat',   facadeType: 'glass',    windowColor: '#F0F0FF', hasAcUnits: true, hasAntenna: true, hasFireEscape: false, hasBalcony: true },
  railway: { floors: [2, 3], bodyColor: '#FFD700', roofType: 'flat',   facadeType: 'concrete', windowColor: '#FFF8DC', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: false },
  utility: { floors: [2, 3], bodyColor: '#C0C0C0', roofType: 'flat',   facadeType: 'concrete', windowColor: '#F5F5F5', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: false },
};

// ---- Building type system ----

type BuildingType =
  | 'residential' | 'shop' | 'cafe' | 'restaurant'
  | 'hospital' | 'bank' | 'office' | 'hotel'
  | 'convenience' | 'pharmacy';

interface BuildingTypeConfig {
  type: BuildingType;
  label: string;
  labelCN: string;
  weight: number;         // probability weight
  widthMul: number;        // width multiplier
  depthMul: number;        // depth multiplier
  floorsAdd: number;       // extra floors on top of style range
  groundFloorHeight: number; // height of ground floor (vs standard 0.9)
  accentColor: string;
}

const BUILDING_TYPES: BuildingTypeConfig[] = [
  { type: 'residential',  label: 'Residence',   labelCN: '住宅',   weight: 30, widthMul: 1.0, depthMul: 1.0, floorsAdd: 0, groundFloorHeight: 0.9, accentColor: '#795548' },
  { type: 'shop',         label: 'Shop',        labelCN: '商店',   weight: 18, widthMul: 1.3, depthMul: 0.9, floorsAdd: 0, groundFloorHeight: 1.1, accentColor: '#FF9800' },
  { type: 'cafe',         label: 'Café',        labelCN: '咖啡店', weight: 9,  widthMul: 1.1, depthMul: 1.0, floorsAdd: 0, groundFloorHeight: 0.9, accentColor: '#8D6E63' },
  { type: 'restaurant',   label: 'Restaurant',  labelCN: '饭店',   weight: 10, widthMul: 1.4, depthMul: 1.1, floorsAdd: 0, groundFloorHeight: 1.0, accentColor: '#E53935' },
  { type: 'hospital',     label: 'Hospital',    labelCN: '医院',   weight: 5,  widthMul: 1.8, depthMul: 1.3, floorsAdd: 1, groundFloorHeight: 1.2, accentColor: '#FFFFFF' },
  { type: 'bank',         label: 'Bank',        labelCN: '银行',   weight: 6,  widthMul: 1.3, depthMul: 1.2, floorsAdd: 1, groundFloorHeight: 1.3, accentColor: '#D4AF37' },
  { type: 'office',       label: 'Office',      labelCN: '办公楼', weight: 10, widthMul: 1.2, depthMul: 1.0, floorsAdd: 3, groundFloorHeight: 1.2, accentColor: '#607D8B' },
  { type: 'hotel',        label: 'Hotel',       labelCN: '酒店',   weight: 5,  widthMul: 1.3, depthMul: 1.1, floorsAdd: 4, groundFloorHeight: 1.2, accentColor: '#FFD700' },
  { type: 'convenience',  label: 'Convenience', labelCN: '便利店', weight: 4,  widthMul: 0.9, depthMul: 0.8, floorsAdd: 0, groundFloorHeight: 1.0, accentColor: '#4CAF50' },
  { type: 'pharmacy',     label: 'Pharmacy',    labelCN: '药店',   weight: 3,  widthMul: 1.0, depthMul: 0.9, floorsAdd: 0, groundFloorHeight: 1.0, accentColor: '#4CAF50' },
];

function selectBuildingType(seed: number): BuildingTypeConfig {
  const totalWeight = BUILDING_TYPES.reduce((sum, t) => sum + t.weight, 0);
  let r = seededRandom(seed + 55) * totalWeight;
  for (const bt of BUILDING_TYPES) {
    r -= bt.weight;
    if (r <= 0) return bt;
  }
  return BUILDING_TYPES[0];
}

// ---- Tile position helpers (uses shared boardLayout) ----

function getTileBoardPos(index: number): { x: number; z: number; rotation: number; isCorner: boolean } {
  const pos = getGroundTilePosition(index);
  return { x: pos.x, z: pos.z, rotation: pos.rotation, isCorner: isCornerIndex(index) };
}

// ---- Utility ----

function seededRandom(seed: number): number {
  let s = Math.sin(seed) * 43758.5453;
  return s - Math.floor(s);
}

function propJitter(base: number, seed: number, amount: number): number {
  return base + (seededRandom(seed) - 0.5) * amount;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class CityBuilder {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private buildingGroup: THREE.Group;
  private roadGroup: THREE.Group;
  private propGroup: THREE.Group;
  private theme: ThemeId = 'classic';

  // Track night-glow materials
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

  build(): void {
    this.buildRingRoadSurfaces();
    this.buildInnerRing();
    this.buildOuterRing();
    this.buildStreetProps();
    this.buildInnerCityRoads();
    this.buildLandmarks();
  }

  // ---- Ring Road Surfaces (visible asphalt roads) ----

  private buildRingRoadSurfaces(): void {
    const roadMat = new THREE.MeshStandardMaterial({ color: '#3D3D3D', roughness: 0.95 });
    const laneMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.5, emissive: '#FFD700', emissiveIntensity: 0.1 });
    const curbMat = new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.7 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#C8C0B8', roughness: 0.85 });

    const roadCenterOffset = TILE_D / 2 + SIDEWALK_WIDTH + ROAD_WIDTH / 2; // ~6.75
    const roadExtend = 50; // how far roads extend beyond board

    // Build roads for both rings
    const rings = [
      { half: INNER_BOARD_HALF, label: 'inner' },
      { half: OUTER_BOARD_HALF, label: 'outer' },
    ];

    for (const ring of rings) {
      const roadZ = ring.half + roadCenterOffset;
      const length = ring.half * 2 + roadExtend;

      // 4 sides: bottom(+z out), right(+x out), top(-z out), left(-x out)
      const roadConfigs: { x: number; z: number; w: number; d: number }[] = [
        { x: 0, z: -roadZ, w: length, d: ROAD_WIDTH }, // bottom
        { x: 0, z: roadZ, w: length, d: ROAD_WIDTH },  // top
        { x: roadZ, z: 0, w: ROAD_WIDTH, d: length },  // right
        { x: -roadZ, z: 0, w: ROAD_WIDTH, d: length }, // left
      ];

      for (const rc of roadConfigs) {
        // Road surface
        const roadGeo = new THREE.BoxGeometry(rc.w, 0.06, rc.d);
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.set(rc.x, 0.02, rc.z);
        road.receiveShadow = true;
        this.roadGroup.add(road);

        // Dashed center line
        const isHorizontal = rc.w > rc.d;
        const dashLen = 1.5;
        const dashGap = 1.5;
        const dashCount = Math.floor((isHorizontal ? rc.w : rc.d) / (dashLen + dashGap));
        for (let d = 0; d < dashCount; d++) {
          const dashPos = -((isHorizontal ? rc.w : rc.d) / 2) + dashLen / 2 + d * (dashLen + dashGap);
          const dashGeo = new THREE.BoxGeometry(
            isHorizontal ? dashLen : 0.12,
            0.07,
            isHorizontal ? 0.12 : dashLen,
          );
          const dash = new THREE.Mesh(dashGeo, laneMat);
          dash.position.set(
            isHorizontal ? dashPos : rc.x,
            0.04,
            isHorizontal ? rc.z : dashPos,
          );
          this.roadGroup.add(dash);
        }

        // Curbs on both sides of the road
        for (const sideSign of [-1, 1]) {
          const curbGeo = new THREE.BoxGeometry(
            isHorizontal ? rc.w : 0.3,
            0.14,
            isHorizontal ? 0.3 : rc.d,
          );
          const curb = new THREE.Mesh(curbGeo, curbMat);
          curb.position.set(
            isHorizontal ? 0 : rc.x + sideSign * (ROAD_WIDTH / 2 + 0.3),
            0.06,
            isHorizontal ? rc.z + sideSign * (ROAD_WIDTH / 2 + 0.3) : 0,
          );
          curb.receiveShadow = true;
          this.roadGroup.add(curb);

          // Sidewalk slab
          const swGeo = new THREE.BoxGeometry(
            isHorizontal ? rc.w : SIDEWALK_WIDTH,
            0.08,
            isHorizontal ? SIDEWALK_WIDTH : rc.d,
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

  // ---- Inner Ring Buildings (tiles 0-47) ----

  private buildInnerRing(): void {
    for (let i = 0; i < 48; i++) {
      const { x, z, rotation, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;

      const propDef = ALL_PROPERTIES.find(p => p.index === i);
      const group = propDef?.group || 'railway';

      const seed = i * 137 + (this.theme === 'shanghai' ? 1000 : this.theme === 'tokyo' ? 2000 : 0);
      if (seededRandom(seed) > OUTER_BUILDING_COVERAGE) continue;

      const style = STYLES[group] || STYLES.brown;
      const buildingType = selectBuildingType(seed);
      this.createBuilding(x, z, rotation, style, seed, 'outer', buildingType);

      // Inner-facing buildings (~60% coverage)
      if (seededRandom(seed + 500) <= INNER_BUILDING_COVERAGE) {
        const innerType = selectBuildingType(seed + 500);
        this.createBuilding(x, z, rotation, style, seed + 500, 'inner', innerType);
      }
    }
  }

  // ---- Outer Ring Buildings (tiles 72-119, the outermost ring) ----

  /** Bias commercial types for the outer ring where there's more foot traffic */
  private selectOuterRingType(seed: number): BuildingTypeConfig {
    // Heavily favor commercial: shops, cafes, restaurants, convenience stores
    const commercialWeights: { type: BuildingType; weight: number }[] = [
      { type: 'shop', weight: 25 },
      { type: 'cafe', weight: 15 },
      { type: 'restaurant', weight: 18 },
      { type: 'convenience', weight: 8 },
      { type: 'pharmacy', weight: 5 },
      { type: 'hotel', weight: 6 },
      { type: 'hospital', weight: 4 },
      { type: 'bank', weight: 5 },
      { type: 'office', weight: 6 },
      { type: 'residential', weight: 8 },
    ];
    const totalWeight = commercialWeights.reduce((sum, t) => sum + t.weight, 0);
    let r = seededRandom(seed + 55) * totalWeight;
    for (const cw of commercialWeights) {
      r -= cw.weight;
      if (r <= 0) return BUILDING_TYPES.find(bt => bt.type === cw.type) || BUILDING_TYPES[1];
    }
    return BUILDING_TYPES[1]; // default: shop
  }

  private buildOuterRing(): void {
    const OUTER_COMMERCIAL_COVERAGE = 0.90; // denser than inner ring

    for (let i = 0; i < 48; i++) {
      const tileIndex = OUTER_RING_OFFSET + i; // 72-119
      const pos = getGroundTilePosition(tileIndex);
      if (isCornerIndex(tileIndex)) continue;

      const propDef = ALL_PROPERTIES.find(p => p.index === tileIndex);
      const group = propDef?.group || 'railway';

      const seed = tileIndex * 137 + (this.theme === 'shanghai' ? 1000 : this.theme === 'tokyo' ? 2000 : 0);
      if (seededRandom(seed) > OUTER_COMMERCIAL_COVERAGE) continue;

      const style = STYLES[group] || STYLES.brown;

      // Outer-facing: mostly commercial
      const outerType = this.selectOuterRingType(seed);
      this.createBuilding(pos.x, pos.z, pos.rotation, style, seed, 'outer', outerType);

      // Inner-facing (toward inner ring): also commercial-biased but more mixed
      if (seededRandom(seed + 500) <= 0.75) {
        const innerType = this.selectOuterRingType(seed + 500);
        this.createBuilding(pos.x, pos.z, pos.rotation, style, seed + 500, 'inner', innerType);
      }
    }
  }

  private createBuilding(
    tileX: number, tileZ: number, tileRot: number,
    style: BuildingStyle, seed: number, position: 'outer' | 'inner',
    btConfig: BuildingTypeConfig,
  ): void {
    const group = new THREE.Group();

    const depthOffset = position === 'outer'
      ? -(TILE_D / 2 + SIDEWALK_WIDTH + BUILDING_SETBACK)
      : (TILE_D / 2 + SIDEWALK_WIDTH + BUILDING_SETBACK);

    const dirX = Math.sin(tileRot);
    const dirZ = Math.cos(tileRot);

    // Apply type-specific dimension multipliers
    const floors = Math.max(2, style.floors[0] + Math.floor(seededRandom(seed + 10) * (style.floors[1] - style.floors[0] + 1)) + btConfig.floorsAdd);
    const floorHeight = 0.9;
    let buildingHeight = floors * floorHeight;
    if (btConfig.type !== 'residential') {
      // Ground floor is taller for commercial
      buildingHeight = (floors - 1) * floorHeight + btConfig.groundFloorHeight;
    }
    const buildingWidth = propJitter(2.2, seed + 20, 0.6) * btConfig.widthMul;
    const buildingDepth = propJitter(1.8, seed + 30, 0.8) * btConfig.depthMul;

    const centerX = tileX + dirX * depthOffset;
    const centerZ = tileZ + dirZ * depthOffset;

    // ---- Body ----
    const bodyGeo = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
    const isGlass = btConfig.type === 'office' || style.facadeType === 'glass';
    const bodyMat = new THREE.MeshStandardMaterial({
      color: btConfig.type === 'hospital' ? '#F5F5F5' : style.bodyColor,
      roughness: isGlass ? 0.25 : 0.7,
      metalness: isGlass ? 0.6 : 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(centerX, buildingHeight / 2, centerZ);
    body.rotation.y = tileRot;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Windows
    this.addWindows(body, buildingWidth, buildingHeight, buildingDepth, style, seed, tileRot, btConfig);

    // Roof (type-specific override)
    this.addBuildingRoof(body, buildingWidth, buildingHeight, buildingDepth, style, seed, tileRot, btConfig);

    // Upper-floor details
    if (style.hasAcUnits && floors >= 5) this.addAcUnit(body, buildingWidth, buildingDepth, seed, tileRot);
    if (style.hasAntenna && floors >= 7) this.addAntenna(body, buildingWidth, buildingHeight, seed, tileRot);
    if (style.hasFireEscape && floors >= 3 && btConfig.type !== 'office') this.addFireEscape(body, buildingWidth, buildingHeight, buildingDepth, seed, tileRot);
    if (style.hasBalcony && btConfig.type === 'residential') this.addBalconies(body, buildingWidth, buildingHeight, buildingDepth, floors, seed, tileRot);

    // ---- Type-specific ground floor ----
    if (position === 'outer') {
      this.applyGroundFloor(group, buildingWidth, buildingHeight, buildingDepth, centerX, centerZ, seed, tileRot, style, btConfig);
    }

    // Sidewalk
    const sidewalkGeo = new THREE.BoxGeometry(buildingWidth + 0.4, 0.1, SIDEWALK_WIDTH);
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.8 });
    const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    const sidewalkOffset = position === 'outer'
      ? -(TILE_D / 2 + SIDEWALK_WIDTH / 2)
      : TILE_D / 2 + SIDEWALK_WIDTH / 2;
    sidewalk.position.set(
      tileX + dirX * sidewalkOffset,
      0.05,
      tileZ + dirZ * sidewalkOffset,
    );
    sidewalk.rotation.y = tileRot;
    sidewalk.receiveShadow = true;
    group.add(sidewalk);

    // Building type label on the building
    if (btConfig.type !== 'residential') {
      this.addBuildingTypeSign(group, buildingWidth, centerX, centerZ, tileRot, btConfig);
    }

    this.buildingGroup.add(group);
  }

  private addWindows(
    body: THREE.Mesh, w: number, h: number, d: number,
    style: BuildingStyle, seed: number, rot: number,
    btConfig?: BuildingTypeConfig,
  ): void {
    const floors = Math.floor(h / 0.9);
    const winsPerFloor = Math.floor(w / 0.8);
    const winW = 0.3;
    const winH = 0.4;
    const bodyHalfH = h / 2;
    const floorBaseY = -bodyHalfH + 0.35;

    // Ground floor uses larger windows for commercial buildings
    const gfTall = btConfig && btConfig.type !== 'residential';

    for (let f = 0; f < floors; f++) {
      const isGround = f === 0 && gfTall;
      const actualWinH = isGround ? 0.6 : winH;
      const actualWinW = isGround ? 0.45 : winW;
      const winY = isGround
        ? -bodyHalfH + btConfig!.groundFloorHeight / 2
        : floorBaseY + (isGround ? 0 : (f - 1) * 0.9 + 0.9);

      for (let wi = 0; wi < winsPerFloor; wi++) {
        const lit = seededRandom(seed + f * 100 + wi) > (isGround ? 0.15 : 0.35); // ground floors more lit
        const darkColor = '#' + new THREE.Color(style.windowColor).multiplyScalar(0.3).getHexString();
        const winColor = lit ? style.windowColor : darkColor;

        const wx = -w / 2 + 0.4 + wi * 0.8;

        // ---- Front face (facing the board) ----
        const frontGeo = new THREE.PlaneGeometry(actualWinW, actualWinH);
        const frontMat = new THREE.MeshStandardMaterial({
          color: winColor, roughness: 0.3,
          emissive: lit ? winColor : '#000000', emissiveIntensity: lit ? 0.5 : 0,
          side: THREE.DoubleSide,
        });
        const frontWin = new THREE.Mesh(frontGeo, frontMat);
        frontWin.position.set(wx, winY, d / 2 + 0.01);
        body.add(frontWin);
        if (lit) this.nightGlowMaterials.push(frontMat);

        // ---- Back face (facing away from the board) ----
        const backLit = seededRandom(seed + f * 300 + wi + 999) > 0.35;
        const backDark = '#' + new THREE.Color(style.windowColor).multiplyScalar(0.3).getHexString();
        const backColor = backLit ? style.windowColor : backDark;
        const backGeo = new THREE.PlaneGeometry(actualWinW, actualWinH);
        const backMat = new THREE.MeshStandardMaterial({
          color: backColor, roughness: 0.3,
          emissive: backLit ? backColor : '#000000', emissiveIntensity: backLit ? 0.4 : 0,
          side: THREE.DoubleSide,
        });
        const backWin = new THREE.Mesh(backGeo, backMat);
        backWin.position.set(wx, winY, -d / 2 - 0.01);
        backWin.rotation.y = Math.PI; // face outward
        body.add(backWin);
        if (backLit) this.nightGlowMaterials.push(backMat);

        // ---- Left side + Right side faces ----
        for (const sideSign of [-1, 1]) {
          const sideLit = seededRandom(seed + f * 200 + wi + sideSign * 77) > 0.4;
          const sideDark = '#' + new THREE.Color(style.windowColor).multiplyScalar(0.3).getHexString();
          const sideColor = sideLit ? style.windowColor : sideDark;
          const sideGeo = new THREE.PlaneGeometry(actualWinW * 0.7, actualWinH);
          const sideMat = new THREE.MeshStandardMaterial({
            color: sideColor, roughness: 0.3,
            emissive: sideLit ? sideColor : '#000000', emissiveIntensity: sideLit ? 0.4 : 0,
            side: THREE.DoubleSide,
          });
          const sideWin = new THREE.Mesh(sideGeo, sideMat);
          sideWin.position.set(sideSign * (w / 2 + 0.01), winY, -d / 2 + 0.5 + (wi % 2) * 0.6);
          sideWin.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;
          body.add(sideWin);
          if (sideLit) this.nightGlowMaterials.push(sideMat);
        }
      }
    }
  }

  private addRoof(
    body: THREE.Mesh, w: number, h: number, d: number,
    style: BuildingStyle, seed: number, rot: number,
  ): void {
    const roofY = h / 2;

    switch (style.roofType) {
      case 'pitched': {
        const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.75, 1.2, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.6 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = roofY + 0.6;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        body.add(roof);
        break;
      }
      case 'mansard': {
        for (let s = 0; s < 4; s++) {
          const slopeGeo = new THREE.BoxGeometry(w + 0.2, 0.6, 0.4);
          const slopeMat = new THREE.MeshStandardMaterial({ color: '#4E342E', roughness: 0.5 });
          const slope = new THREE.Mesh(slopeGeo, slopeMat);
          slope.position.y = roofY + 0.3;
          slope.rotation.y = (Math.PI / 2) * s;
          const offset = d / 2 - 0.2;
          slope.position.x = s % 2 === 0 ? 0 : (s === 0 ? offset : -offset);
          slope.position.z = s % 2 === 1 ? 0 : (s === 1 ? offset : -offset);
          slope.castShadow = true;
          body.add(slope);
        }
        break;
      }
      case 'stepped': {
        const stepCount = 3;
        for (let i = 0; i < stepCount; i++) {
          const sw = w * (1 - i * 0.15);
          const sd = d * (1 - i * 0.15);
          const stepGeo = new THREE.BoxGeometry(sw, 0.25, sd);
          const stepMat = new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.5 });
          const step = new THREE.Mesh(stepGeo, stepMat);
          step.position.y = roofY + 0.125 + i * 0.3;
          step.castShadow = true;
          body.add(step);
        }
        break;
      }
      case 'flat':
      default: {
        // Parapet rim
        const parapetGeo = new THREE.BoxGeometry(w + 0.15, 0.2, d + 0.15);
        const parapetMat = new THREE.MeshStandardMaterial({ color: '#9E9E9E', roughness: 0.5 });
        const parapet = new THREE.Mesh(parapetGeo, parapetMat);
        parapet.position.y = roofY + 0.1;
        parapet.castShadow = true;
        body.add(parapet);
        break;
      }
    }
  }

  private addAcUnit(body: THREE.Mesh, w: number, d: number, seed: number, rot: number): void {
    const acGeo = new THREE.BoxGeometry(0.5, 0.4, 0.3);
    const acMat = new THREE.MeshStandardMaterial({ color: '#B0BEC5', roughness: 0.4, metalness: 0.5 });
    const ac = new THREE.Mesh(acGeo, acMat);
    const bodyHeight = (body.geometry as THREE.BoxGeometry).parameters.height;
    ac.position.set(
      propJitter(0, seed + 70, w * 0.3),
      body.position.y + bodyHeight / 2 + 0.2,
      d / 2 - 0.2,
    );
    ac.castShadow = true;
    body.add(ac);
  }

  private addAntenna(body: THREE.Mesh, w: number, h: number, seed: number, rot: number): void {
    const antGeo = new THREE.CylinderGeometry(0.05, 0.08, 1.5, 8);
    const antMat = new THREE.MeshStandardMaterial({ color: '#757575', roughness: 0.3, metalness: 0.7 });
    const ant = new THREE.Mesh(antGeo, antMat);
    ant.position.set(
      propJitter(0, seed + 80, w * 0.25),
      h / 2 + 0.75,
      0,
    );
    ant.castShadow = true;
    body.add(ant);
  }

  private addFireEscape(body: THREE.Mesh, w: number, h: number, d: number, seed: number, rot: number): void {
    const floors = Math.floor(h / 0.9);
    const bodyHalfH = h / 2;
    const floorBaseY = -bodyHalfH + 0.35;
    for (let f = 0; f < floors - 1; f++) {
      const platGeo = new THREE.BoxGeometry(0.5, 0.05, 0.8);
      const platMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.3, metalness: 0.6 });
      const plat = new THREE.Mesh(platGeo, platMat);
      plat.position.set(-w / 2 - 0.3, floorBaseY + f * 0.9, d / 2 - 0.6);
      plat.castShadow = true;
      body.add(plat);
    }
    // Ladder rails
    for (let s = 0; s < 2; s++) {
      const railGeo = new THREE.CylinderGeometry(0.03, 0.03, h - 0.3, 8);
      const rail = new THREE.Mesh(railGeo, new THREE.MeshStandardMaterial({ color: '#616161', metalness: 0.6, roughness: 0.3 }));
      rail.position.set(-w / 2 - 0.3 + (s === 0 ? -0.15 : 0.15), h / 2 - 0.15, d / 2 - 0.6);
      body.add(rail);
    }
  }

  private addBalconies(body: THREE.Mesh, w: number, h: number, d: number, floors: number, seed: number, rot: number): void {
    const bodyHalfH = h / 2;
    const floorBaseY = -bodyHalfH + 0.35;
    // Add balcony to 40% of floors
    for (let f = 1; f < floors; f++) {
      if (seededRandom(seed + f * 300) > 0.4) continue;
      const balcGeo = new THREE.BoxGeometry(1.0, 0.08, 0.5);
      const balcMat = new THREE.MeshStandardMaterial({ color: '#757575', roughness: 0.4, metalness: 0.5 });
      const balc = new THREE.Mesh(balcGeo, balcMat);
      balc.position.set(
        propJitter(0, seed + f * 310, w * 0.25),
        floorBaseY + f * 0.9,
        d / 2 + 0.25,
      );
      balc.castShadow = true;
      body.add(balc);

      // Railing
      const railGeo = new THREE.BoxGeometry(1.0, 0.4, 0.03);
      const railMat = new THREE.MeshStandardMaterial({ color: '#9E9E9E', roughness: 0.3, metalness: 0.6 });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, 0.2, 0.25);
      balc.add(rail);
    }
  }

  // ---- Type-specific Roof ----

  private addBuildingRoof(
    body: THREE.Mesh, w: number, h: number, d: number,
    style: BuildingStyle, seed: number, rot: number,
    btConfig: BuildingTypeConfig,
  ): void {
    const roofY = h / 2;

    // Office buildings: flat roof with HVAC units
    if (btConfig.type === 'office') {
      const parapetGeo = new THREE.BoxGeometry(w + 0.15, 0.25, d + 0.15);
      const parapet = new THREE.Mesh(parapetGeo, new THREE.MeshStandardMaterial({ color: '#9E9E9E', roughness: 0.4, metalness: 0.5 }));
      parapet.position.y = roofY + 0.125;
      body.add(parapet);
      // HVAC cluster
      for (let i = 0; i < 3; i++) {
        const hvacGeo = new THREE.BoxGeometry(0.5, 0.6, 0.4);
        const hvac = new THREE.Mesh(hvacGeo, new THREE.MeshStandardMaterial({ color: '#B0BEC5', roughness: 0.4, metalness: 0.5 }));
        hvac.position.set((i - 1) * 1.2, roofY + 0.55, d / 2 - 0.5);
        hvac.castShadow = true;
        body.add(hvac);
      }
      return;
    }

    // Hotel: flat roof with prominent rooftop sign
    if (btConfig.type === 'hotel') {
      const parapetGeo = new THREE.BoxGeometry(w + 0.15, 0.2, d + 0.15);
      const parapet = new THREE.Mesh(parapetGeo, new THREE.MeshStandardMaterial({ color: '#9E9E9E', roughness: 0.5 }));
      parapet.position.y = roofY + 0.1;
      body.add(parapet);
      // Rooftop sign
      const signGeo = new THREE.BoxGeometry(w * 0.6, 0.6, 0.15);
      const signMat = new THREE.MeshStandardMaterial({
        color: btConfig.accentColor, roughness: 0.3,
        emissive: btConfig.accentColor, emissiveIntensity: 0.6,
      });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.y = roofY + 0.5;
      sign.name = 'hotel-sign';
      body.add(sign);
      this.nightGlowMaterials.push(signMat);
      // Sign supports
      for (let s = -1; s <= 1; s += 2) {
        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
        const pole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.3, metalness: 0.5 }));
        pole.position.set(s * w * 0.2, roofY + 0.3, 0);
        body.add(pole);
      }
      return;
    }

    // Hospital: flat with helipad marking
    if (btConfig.type === 'hospital') {
      const parapetGeo = new THREE.BoxGeometry(w + 0.15, 0.2, d + 0.15);
      const parapet = new THREE.Mesh(parapetGeo, new THREE.MeshStandardMaterial({ color: '#E0E0E0', roughness: 0.5 }));
      parapet.position.y = roofY + 0.1;
      body.add(parapet);
      // Helipad H
      const padGeo = new THREE.BoxGeometry(w * 0.5, 0.05, d * 0.5);
      const pad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.6 }));
      pad.position.y = roofY + 0.22;
      body.add(pad);
      return;
    }

    // Restaurant: vent/chimney
    if (btConfig.type === 'restaurant') {
      this.addRoof(body, w, h, d, style, seed, rot); // default roof first
      const ventGeo = new THREE.CylinderGeometry(0.2, 0.25, 2, 8);
      const vent = new THREE.Mesh(ventGeo, new THREE.MeshStandardMaterial({ color: '#9E9E9E', roughness: 0.3, metalness: 0.6 }));
      vent.position.set(0, roofY + 1, -d / 2 + 0.5);
      vent.castShadow = true;
      body.add(vent);
      return;
    }

    // Bank: pediment / triangular top
    if (btConfig.type === 'bank') {
      const pedGeo = new THREE.BoxGeometry(w + 0.1, 0.5, d + 0.1);
      const ped = new THREE.Mesh(pedGeo, new THREE.MeshStandardMaterial({ color: '#E8DCC8', roughness: 0.4 }));
      ped.position.y = roofY + 0.25;
      body.add(ped);
      // Small triangular pediment on front
      const triShape = new THREE.Shape();
      triShape.moveTo(-w / 2, 0);
      triShape.lineTo(0, 0.8);
      triShape.lineTo(w / 2, 0);
      triShape.closePath();
      const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.2, bevelEnabled: false });
      const tri = new THREE.Mesh(triGeo, new THREE.MeshStandardMaterial({ color: '#E8DCC8', roughness: 0.4 }));
      tri.position.set(-w / 2, roofY + 0.5, -0.1);
      tri.rotation.y = -Math.PI / 2;
      body.add(tri);
      return;
    }

    // Default roof from style
    this.addRoof(body, w, h, d, style, seed, rot);
  }

  // ---- Type-specific Ground Floor Builders ----

  private applyGroundFloor(
    parentGroup: THREE.Group, w: number, h: number, d: number,
    cx: number, cz: number, seed: number, rot: number,
    style: BuildingStyle, btConfig: BuildingTypeConfig,
  ): void {
    switch (btConfig.type) {
      case 'shop': this.buildShopGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      case 'cafe': this.buildCafeGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      case 'restaurant': this.buildRestaurantGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      case 'hospital': this.buildHospitalGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      case 'bank': this.buildBankGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      case 'office': this.buildOfficeGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      case 'hotel': this.buildHotelGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      case 'convenience': this.buildConvenienceGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      case 'pharmacy': this.buildPharmacyGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
      default: this.buildResidentialGround(parentGroup, w, d, cx, cz, seed, rot, btConfig); break;
    }
  }

  /** Shop: large display windows across the front */
  private buildShopGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    // Large display window (lit frame)
    const winFrameGeo = new THREE.BoxGeometry(w * 0.8, 0.7, 0.08);
    const winFrame = new THREE.Mesh(winFrameGeo, new THREE.MeshStandardMaterial({
      color: '#E0E0E0', roughness: 0.2, metalness: 0.5,
    }));
    winFrame.position.set(cx, y + 0.15, cz + (d / 2 + 0.04) * Math.cos(rot));
    winFrame.rotation.y = rot;
    pg.add(winFrame);
    // Display items inside (colored boxes)
    for (let i = 0; i < 3; i++) {
      const itemGeo = new THREE.BoxGeometry(0.2, 0.3, 0.1);
      const itemColors = ['#E53935', '#1E88E5', '#FFD700', '#4CAF50'];
      const item = new THREE.Mesh(itemGeo, new THREE.MeshStandardMaterial({
        color: itemColors[i % 4], roughness: 0.4,
        emissive: itemColors[i % 4], emissiveIntensity: 0.2,
      }));
      item.position.set(cx + (i - 1) * 0.5, y + 0.15, cz + (d / 2 + 0.1) * Math.cos(rot));
      pg.add(item);
    }
    // Awning
    this.addSimpleAwning(pg, w, d, cx, cz, rot, bt, y);
    // "OPEN" sign
    this.addOpenSign(pg, cx, cz, rot, bt, y, d);
  }

  /** Café: cozy outdoor seating + awning + menu board */
  private buildCafeGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    this.addSimpleAwning(pg, w, d, cx, cz, rot, bt, y);
    // Outdoor seating area (always for cafes)
    this.addOutdoorSeatingArea(pg, cx, cz, rot, seed, 3);
    // Menu board
    const menuGeo = new THREE.BoxGeometry(0.4, 0.6, 0.06);
    const menu = new THREE.Mesh(menuGeo, new THREE.MeshStandardMaterial({
      color: '#424242', roughness: 0.3, emissive: '#424242', emissiveIntensity: 0.2,
    }));
    menu.position.set(cx + w * 0.3, y + 0.2, cz + (d / 2 + 0.2) * Math.cos(rot));
    menu.rotation.y = rot;
    pg.add(menu);
  }

  /** Restaurant: prominent entrance + vent */
  private buildRestaurantGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    // Double doors
    const doorGeo = new THREE.BoxGeometry(0.9, 1.0, 0.08);
    const door = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({
      color: '#5D4037', roughness: 0.4, metalness: 0.3,
    }));
    door.position.set(cx, y + 0.1, cz + (d / 2 + 0.04) * Math.cos(rot));
    door.rotation.y = rot;
    pg.add(door);
    // Gold door handles
    for (let s = -1; s <= 1; s += 2) {
      const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
      const handle = new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({
        color: '#FFD700', roughness: 0.2, metalness: 0.9,
      }));
      handle.position.set(cx + s * 0.25, y + 0.1, cz + (d / 2 + 0.09) * Math.cos(rot));
      pg.add(handle);
    }
    // Large sign
    const signGeo = new THREE.BoxGeometry(w * 0.5, 0.35, 0.1);
    const signMat = new THREE.MeshStandardMaterial({
      color: bt.accentColor, roughness: 0.3,
      emissive: bt.accentColor, emissiveIntensity: 0.5,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(cx, y + 0.65, cz + (d / 2 + 0.35) * Math.cos(rot));
    sign.rotation.y = rot;
    pg.add(sign);
    this.nightGlowMaterials.push(signMat);
  }

  /** Hospital: white facade with red cross */
  private buildHospitalGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    // Wide entrance with sliding doors
    const entryGeo = new THREE.BoxGeometry(2.0, 1.1, 0.1);
    const entry = new THREE.Mesh(entryGeo, new THREE.MeshStandardMaterial({
      color: '#87CEEB', roughness: 0.1, metalness: 0.3,
      emissive: '#87CEEB', emissiveIntensity: 0.2,
    }));
    entry.position.set(cx, y + 0.15, cz + (d / 2 + 0.05) * Math.cos(rot));
    entry.rotation.y = rot;
    pg.add(entry);
    // Red cross
    const crossMat = new THREE.MeshStandardMaterial({
      color: '#E53935', roughness: 0.3, emissive: '#E53935', emissiveIntensity: 0.6,
    });
    const crossHGeo = new THREE.BoxGeometry(0.3, 0.9, 0.06);
    const crossVGeo = new THREE.BoxGeometry(0.9, 0.3, 0.06);
    [crossHGeo, crossVGeo].forEach(g => {
      const cross = new THREE.Mesh(g, crossMat);
      cross.position.set(cx, y + 0.7, cz + (d / 2 + 0.08) * Math.cos(rot));
      pg.add(cross);
    });
    this.nightGlowMaterials.push(crossMat);
    // Canopy
    const canopyGeo = new THREE.BoxGeometry(w * 0.7, 0.1, 1.0);
    const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.4, metalness: 0.4 }));
    canopy.position.set(cx, y + 1.0, cz + (d / 2 + 0.5) * Math.cos(rot));
    canopy.rotation.y = rot;
    canopy.castShadow = true;
    pg.add(canopy);
  }

  /** Bank: columns and grand entrance */
  private buildBankGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    // 4 columns at entrance
    for (let c = 0; c < 4; c++) {
      const colGeo = new THREE.CylinderGeometry(0.12, 0.15, bt.groundFloorHeight, 12);
      const col = new THREE.Mesh(colGeo, new THREE.MeshStandardMaterial({
        color: '#E8DCC8', roughness: 0.3, metalness: 0.2,
      }));
      col.position.set(cx + (c - 1.5) * 0.55, y, cz + (d / 2 - 0.1) * Math.cos(rot));
      col.castShadow = true;
      pg.add(col);
      // Column capital
      const capGeo = new THREE.BoxGeometry(0.3, 0.12, 0.3);
      const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({
        color: '#D4AF37', roughness: 0.2, metalness: 0.7,
      }));
      cap.position.y = y + bt.groundFloorHeight / 2 - 0.06;
      col.add(cap);
    }
    // Grand door
    const doorGeo = new THREE.BoxGeometry(1.2, 1.2, 0.08);
    const door = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({
      color: '#5D4037', roughness: 0.3, metalness: 0.5,
    }));
    door.position.set(cx, y + 0.15, cz + (d / 2 + 0.04) * Math.cos(rot));
    door.rotation.y = rot;
    pg.add(door);
  }

  /** Office: glass lobby entrance */
  private buildOfficeGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    // Glass curtain wall on ground floor
    const glassGeo = new THREE.BoxGeometry(w * 0.85, bt.groundFloorHeight * 0.7, 0.06);
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#87CEEB', roughness: 0.1, metalness: 0.3,
      emissive: '#87CEEB', emissiveIntensity: 0.2,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(cx, y, cz + (d / 2 + 0.03) * Math.cos(rot));
    glass.rotation.y = rot;
    pg.add(glass);
    this.nightGlowMaterials.push(glassMat);
    // Metal mullions (vertical dividers)
    for (let m = 0; m < 5; m++) {
      const mulGeo = new THREE.CylinderGeometry(0.03, 0.03, bt.groundFloorHeight * 0.7, 6);
      const mul = new THREE.Mesh(mulGeo, new THREE.MeshStandardMaterial({
        color: '#9E9E9E', roughness: 0.3, metalness: 0.7,
      }));
      mul.position.set(cx + (m - 2) * w * 0.22, y, cz + (d / 2 + 0.06) * Math.cos(rot));
      pg.add(mul);
    }
    // Revolving door (simple cylinder)
    const revGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16);
    const rev = new THREE.Mesh(revGeo, new THREE.MeshStandardMaterial({
      color: '#BDBDBD', roughness: 0.2, metalness: 0.6,
    }));
    rev.position.set(cx, 0.05, cz + (d / 2 + 0.1) * Math.cos(rot));
    pg.add(rev);
  }

  /** Hotel: doorman area + awning + luggage cart */
  private buildHotelGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    // Wide awning/canopy
    const canopyGeo = new THREE.BoxGeometry(w * 0.8, 0.12, 1.5);
    const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({
      color: bt.accentColor, roughness: 0.3,
      emissive: bt.accentColor, emissiveIntensity: 0.3,
    }));
    canopy.position.set(cx, y + 0.8, cz + (d / 2 + 0.75) * Math.cos(rot));
    canopy.rotation.y = rot;
    canopy.castShadow = true;
    pg.add(canopy);
    this.nightGlowMaterials.push(canopy.material as THREE.MeshStandardMaterial);
    // Doorman podium
    const podiumGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
    const podium = new THREE.Mesh(podiumGeo, new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.4 }));
    podium.position.set(cx + w * 0.3, 0.25, cz + (d / 2 + 1.0) * Math.cos(rot));
    pg.add(podium);
  }

  /** Convenience store: bright lighting + ice freezer outside */
  private buildConvenienceGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    // Extra-bright windows (already handled by high-lit window probability)
    // Ice freezer outside
    const freezerGeo = new THREE.BoxGeometry(0.6, 0.5, 0.4);
    const freezer = new THREE.Mesh(freezerGeo, new THREE.MeshStandardMaterial({
      color: '#FFFFFF', roughness: 0.2, metalness: 0.3,
      emissive: '#E3F2FD', emissiveIntensity: 0.2,
    }));
    freezer.position.set(cx + w * 0.3, 0.25, cz + (d / 2 + 0.3) * Math.cos(rot));
    freezer.rotation.y = rot;
    pg.add(freezer);
    // ATM machine
    const atmGeo = new THREE.BoxGeometry(0.25, 0.5, 0.15);
    const atm = new THREE.Mesh(atmGeo, new THREE.MeshStandardMaterial({
      color: '#424242', roughness: 0.3, metalness: 0.5,
    }));
    atm.position.set(cx - w * 0.3, 0.35, cz + (d / 2 + 0.15) * Math.cos(rot));
    atm.rotation.y = rot;
    pg.add(atm);
    // "24h" sign
    this.addOpenSign(pg, cx, cz, rot, bt, y, d);
  }

  /** Pharmacy: green cross sign */
  private buildPharmacyGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, bt: BuildingTypeConfig,
  ): void {
    const y = bt.groundFloorHeight / 2;
    this.addSimpleAwning(pg, w, d, cx, cz, rot, bt, y);
    // Green cross (pharmacy symbol)
    const crossMat = new THREE.MeshStandardMaterial({
      color: '#4CAF50', roughness: 0.3, emissive: '#4CAF50', emissiveIntensity: 0.5,
    });
    const crossHGeo = new THREE.BoxGeometry(0.25, 0.7, 0.06);
    const crossVGeo = new THREE.BoxGeometry(0.7, 0.25, 0.06);
    [crossHGeo, crossVGeo].forEach(g => {
      const cross = new THREE.Mesh(g, crossMat);
      cross.position.set(cx, y + 0.5, cz + (d / 2 + 0.08) * Math.cos(rot));
      pg.add(cross);
    });
    this.nightGlowMaterials.push(crossMat);
  }

  /** Residential: porch + flower boxes */
  private buildResidentialGround(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    seed: number, rot: number, _bt: BuildingTypeConfig,
  ): void {
    // Doorstep / porch
    const porchGeo = new THREE.BoxGeometry(0.6, 0.15, 0.5);
    const porchMat = new THREE.MeshStandardMaterial({ color: '#795548', roughness: 0.6 });
    const porch = new THREE.Mesh(porchGeo, porchMat);
    porch.position.set(cx, 0.08, cz + (d / 2 + 0.25) * Math.cos(rot));
    porch.rotation.y = rot;
    porch.receiveShadow = true;
    pg.add(porch);
    // Flower boxes
    if (seededRandom(seed + 68) < 0.5) {
      const boxGeo = new THREE.BoxGeometry(0.5, 0.2, 0.25);
      const boxMat = new THREE.MeshStandardMaterial({ color: '#6D4C41', roughness: 0.6 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(cx + w * 0.15, 0.3, cz + (d / 2 + 0.15) * Math.cos(rot));
      box.rotation.y = rot;
      pg.add(box);
      const flowerGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const flowerColors = ['#E91E63', '#FF5722', '#FFEB3B', '#4CAF50'];
      for (let i = 0; i < 3; i++) {
        const flower = new THREE.Mesh(flowerGeo, new THREE.MeshStandardMaterial({
          color: flowerColors[i % flowerColors.length], roughness: 0.5,
        }));
        flower.position.set(cx + w * 0.15 + (i - 1) * 0.15, 0.42, cz + (d / 2 + 0.15) * Math.cos(rot));
        pg.add(flower);
      }
    }
  }

  // ---- Shared Ground-Floor Helpers ----

  private addSimpleAwning(
    pg: THREE.Group, w: number, d: number, cx: number, cz: number,
    rot: number, bt: BuildingTypeConfig, groundY: number,
  ): void {
    const awningGeo = new THREE.BoxGeometry(w * 0.6, 0.1, 0.5);
    const awningMat = new THREE.MeshStandardMaterial({
      color: bt.accentColor, roughness: 0.5,
      emissive: bt.accentColor, emissiveIntensity: 0.15,
    });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(cx, groundY + 0.45, cz + (d / 2 + 0.25) * Math.cos(rot));
    awning.rotation.y = rot;
    awning.castShadow = true;
    awning.name = `storefront-${bt.type}`;
    pg.add(awning);
    // Pillars
    for (let s = -1; s <= 1; s += 2) {
      const pillarGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
      const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshStandardMaterial({
        color: '#757575', roughness: 0.4, metalness: 0.4,
      }));
      pillar.position.set(cx + s * w * 0.25, groundY + 0.2, cz + (d / 2 + 0.25) * Math.cos(rot));
      pg.add(pillar);
    }
  }

  private addOpenSign(
    pg: THREE.Group, cx: number, cz: number, rot: number,
    bt: BuildingTypeConfig, groundY: number, d: number,
  ): void {
    const openGeo = new THREE.BoxGeometry(0.35, 0.2, 0.05);
    const openMat = new THREE.MeshStandardMaterial({
      color: bt.type === 'convenience' ? '#4CAF50' : '#FF0000', roughness: 0.3,
      emissive: bt.type === 'convenience' ? '#00FF00' : '#FF0000',
      emissiveIntensity: 0.7,
    });
    const openSign = new THREE.Mesh(openGeo, openMat);
    openSign.position.set(cx + 0.5, groundY + 0.5, cz + (d / 2 + 0.08) * Math.cos(rot));
    openSign.rotation.y = rot;
    pg.add(openSign);
    this.nightGlowMaterials.push(openMat);
  }

  private addOutdoorSeatingArea(
    pg: THREE.Group, cx: number, cz: number, rot: number, seed: number, tableCount: number,
  ): void {
    for (let t = 0; t < tableCount; t++) {
      const tableGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.25, 8);
      const table = new THREE.Mesh(tableGeo, new THREE.MeshStandardMaterial({ color: '#795548', roughness: 0.5 }));
      const dist = 1.2 + t * 0.8;
      table.position.set(cx + (t - (tableCount - 1) / 2) * 1.0, 0.13, cz + dist * Math.cos(rot));
      table.castShadow = true;
      pg.add(table);
      for (let c = 0; c < 2; c++) {
        const chairGeo = new THREE.BoxGeometry(0.18, 0.22, 0.18);
        const chair = new THREE.Mesh(chairGeo, new THREE.MeshStandardMaterial({
          color: '#424242', roughness: 0.4, metalness: 0.3,
        }));
        chair.position.set(
          cx + (t - (tableCount - 1) / 2) * 1.0 + (c === 0 ? 0.3 : -0.3),
          0.11,
          cz + dist * Math.cos(rot),
        );
        chair.castShadow = true;
        pg.add(chair);
      }
    }
  }

  private addBuildingTypeSign(
    pg: THREE.Group, w: number, cx: number, cz: number,
    rot: number, bt: BuildingTypeConfig,
  ): void {
    // Small protruding sign on the building face
    const signGeo = new THREE.BoxGeometry(0.55, 0.22, 0.06);
    const signMat = new THREE.MeshStandardMaterial({
      color: bt.accentColor, roughness: 0.3,
      emissive: bt.accentColor, emissiveIntensity: 0.45,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    // Place at upper-middle of the building
    sign.position.set(cx + w * 0.25, 2.2, cz + 0.6);
    sign.rotation.y = rot;
    sign.name = `typesign-${bt.type}`;
    pg.add(sign);
    this.nightGlowMaterials.push(signMat);
  }

  // ---- Street Props ----

  private buildStreetProps(): void {
    const propFns = [
      () => this.buildLampPosts(),
      () => this.buildFireHydrants(),
      () => this.buildMailboxes(),
      () => this.buildTrashCans(),
      () => this.buildBenches(),
    ];
    propFns.forEach(fn => fn());
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

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.3, metalness: 0.5 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.1;
    pole.castShadow = true;
    group.add(pole);

    // Lamp housing
    const housingGeo = new THREE.BoxGeometry(0.35, 0.3, 0.25);
    const housingMat = new THREE.MeshStandardMaterial({
      color: '#E0E0E0',
      roughness: 0.3,
      emissive: '#FFE082',
      emissiveIntensity: 0.4,
    });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.y = 2.3;
    group.add(housing);
    this.nightGlowMaterials.push(housingMat);

    const dirX = Math.sin(tileRot);
    const dirZ = Math.cos(tileRot);
    group.position.set(tileX + dirX * offset, 0, tileZ + dirZ * offset);
    this.propGroup.add(group);
  }

  private buildFireHydrants(): void {
    for (let i = 0; i < 48; i++) {
      if (i % 5 !== 1) continue; // ~ every 5th tile
      const { x, z, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      const hydrantGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.5, 8);
      const hydrantMat = new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.4 });
      const hydrant = new THREE.Mesh(hydrantGeo, hydrantMat);
      hydrant.position.set(x, 0.25, z + (i % 2 === 0 ? TILE_D / 2 + SIDEWALK_WIDTH - 0.5 : -(TILE_D / 2 + SIDEWALK_WIDTH - 0.5)));
      hydrant.castShadow = true;
      this.propGroup.add(hydrant);
    }
  }

  private buildMailboxes(): void {
    for (let i = 0; i < 48; i++) {
      if (i % 7 !== 3) continue;
      const { x, z, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      const boxGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
      const boxMat = new THREE.MeshStandardMaterial({ color: '#1565C0', roughness: 0.4 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(
        x + (i % 2 === 0 ? TILE_D / 2 + SIDEWALK_WIDTH - 0.8 : -(TILE_D / 2 + SIDEWALK_WIDTH - 0.8)),
        0.3,
        z,
      );
      box.castShadow = true;
      this.propGroup.add(box);
    }
  }

  private buildTrashCans(): void {
    for (let i = 0; i < 48; i++) {
      if (i % 6 !== 2) continue;
      const { x, z, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      const canGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.7, 8);
      const canMat = new THREE.MeshStandardMaterial({ color: '#4CAF50', roughness: 0.5 });
      const can = new THREE.Mesh(canGeo, canMat);
      can.position.set(
        x + (i % 3 === 0 ? TILE_D / 2 + SIDEWALK_WIDTH - 0.5 : -(TILE_D / 2 + SIDEWALK_WIDTH - 0.5)),
        0.35,
        z + 0.5,
      );
      can.castShadow = true;
      can.name = 'trashCan';
      this.propGroup.add(can);
    }
  }

  private buildBenches(): void {
    for (let i = 0; i < 48; i++) {
      if (i % 8 !== 4) continue;
      const { x, z, rotation, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;
      const group = new THREE.Group();
      const seatGeo = new THREE.BoxGeometry(1.2, 0.1, 0.4);
      const seatMat = new THREE.MeshStandardMaterial({ color: '#795548', roughness: 0.5 });
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.y = 0.3;
      seat.castShadow = true;
      group.add(seat);

      // Legs
      for (let l = -1; l <= 1; l += 2) {
        const legGeo = new THREE.BoxGeometry(0.08, 0.3, 0.35);
        const legMat = new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.5 });
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(l * 0.5, 0.15, 0);
        leg.castShadow = true;
        group.add(leg);
      }

      const dirX = Math.sin(rotation);
      const dirZ = Math.cos(rotation);
      group.position.set(
        x + dirX * (TILE_D / 2 + SIDEWALK_WIDTH - 0.8),
        0,
        z + dirZ * (TILE_D / 2 + SIDEWALK_WIDTH - 0.8),
      );
      group.rotation.y = rotation;
      this.propGroup.add(group);
    }
  }

  // ---- Inner City Roads ----

  private buildInnerCityRoads(): void {
    // Simplistic cross-shaped inner city roads (requirement 10.6)
    const roadMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.9 });
    const laneMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.5, emissive: '#FFD700', emissiveIntensity: 0.1 });
    const curbMat = new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.7 });

    // Main cross roads through the center
    const innerCenter = 0;
    const roadLen = 60;

    // N-S road
    const nsGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.05, roadLen);
    const ns = new THREE.Mesh(nsGeo, roadMat);
    ns.position.set(innerCenter, 0.02, innerCenter);
    ns.receiveShadow = true;
    this.roadGroup.add(ns);

    // E-W road
    const ewGeo = new THREE.BoxGeometry(roadLen, 0.05, ROAD_WIDTH);
    const ew = new THREE.Mesh(ewGeo, roadMat);
    ew.position.set(innerCenter, 0.02, innerCenter);
    ew.receiveShadow = true;
    this.roadGroup.add(ew);

    // Center line (gold dashed on N-S)
    for (let s = -30; s <= 30; s += 1.5) {
      const dashGeo = new THREE.BoxGeometry(0.12, 0.06, 1.0);
      const dash = new THREE.Mesh(dashGeo, laneMat);
      dash.position.set(innerCenter, 0.03, s);
      this.roadGroup.add(dash);
    }

    // Curb strips along roads
    for (const [dx, dz] of [[ROAD_WIDTH / 2 + 0.5, 0], [-(ROAD_WIDTH / 2 + 0.5), 0]]) {
      const curbGeo = new THREE.BoxGeometry(0.3, 0.12, roadLen);
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(innerCenter + dx, 0.06, innerCenter);
      this.roadGroup.add(curb);
    }

    // Inner city lamp posts along roads
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
          color: '#FFF9C4',
          roughness: 0.2,
          emissive: '#FFF9C4',
          emissiveIntensity: 0.5,
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
    // Add themed storefront signs
    this.applyThemeSigns();

    switch (this.theme) {
      case 'shanghai': this.buildShanghaiLandmarks(); break;
      case 'tokyo': this.buildTokyoLandmarks(); break;
      default: this.buildClassicLandmarks(); break;
    }
  }

  /** Replace generic storefront signs with themed street names */
  private applyThemeSigns(): void {
    const shanghaiRoads = ['南京路', '淮海路', '外滩', '陆家嘴', '城隍庙', '静安寺', '新天地', '田子坊'];
    const tokyoRoads = ['渋谷', '新宿', '銀座', '秋葉原', '浅草', '六本木', '原宿', 'お台場'];
    const roads = this.theme === 'shanghai' ? shanghaiRoads
      : this.theme === 'tokyo' ? tokyoRoads
      : ['Main St', 'Park Ave', 'Broadway', 'Fifth Ave', 'Wall St', 'Oak Ln', 'Elm St', 'Market St'];

    let nameIdx = 0;
    this.buildingGroup.traverse((child) => {
      if (child.name && child.name.startsWith('storefront-')) {
        const roadName = roads[nameIdx % roads.length];
        nameIdx++;
        // Update nearby sign text (we add a road name plate above the store)
        if (child instanceof THREE.Mesh) {
          this.addRoadSign(child, roadName);
        }
      }
    });
  }

  private addRoadSign(storefrontMesh: THREE.Mesh, roadName: string): void {
    const parent = storefrontMesh.parent;
    if (!parent) return;

    // Create a road name sign above the storefront
    const signGroup = new THREE.Group();

    // Sign pole
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.3, metalness: 0.5 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.4;
    signGroup.add(pole);

    // Sign plate
    const plateGeo = new THREE.BoxGeometry(1.2, 0.3, 0.08);
    const plateMat = new THREE.MeshStandardMaterial({
      color: this.theme === 'tokyo' ? '#FFFFFF' : '#2E7D32',
      roughness: 0.3,
      emissive: this.theme === 'tokyo' ? '#FFFFFF' : '#2E7D32',
      emissiveIntensity: 0.3,
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

  /** Shanghai: Oriental Pearl Tower + themed decorations */
  private buildShanghaiLandmarks(): void {
    const cx = 0, cz = 0; // center of board
    const group = new THREE.Group();
    group.name = 'oriental_pearl';

    const pearlMat = new THREE.MeshStandardMaterial({ color: '#C0C0C0', roughness: 0.2, metalness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#FF6B8A', roughness: 0.2, metalness: 0.3,
      emissive: '#FF6B8A', emissiveIntensity: 0.3 });
    const legMat = new THREE.MeshStandardMaterial({ color: '#B0B0B0', roughness: 0.3, metalness: 0.8 });

    // 3 support legs (angled)
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

    // Central shaft
    const shaftGeo = new THREE.CylinderGeometry(0.3, 0.5, 16, 12);
    const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshStandardMaterial({ color: '#D0D0D0', roughness: 0.2, metalness: 0.8 }));
    shaft.position.y = 8;
    shaft.castShadow = true;
    group.add(shaft);

    // 3 large spheres ("pearls") at different heights
    const sphereHeights = [3.5, 7.5, 12];
    const sphereRadii = [1.2, 2.0, 1.5];
    for (let i = 0; i < 3; i++) {
      // Main pearl
      const pearlGeo = new THREE.SphereGeometry(sphereRadii[i], 24, 18);
      const pearl = new THREE.Mesh(pearlGeo, pearlMat);
      pearl.position.y = sphereHeights[i];
      pearl.castShadow = true;
      group.add(pearl);

      // Glass ring around each pearl
      const ringGeo = new THREE.TorusGeometry(sphereRadii[i] + 0.15, 0.12, 12, 24);
      const ring = new THREE.Mesh(ringGeo, glassMat);
      ring.position.y = sphereHeights[i];
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    // Top antenna
    const antGeo = new THREE.CylinderGeometry(0.08, 0.15, 3, 8);
    const ant = new THREE.Mesh(antGeo, new THREE.MeshStandardMaterial({ color: '#E0E0E0', roughness: 0.2, metalness: 0.9 }));
    ant.position.y = 15;
    group.add(ant);

    // Small top sphere
    const topGeo = new THREE.SphereGeometry(0.35, 16, 12);
    const topSphere = new THREE.Mesh(topGeo, pearlMat);
    topSphere.position.y = 16.5;
    group.add(topSphere);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);

    // Register glow materials
    this.nightGlowMaterials.push(glassMat);

    // Also add a few "shikumen" style buildings near center
    this.addShikumenBuildings();
  }

  private addShikumenBuildings(): void {
    // Small traditional Shanghai lane houses near the inner city
    const positions = [
      { x: -10, z: -10 }, { x: 10, z: -10 }, { x: -10, z: 10 }, { x: 10, z: 10 },
    ];
    for (const pos of positions) {
      const group = new THREE.Group();
      const brickMat = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.6 });

      // Main building
      const bodyGeo = new THREE.BoxGeometry(3, 4, 2.5);
      const body = new THREE.Mesh(bodyGeo, brickMat);
      body.position.y = 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Traditional curved roof
      const roofGeo = new THREE.BoxGeometry(3.5, 0.3, 3);
      const roofMat = new THREE.MeshStandardMaterial({ color: '#4A3728', roughness: 0.4 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 4.15;
      roof.castShadow = true;
      group.add(roof);

      // Curved eaves (simple)
      for (let s = -1; s <= 1; s += 2) {
        const eaveGeo = new THREE.BoxGeometry(3.8, 0.1, 0.6);
        const eave = new THREE.Mesh(eaveGeo, roofMat);
        eave.position.set(0, 4.05, s * 1.6);
        group.add(eave);
      }

      // Stone gate (shikumen)
      const gateGeo = new THREE.BoxGeometry(1.2, 2.2, 0.3);
      const gateMat = new THREE.MeshStandardMaterial({ color: '#757575', roughness: 0.4, metalness: 0.3 });
      const gate = new THREE.Mesh(gateGeo, gateMat);
      gate.position.set(0, 1.1, 1.4);
      group.add(gate);

      group.position.set(pos.x, 0, pos.z);
      this.buildingGroup.add(group);
    }
  }

  /** Tokyo: Tokyo Tower + Senso-ji style elements */
  private buildTokyoLandmarks(): void {
    const cx = 0, cz = 0;
    const group = new THREE.Group();
    group.name = 'tokyo_tower';

    const redMat = new THREE.MeshStandardMaterial({ color: '#E65100', roughness: 0.3, metalness: 0.2,
      emissive: '#E65100', emissiveIntensity: 0.2 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#FAFAFA', roughness: 0.3, metalness: 0.1,
      emissive: '#FAFAFA', emissiveIntensity: 0.15 });

    // Base platform
    const baseGeo = new THREE.BoxGeometry(6, 1.5, 6);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.5 }));
    base.position.y = 0.75;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // 4 main legs (tapered using stacked boxes)
    const towerHeight = 16;
    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        for (let seg = 0; seg < 6; seg++) {
          const y = 1.5 + seg * 2.5;
          const taper = 1 - (seg / 6) * 0.7;
          const segGeo = new THREE.BoxGeometry(0.5 * taper, 2.5, 0.5 * taper);
          const color = seg % 2 === 0 ? redMat : whiteMat;
          const legSeg = new THREE.Mesh(segGeo, color);
          legSeg.position.set(lx * (2.5 * taper), y + 1.25, lz * (2.5 * taper));
          legSeg.castShadow = true;
          group.add(legSeg);
        }
      }
    }

    // Cross braces between legs (simplified lattice)
    for (let h = 0; h < 5; h++) {
      const y = 2.75 + h * 2.5;
      const taper = 1 - ((h + 0.5) / 6) * 0.7;
      const halfW = 2.5 * taper;
      // Horizontal ring
      for (let side = 0; side < 4; side++) {
        const isX = side % 2 === 0;
        const sign = side < 2 ? 1 : -1;
        const braceGeo = new THREE.BoxGeometry(isX ? halfW * 2 : 0.15, 0.2, isX ? 0.15 : halfW * 2);
        const brace = new THREE.Mesh(braceGeo, h % 2 === 0 ? redMat : whiteMat);
        brace.position.set(
          isX ? 0 : sign * halfW,
          y,
          isX ? sign * halfW : 0,
        );
        group.add(brace);
      }
    }

    // First observation deck (wider section at ~8 units)
    const deck1Geo = new THREE.BoxGeometry(5, 1, 5);
    const deck1 = new THREE.Mesh(deck1Geo, whiteMat);
    deck1.position.y = 9;
    deck1.castShadow = true;
    group.add(deck1);

    // Glass observation windows
    const glassGeo = new THREE.BoxGeometry(4.8, 0.7, 0.08);
    for (let side = 0; side < 4; side++) {
      const glass = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({
        color: '#87CEEB', roughness: 0.1, metalness: 0.2,
        emissive: '#87CEEB', emissiveIntensity: 0.3,
      }));
      glass.position.y = 9;
      const angle = (side * Math.PI) / 2;
      glass.position.x = Math.sin(angle) * 2.5;
      glass.position.z = Math.cos(angle) * 2.5;
      glass.rotation.y = angle;
      group.add(glass);
    }

    // Second observation deck (~13 units)
    const deck2Geo = new THREE.BoxGeometry(3, 0.7, 3);
    const deck2 = new THREE.Mesh(deck2Geo, redMat);
    deck2.position.y = 13;
    group.add(deck2);

    // Top antenna
    const antGeo = new THREE.CylinderGeometry(0.08, 0.2, 3, 8);
    const antMat = new THREE.MeshStandardMaterial({ color: '#E0E0E0', roughness: 0.2, metalness: 0.9 });
    const ant = new THREE.Mesh(antGeo, antMat);
    ant.position.y = 15.5;
    group.add(ant);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);

    // Add temple/pagoda nearby
    this.addPagoda(6, -8);
    this.addPagoda(-6, 8);

    // Red torii gate at entrance
    this.addToriiGate(0, 10);
  }

  private addPagoda(x: number, z: number): void {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#8D6E63', roughness: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#4A3728', roughness: 0.4 });

    // Base
    const baseGeo = new THREE.BoxGeometry(2.5, 0.5, 2.5);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.5 }));
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // 3 tiers
    for (let t = 0; t < 3; t++) {
      const tierSize = 2 - t * 0.5;
      const y = 0.5 + t * 2;
      // Body
      const bodyGeo = new THREE.BoxGeometry(tierSize, 1.5, tierSize);
      const body = new THREE.Mesh(bodyGeo, woodMat);
      body.position.y = y + 0.75;
      body.castShadow = true;
      group.add(body);
      // Roof (curved, simplified as wide box)
      const roofGeo = new THREE.BoxGeometry(tierSize + 1, 0.3, tierSize + 1);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = y + 1.65;
      roof.castShadow = true;
      group.add(roof);
      // Eaves tips (upturned corners)
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

    // Top spire
    const spireGeo = new THREE.ConeGeometry(0.2, 1.2, 8);
    const spire = new THREE.Mesh(spireGeo, new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.9 }));
    spire.position.y = 7.1;
    group.add(spire);

    group.position.set(x, 0, z);
    this.buildingGroup.add(group);
  }

  private addToriiGate(x: number, z: number): void {
    const group = new THREE.Group();
    const redMat = new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.3,
      emissive: '#E53935', emissiveIntensity: 0.2 });

    // Two vertical pillars
    for (let s = -1; s <= 1; s += 2) {
      const pillarGeo = new THREE.CylinderGeometry(0.25, 0.3, 5, 8);
      const pillar = new THREE.Mesh(pillarGeo, redMat);
      pillar.position.set(s * 2, 2.5, 0);
      pillar.castShadow = true;
      group.add(pillar);
    }

    // Top horizontal beam (kasagi)
    const topBeamGeo = new THREE.BoxGeometry(5, 0.4, 0.7);
    const topBeam = new THREE.Mesh(topBeamGeo, redMat);
    topBeam.position.y = 5.2;
    topBeam.castShadow = true;
    group.add(topBeam);

    // Second beam (nuki)
    const midBeamGeo = new THREE.BoxGeometry(4.5, 0.25, 0.5);
    const midBeam = new THREE.Mesh(midBeamGeo, redMat);
    midBeam.position.y = 4.6;
    group.add(midBeam);

    // Name plate in center
    const plateGeo = new THREE.BoxGeometry(0.6, 1.0, 0.08);
    const plateMat = new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.3,
      emissive: '#212121', emissiveIntensity: 0.1 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 4.3, 0);
    group.add(plate);

    group.position.set(x, 0, z);
    this.propGroup.add(group);
    this.nightGlowMaterials.push(redMat);
  }

  /** Classic: Clock tower monument */
  private buildClassicLandmarks(): void {
    const cx = 0, cz = 0;
    const group = new THREE.Group();
    group.name = 'clock_tower';

    const stoneMat = new THREE.MeshStandardMaterial({ color: '#D2B48C', roughness: 0.5 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#A0896E', roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.8 });

    // Base platform
    const baseGeo = new THREE.BoxGeometry(5, 1, 5);
    const base = new THREE.Mesh(baseGeo, darkStoneMat);
    base.position.y = 0.5;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Steps
    for (let s = 0; s < 3; s++) {
      const stepGeo = new THREE.BoxGeometry(5.5 + s * 1, 0.2, 5.5 + s * 1);
      const step = new THREE.Mesh(stepGeo, stoneMat);
      step.position.y = 0.1 + s * 0.2;
      group.add(step);
    }

    // Main tower shaft
    const towerGeo = new THREE.BoxGeometry(2.5, 8, 2.5);
    const tower = new THREE.Mesh(towerGeo, stoneMat);
    tower.position.y = 5;
    tower.castShadow = true;
    group.add(tower);

    // Pillars at corners
    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const pillarGeo = new THREE.CylinderGeometry(0.2, 0.25, 8, 8);
        const pillar = new THREE.Mesh(pillarGeo, darkStoneMat);
        pillar.position.set(lx * 1, 5, lz * 1);
        pillar.castShadow = true;
        group.add(pillar);
      }
    }

    // Clock face section (wider)
    const clockSectionGeo = new THREE.BoxGeometry(3.5, 2, 3.5);
    const clockSection = new THREE.Mesh(clockSectionGeo, darkStoneMat);
    clockSection.position.y = 9.5;
    clockSection.castShadow = true;
    group.add(clockSection);

    // 4 clock faces
    for (let side = 0; side < 4; side++) {
      const faceGroup = new THREE.Group();
      // Clock disc
      const discGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.05, 24);
      const disc = new THREE.Mesh(discGeo, new THREE.MeshStandardMaterial({
        color: '#FFFFF0', roughness: 0.2,
        emissive: '#FFFFF0', emissiveIntensity: 0.4,
      }));
      disc.rotation.x = Math.PI / 2;
      faceGroup.add(disc);

      // Hour hand
      const hourGeo = new THREE.BoxGeometry(0.06, 0.35, 0.03);
      const hour = new THREE.Mesh(hourGeo, new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.3 }));
      hour.position.y = 0.15;
      hour.rotation.z = (side * Math.PI) / 2;
      faceGroup.add(hour);

      // Minute hand
      const minGeo = new THREE.BoxGeometry(0.04, 0.5, 0.03);
      const min = new THREE.Mesh(minGeo, new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.3 }));
      min.position.y = 0.22;
      min.rotation.z = (side * Math.PI) / 2 + 0.5;
      faceGroup.add(min);

      // Center dot
      const dotGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const dot = new THREE.Mesh(dotGeo, goldMat);
      faceGroup.add(dot);

      const angle = (side * Math.PI) / 2;
      faceGroup.position.set(
        Math.sin(angle) * 1.8,
        9.5,
        Math.cos(angle) * 1.8,
      );
      faceGroup.rotation.y = angle;
      group.add(faceGroup);

      // Register clock face glow
      this.nightGlowMaterials.push(disc.material as THREE.MeshStandardMaterial);
    }

    // Top spire
    const spireGeo = new THREE.ConeGeometry(0.6, 2.5, 8);
    const spire = new THREE.Mesh(spireGeo, darkStoneMat);
    spire.position.y = 11.75;
    spire.castShadow = true;
    group.add(spire);

    // Gold finial
    const finialGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const finial = new THREE.Mesh(finialGeo, goldMat);
    finial.position.y = 13.1;
    group.add(finial);

    group.position.set(cx, 0.15, cz);
    this.propGroup.add(group);
  }

  // ---- Quality mode ----

  setQuality(quality: 'performance' | 'balanced'): void {
    const visible = quality === 'balanced';
    this.propGroup.visible = visible;
    // In performance mode, also reduce buildings
    this.buildingGroup.children.forEach((child, i) => {
      if (quality === 'performance') {
        // Hide every 3rd building
        child.visible = i % 3 !== 0;
      } else {
        child.visible = true;
      }
    });
  }

  // ---- Collision registration ----

  registerColliders(addBox: (center: THREE.Vector3, halfSize: THREE.Vector3) => void): void {
    // Walk through all building meshes and register their world-space AABBs
    this.buildingGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name === '' && child.geometry.type === 'BoxGeometry') {
        // Only register the main building bodies (roughly)
        const bbox = new THREE.Box3().setFromObject(child);
        const center = bbox.getCenter(new THREE.Vector3());
        const halfSize = bbox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
        if (halfSize.x > 0.5 && halfSize.y > 0.5) {
          addBox(center, halfSize);
        }
      }
    });
    // Register lamp posts as cylinder colliders (handled via box)
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
