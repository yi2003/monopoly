// ============================================================
// CityBuilder — Procedural city around the Monopoly board
// ============================================================

import * as THREE from 'three';
import type { ColorGroup, ThemeId } from '@monopoly/shared';
import { GROUP_COLORS, PROPERTIES } from '@monopoly/shared';

// ---- Configuration ----

const BOARD_HALF = 5.0 + 7 * 2.8 + 1; // matches Board.ts layout
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
  railway: { floors: [2, 3], bodyColor: '#FFD700', roofType: 'flat',   facadeType: 'concrete', windowColor: '#FFF8DC', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: false },
  utility: { floors: [2, 3], bodyColor: '#C0C0C0', roofType: 'flat',   facadeType: 'concrete', windowColor: '#F5F5F5', hasAcUnits: false, hasAntenna: false, hasFireEscape: false, hasBalcony: false },
};

// ---- Tile position helpers (matches Board.ts coordinate system) ----

const TILE_W = 2.8;
const TILE_D = 5.5;
const CORNER_SIZE = 5.0;
const BOARD_HALF_TILES = CORNER_SIZE + 7 * TILE_W;
const SIDE_LENGTH = 12;

function getTileBoardPos(index: number): { x: number; z: number; rotation: number; isCorner: boolean } {
  const isCorner = index === 0 || index === 12 || index === 24 || index === 36;
  const side = Math.floor(index / SIDE_LENGTH);
  const sideIdx = index % SIDE_LENGTH;

  let x = 0, z = 0, rotation = 0;

  switch (side) {
    case 0: // Bottom — going right
      x = -BOARD_HALF_TILES + CORNER_SIZE / 2 + sideIdx * (TILE_W + 0.15);
      z = -BOARD_HALF_TILES;
      rotation = 0;
      break;
    case 1: // Right — going up
      x = BOARD_HALF_TILES;
      z = -BOARD_HALF_TILES + CORNER_SIZE / 2 + sideIdx * (TILE_W + 0.15);
      rotation = Math.PI / 2;
      break;
    case 2: // Top — going left
      x = BOARD_HALF_TILES - CORNER_SIZE / 2 - sideIdx * (TILE_W + 0.15);
      z = BOARD_HALF_TILES;
      rotation = Math.PI;
      break;
    case 3: // Left — going down
      x = -BOARD_HALF_TILES;
      z = BOARD_HALF_TILES - CORNER_SIZE / 2 - sideIdx * (TILE_W + 0.15);
      rotation = -Math.PI / 2;
      break;
  }

  return { x, z, rotation, isCorner };
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
    this.buildOuterRing();
    this.buildStreetProps();
    this.buildInnerCityRoads();
  }

  // ---- Outer Ring Buildings ----

  private buildOuterRing(): void {
    for (let i = 0; i < 48; i++) {
      const { x, z, rotation, isCorner } = getTileBoardPos(i);
      if (isCorner) continue;

      // Determine which color group this tile belongs to
      const propDef = PROPERTIES.find(p => p.index === i);
      const group = propDef?.group || 'railway';

      // ~85% coverage for outer buildings
      const seed = i * 137 + (this.theme === 'shanghai' ? 1000 : this.theme === 'tokyo' ? 2000 : 0);
      if (seededRandom(seed) > OUTER_BUILDING_COVERAGE) continue;

      const style = STYLES[group] || STYLES.brown;
      this.createBuilding(x, z, rotation, style, seed, 'outer');

      // Inner buildings (~60% coverage), offset inward
      if (seededRandom(seed + 500) <= INNER_BUILDING_COVERAGE) {
        this.createBuilding(x, z, rotation, style, seed + 500, 'inner');
      }
    }
  }

  private createBuilding(
    tileX: number, tileZ: number, tileRot: number,
    style: BuildingStyle, seed: number, position: 'outer' | 'inner',
  ): void {
    const group = new THREE.Group();

    // Position: outer buildings behind the tile, inner buildings in front
    const depthOffset = position === 'outer'
      ? -(TILE_D / 2 + SIDEWALK_WIDTH + BUILDING_SETBACK)
      : (TILE_D / 2 + SIDEWALK_WIDTH + BUILDING_SETBACK);

    // Calculate world position
    const dirX = Math.sin(tileRot);
    const dirZ = Math.cos(tileRot);

    // Building dimensions
    const floors = style.floors[0] + Math.floor(seededRandom(seed + 10) * (style.floors[1] - style.floors[0] + 1));
    const floorHeight = 0.9;
    const buildingHeight = floors * floorHeight;
    const buildingWidth = propJitter(2.2, seed + 20, 0.6);
    const buildingDepth = propJitter(1.8, seed + 30, 0.8);

    const centerX = tileX + dirX * depthOffset;
    const centerZ = tileZ + dirZ * depthOffset;

    // Body
    const bodyGeo = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: style.bodyColor,
      roughness: style.facadeType === 'glass' ? 0.25 : 0.7,
      metalness: style.facadeType === 'glass' ? 0.6 : 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(centerX, buildingHeight / 2, centerZ);
    body.rotation.y = tileRot;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Windows (simple grid of emissive planes)
    this.addWindows(body, buildingWidth, buildingHeight, buildingDepth, style, seed, tileRot);

    // Roof
    this.addRoof(body, buildingWidth, buildingHeight, buildingDepth, style, seed, tileRot);

    // Details (AC, antenna, fire escape, balcony)
    if (style.hasAcUnits && floors >= 5) this.addAcUnit(body, buildingWidth, buildingDepth, seed, tileRot);
    if (style.hasAntenna && floors >= 7) this.addAntenna(body, buildingWidth, buildingHeight, seed, tileRot);
    if (style.hasFireEscape && floors >= 3) this.addFireEscape(body, buildingWidth, buildingHeight, buildingDepth, seed, tileRot);
    if (style.hasBalcony) this.addBalconies(body, buildingWidth, buildingHeight, buildingDepth, floors, seed, tileRot);

    // Storefront or residential ground floor
    if (position === 'outer') {
      const isStore = seededRandom(seed + 60) <= 0.6;
      if (isStore) {
        this.addStorefront(group, buildingWidth, buildingHeight, buildingDepth, centerX, centerZ, seed, tileRot, style);
      } else {
        this.addResidentialGround(group, buildingWidth, buildingDepth, centerX, centerZ, seed, tileRot);
      }
    }

    // Sidewalk slab
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

    this.buildingGroup.add(group);
  }

  private addWindows(
    body: THREE.Mesh, w: number, h: number, d: number,
    style: BuildingStyle, seed: number, rot: number,
  ): void {
    const floors = Math.floor(h / 0.9);
    const winsPerFloor = Math.floor(w / 0.8);
    const winW = 0.3;
    const winH = 0.4;
    const bodyHalfH = h / 2; // body is centered: [-bodyHalfH, +bodyHalfH] in local Y
    const floorBaseY = -bodyHalfH + 0.35; // first floor window starts near bottom of body

    for (let f = 0; f < floors; f++) {
      for (let wi = 0; wi < winsPerFloor; wi++) {
        const lit = seededRandom(seed + f * 100 + wi) > 0.35;
        const darkColor = '#' + new THREE.Color(style.windowColor).multiplyScalar(0.3).getHexString();
        const winColor = lit ? style.windowColor : darkColor;

        // Front face
        const frontGeo = new THREE.PlaneGeometry(winW, winH);
        const frontMat = new THREE.MeshStandardMaterial({
          color: winColor,
          roughness: 0.3,
          emissive: lit ? winColor : '#000000',
          emissiveIntensity: lit ? 0.4 : 0,
          side: THREE.DoubleSide,
        });
        const frontWin = new THREE.Mesh(frontGeo, frontMat);
        const wx = -w / 2 + 0.4 + wi * 0.8;
        const wy = floorBaseY + f * 0.9;
        frontWin.position.set(wx, wy, d / 2 + 0.01);
        frontWin.rotation.set(0, 0, 0);
        body.add(frontWin);

        // Register for night glow
        if (lit) this.nightGlowMaterials.push(frontMat);

        // Sometimes add windows on side faces
        if (seededRandom(seed + f * 200 + wi) > 0.5) {
          const sideGeo = new THREE.PlaneGeometry(winW * 0.7, winH);
          const sideMat = new THREE.MeshStandardMaterial({
            color: winColor,
            roughness: 0.3,
            emissive: lit ? winColor : '#000000',
            emissiveIntensity: lit ? 0.4 : 0,
            side: THREE.DoubleSide,
          });
          const sideWin = new THREE.Mesh(sideGeo, sideMat);
          sideWin.position.set(w / 2 + 0.01, wy, -d / 2 + 0.5 + wi % 2);
          sideWin.rotation.y = Math.PI / 2;
          body.add(sideWin);
          if (lit) this.nightGlowMaterials.push(sideMat);
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

  // ---- Storefront & Residential Ground Floor ----

  private addStorefront(
    parentGroup: THREE.Group, w: number, h: number, d: number,
    cx: number, cz: number, seed: number, rot: number, style: BuildingStyle,
  ): void {
    const storeTypes = ['cafe', 'restaurant', 'shop', 'hospital', 'bakery', 'bookstore', 'office'];
    const storeIdx = Math.floor(seededRandom(seed + 60) * storeTypes.length);
    const storeType = storeTypes[storeIdx];
    const storeColors: Record<string, string> = {
      cafe: '#8D6E63', restaurant: '#E53935', shop: '#43A047', hospital: '#FFFFFF',
      bakery: '#FF9800', bookstore: '#5D4037', office: '#607D8B',
    };

    const storeY = 0.25;

    // Awning
    const awningGeo = new THREE.BoxGeometry(w * 0.7, 0.15, 0.6);
    const awningMat = new THREE.MeshStandardMaterial({ color: storeColors[storeType] || '#E53935', roughness: 0.5 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(cx, storeY + 0.8, cz + (d / 2 + 0.3) * Math.cos(rot));
    awning.rotation.y = rot;
    awning.castShadow = true;
    awning.name = `storefront-${storeType}`;
    parentGroup.add(awning);

    // Awning supports (two small pillars)
    for (let s = -1; s <= 1; s += 2) {
      const pillarGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8);
      const pillarMat = new THREE.MeshStandardMaterial({ color: '#757575', roughness: 0.4, metalness: 0.4 });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      // Place at corners of awning
      const px = cx + s * w * 0.3 * Math.cos(rot);
      const pz = cz + s * w * 0.3 * Math.sin(rot);
      pillar.position.set(px, storeY + 0.45, pz + (d / 2 + 0.3) * Math.cos(rot));
      pillar.castShadow = true;
      parentGroup.add(pillar);
    }

    // Hanging sign
    const signGeo = new THREE.BoxGeometry(0.8, 0.25, 0.08);
    const signMat = new THREE.MeshStandardMaterial({
      color: storeColors[storeType] || '#E53935',
      roughness: 0.3,
      emissive: storeColors[storeType] || '#E53935',
      emissiveIntensity: 0.5,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(cx, storeY + 1.05, cz + (d / 2 + 0.6) * Math.cos(rot));
    sign.rotation.y = rot;
    parentGroup.add(sign);
    this.nightGlowMaterials.push(signMat);

    // Outdoor seating (30% chance)
    if (seededRandom(seed + 65) < 0.3 && (storeType === 'cafe' || storeType === 'restaurant')) {
      this.addOutdoorSeating(parentGroup, cx, cz, rot, seed);
    }

    // Hospital red cross
    if (storeType === 'hospital') {
      const crossHGeo = new THREE.BoxGeometry(0.2, 0.6, 0.05);
      const crossVGeo = new THREE.BoxGeometry(0.6, 0.2, 0.05);
      const crossMat = new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.3, emissive: '#E53935', emissiveIntensity: 0.5 });
      const crossH = new THREE.Mesh(crossHGeo, crossMat);
      const crossV = new THREE.Mesh(crossVGeo, crossMat);
      const crossY = storeY + 1.0;
      crossH.position.set(cx, crossY, cz + (d / 2 + 0.05) * Math.cos(rot));
      crossV.position.set(cx, crossY, cz + (d / 2 + 0.05) * Math.cos(rot));
      parentGroup.add(crossH);
      parentGroup.add(crossV);
      this.nightGlowMaterials.push(crossMat);
    }
  }

  private addResidentialGround(
    parentGroup: THREE.Group, w: number, d: number,
    cx: number, cz: number, seed: number, rot: number,
  ): void {
    // Doorstep / porch
    const porchGeo = new THREE.BoxGeometry(0.6, 0.15, 0.5);
    const porchMat = new THREE.MeshStandardMaterial({ color: '#795548', roughness: 0.6 });
    const porch = new THREE.Mesh(porchGeo, porchMat);
    porch.position.set(cx, 0.08, cz + (d / 2 + 0.25) * Math.cos(rot));
    porch.rotation.y = rot;
    porch.receiveShadow = true;
    parentGroup.add(porch);

    // Flower boxes (50% chance)
    if (seededRandom(seed + 68) < 0.5) {
      const boxGeo = new THREE.BoxGeometry(0.5, 0.2, 0.25);
      const boxMat = new THREE.MeshStandardMaterial({ color: '#6D4C41', roughness: 0.6 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(cx + w * 0.15, 0.3, cz + (d / 2 + 0.15) * Math.cos(rot));
      box.rotation.y = rot;
      parentGroup.add(box);

      // Small flower blob
      const flowerGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const flowerColors = ['#E91E63', '#FF5722', '#FFEB3B', '#4CAF50'];
      for (let i = 0; i < 3; i++) {
        const flowerMat = new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.5 });
        const flower = new THREE.Mesh(flowerGeo, flowerMat);
        flower.position.set(
          cx + w * 0.15 + (i - 1) * 0.15,
          0.42,
          cz + (d / 2 + 0.15) * Math.cos(rot),
        );
        parentGroup.add(flower);
      }
    }
  }

  private addOutdoorSeating(group: THREE.Group, cx: number, cz: number, rot: number, seed: number): void {
    for (let t = 0; t < 2; t++) {
      // Small table
      const tableGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8);
      const tableMat = new THREE.MeshStandardMaterial({ color: '#795548', roughness: 0.5 });
      const table = new THREE.Mesh(tableGeo, tableMat);
      const dist = 1.2 + t * 0.8;
      table.position.set(cx + (t - 0.5) * 1.2, 0.15, cz + dist * Math.cos(rot));
      table.castShadow = true;
      group.add(table);

      // Two chairs
      for (let c = 0; c < 2; c++) {
        const chairGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
        const chairMat = new THREE.MeshStandardMaterial({ color: '#424242', roughness: 0.4, metalness: 0.3 });
        const chair = new THREE.Mesh(chairGeo, chairMat);
        chair.position.set(
          cx + (t - 0.5) * 1.2 + (c === 0 ? 0.35 : -0.35),
          0.125,
          cz + dist * Math.cos(rot) + (c === 0 ? 0 : 0),
        );
        chair.castShadow = true;
        group.add(chair);
      }
    }
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
