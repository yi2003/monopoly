// ============================================================
// Board — inner ground-ring tiles (0-59) + outer ground-ring tiles (84-143)
// ============================================================

import * as THREE from 'three';
import type { GameState, Tile } from '@monopoly/shared';
import { getModelClone } from './ModelLoader';
import { TREE_MODEL_URL } from './CityBuilder';
import { tileSlabTex } from '../textures/surfaces';
import { tex } from '../util/canvas';

/** Cached "JAIL" sign texture for the prison model (dark plate with white letters). */
function jailSignTex(): THREE.Texture {
  return tex('jail-sign', 256, 64, (x, w, h) => {
    x.fillStyle = '#263238';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#B0BEC5';
    x.lineWidth = 6;
    x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = '#ECEFF1';
    x.font = `700 ${Math.floor(h * 0.62)}px "Barlow Condensed", Impact, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('JAIL', w / 2, h * 0.54);
  });
}
import {
  GROUP_COLORS, ALL_PROPERTIES, ALL_RAILWAYS, ALL_UTILITIES,
  TILE_W, TILE_D, CORNER_SIZE, INNER_BOARD_HALF, OUTER_BOARD_HALF,
  GROUND_INNER_RING_SIZE, GROUND_OUTER_RING_SIZE, OUTER_RING_OFFSET,
  getGroundTilePosition, isCornerIndex, createTiles,
} from '@monopoly/shared';

export class Board {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private tiles: Tile[] = [];
  private tileMeshes: Map<number, THREE.Group> = new Map();
  private ownerRings: Map<number, THREE.Mesh> = new Map();

  // Materials that change with era
  private baseMat!: THREE.MeshStandardMaterial;
  private frameMat!: THREE.MeshStandardMaterial;
  private innerSlabMaterials: THREE.MeshStandardMaterial[] = [];
  private outerSlabMaterials: THREE.MeshStandardMaterial[] = [];
  private goldMaterials: THREE.MeshStandardMaterial[] = []; // trim, pillars, arena ring, etc.
  private arenaMat!: THREE.MeshStandardMaterial;
  private slabMeshes: { mesh: THREE.Mesh; isOuter: boolean }[] = [];
  private currentEra = '2025';

  get boardGroup(): THREE.Group { return this.group; }

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.tiles = createTiles();
    this.build();
  }

  setEra(era: string): void {
    if (this.currentEra === era) return;
    this.currentEra = era;
    this.applyEraColors();
  }

  /** Era-responsive colors for board base, frame, tile slabs, and gold trim */
  private applyEraColors(): void {
    const eraColors: Record<string, { base: string; frame: string; innerSlab: string; outerSlab: string; gold: string; goldEmissive: string; arena: string }> = {
      '1945':   { base: '#3d5a2a', frame: '#4a3028', innerSlab: '#b8a898', outerSlab: '#a09888', gold: '#8a7a3a', goldEmissive: '#4a3a10', arena: '#2a1a10' },
      '1985':   { base: '#2a4a2a', frame: '#3a2828', innerSlab: '#c0b0a0', outerSlab: '#a89890', gold: '#daa520', goldEmissive: '#8040a0', arena: '#1a1028' },
      '2025':   { base: '#2E7D32', frame: '#5D4037', innerSlab: '#D7CCC8', outerSlab: '#BDB5A8', gold: '#FFD700', goldEmissive: '#996600', arena: '#3E2723' },
      '2055':   { base: '#1a3830', frame: '#1a2828', innerSlab: '#c8d8c8', outerSlab: '#b0c8b0', gold: '#80d0c0', goldEmissive: '#206050', arena: '#0a2018' },
    };
    const c = eraColors[this.currentEra] || eraColors['2025'];

    this.baseMat.color.set(c.base);
    this.frameMat.color.set(c.frame);
    for (const m of this.innerSlabMaterials) m.color.set(c.innerSlab);
    for (const m of this.outerSlabMaterials) m.color.set(c.outerSlab);
    for (const m of this.goldMaterials) {
      m.color.set(c.gold);
      m.emissive.set(c.goldEmissive);
    }
    this.arenaMat.color.set(c.arena);

    // Regenerate slab textures for new era
    const newTex = tileSlabTex(this.currentEra);
    for (const sm of this.innerSlabMaterials) {
      sm.map = newTex;
      sm.color.set('#ffffff'); // tint through texture only
      sm.needsUpdate = true;
    }
    for (const sm of this.outerSlabMaterials) {
      sm.map = newTex;
      sm.color.set('#ffffff');
      sm.needsUpdate = true;
    }

    // Shape variations per era
    for (const { mesh, isOuter } of this.slabMeshes) {
      if (this.currentEra === '1945') {
        // Uneven/worn surface: slight random tilt and height
        mesh.position.y = 0.05 + (Math.sin(mesh.position.x * 3.7) * Math.cos(mesh.position.z * 2.9)) * 0.06;
        mesh.rotation.x = (Math.sin(mesh.position.z * 5.1)) * 0.015;
        mesh.rotation.z = (Math.cos(mesh.position.x * 4.3)) * 0.015;
      } else {
        mesh.position.y = 0.05;
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
      }
    }
  }

  private build(): void {
    const outerExtent = OUTER_BOARD_HALF + 3;

    // Base platform
    const baseGeo = new THREE.BoxGeometry(outerExtent * 2 + 4, 1.5, outerExtent * 2 + 4);
    this.baseMat = new THREE.MeshStandardMaterial({ color: '#2E7D32', roughness: 0.6 });
    const base = new THREE.Mesh(baseGeo, this.baseMat);
    base.position.y = -1.5;
    base.receiveShadow = true;
    base.castShadow = true;
    this.group.add(base);

    // Wooden border frame
    const frameGeo = new THREE.BoxGeometry(outerExtent * 2 + 2, 0.6, outerExtent * 2 + 2);
    this.frameMat = new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.4, metalness: 0.1 });
    const frame = new THREE.Mesh(frameGeo, this.frameMat);
    frame.position.y = -0.5;
    frame.receiveShadow = true;
    this.group.add(frame);

    // Gold trim
    const trimGeo = new THREE.BoxGeometry(outerExtent * 2 + 2.2, 0.1, outerExtent * 2 + 2.2);
    const trimMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.3, metalness: 0.8, emissive: '#996600', emissiveIntensity: 0.3 });
    this.goldMaterials.push(trimMat);
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = -0.2;
    this.group.add(trim);

    // Center dice arena
    const arenaGeo = new THREE.CylinderGeometry(8, 8, 0.3, 48);
    this.arenaMat = new THREE.MeshStandardMaterial({ color: '#3E2723', roughness: 0.5 });
    const arena = new THREE.Mesh(arenaGeo, this.arenaMat);
    arena.position.y = 0.01;
    arena.receiveShadow = true;
    this.group.add(arena);

    // Gold ring around arena
    const ringGeo = new THREE.TorusGeometry(8.2, 0.3, 16, 48);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.3, metalness: 0.8 });
    this.goldMaterials.push(ringMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    this.group.add(ring);

    // Build inner ring tiles (0-47)
    for (let i = 0; i < GROUND_INNER_RING_SIZE; i++) {
      this.buildTile(i);
    }

    // Build outer ring tiles (72-119)
    for (let i = OUTER_RING_OFFSET; i < OUTER_RING_OFFSET + GROUND_OUTER_RING_SIZE; i++) {
      this.buildTile(i);
    }
  }

  /** Tile type for an index, from the shared tile definitions (data-driven, no magic indices). */
  private tileType(index: number): Tile['type'] | undefined {
    return this.tiles[index]?.type;
  }

  /** Which utility variant a tile is, for its marker. */
  private utilityKind(index: number): 'electric' | 'water' | 'telecom' | 'gas' | undefined {
    const def = ALL_UTILITIES.find(u => u.index === index);
    if (!def) return undefined;
    if (def.nameEN.includes('Electric')) return 'electric';
    if (def.nameEN.includes('Water')) return 'water';
    if (def.nameEN.includes('Telecom')) return 'telecom';
    return 'gas';
  }

  private buildTile(index: number): void {
    const pos = getGroundTilePosition(index);
    const tileGroup = new THREE.Group();
    tileGroup.position.set(pos.x, 0, pos.z);
    tileGroup.rotation.y = pos.rotation;

    const isCorner = isCornerIndex(index);
    const isOuter = index >= OUTER_RING_OFFSET;

    // Era-textured slab
    const slabGeo = new THREE.BoxGeometry(
      isCorner ? CORNER_SIZE : TILE_W,
      0.3,
      isCorner ? CORNER_SIZE : TILE_D,
    );
    const slabTex = tileSlabTex(this.currentEra);
    const slabMat = new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.75, color: '#ffffff' });
    (isOuter ? this.outerSlabMaterials : this.innerSlabMaterials).push(slabMat);
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.y = 0.05;
    slab.receiveShadow = true;
    slab.castShadow = true;
    this.slabMeshes.push({ mesh: slab, isOuter });
    tileGroup.add(slab);

    // Color strip for properties
    const propDef = ALL_PROPERTIES.find(p => p.index === index);
    if (propDef) {
      const colorHex = GROUP_COLORS[propDef.group];
      const stripGeo = new THREE.BoxGeometry(TILE_W, 0.08, 0.6);
      const stripMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, emissive: colorHex, emissiveIntensity: 0.2 });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(0, 0.22, -TILE_D / 2 + 0.5);
      tileGroup.add(strip);

      // Canvas-like name label (small colored plate)
      const labelGeo = new THREE.BoxGeometry(TILE_W * 0.7, 0.05, 0.8);
      const labelMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.5 });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.position.set(0, 0.18, TILE_D / 2 - 0.6);
      tileGroup.add(label);
    }

    // Railway marker
    if (ALL_RAILWAYS.some(r => r.index === index)) {
      const markerGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8);
      const markerMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.3, metalness: 0.7 });
      this.goldMaterials.push(markerMat);
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(0, 0.5, TILE_D / 2 - 0.6);
      tileGroup.add(marker);
    }

    // Utility icon
    const utilKind = this.utilityKind(index);
    if (utilKind) {
      const iconColor = utilKind === 'electric' ? '#FFD700' : utilKind === 'water' ? '#2196F3' : utilKind === 'telecom' ? '#00E5FF' : '#FF9800';
      const iconEmissive = utilKind === 'electric' ? '#FFA000' : utilKind === 'water' ? '#1565C0' : utilKind === 'telecom' ? '#00838F' : '#E65100';
      const iconGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const iconMat = new THREE.MeshStandardMaterial({ color: iconColor, roughness: 0.2, emissive: iconEmissive, emissiveIntensity: 0.4 });
      const icon = new THREE.Mesh(iconGeo, iconMat);
      icon.position.set(0, 0.45, 0);
      tileGroup.add(icon);
    }

    // Special tiles
    if (this.tileType(index) === 'go') {
      // GO: golden arrow
      const arrowShape = new THREE.Shape();
      arrowShape.moveTo(0, 0.5);
      arrowShape.lineTo(1, 0.5);
      arrowShape.lineTo(1, 1);
      arrowShape.lineTo(1.8, 0);
      arrowShape.lineTo(1, -1);
      arrowShape.lineTo(1, -0.5);
      arrowShape.lineTo(0, -0.5);
      arrowShape.closePath();
      const extrudeSettings = { depth: 0.15, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 };
      const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, extrudeSettings);
      const arrowMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.9 });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.scale.set(1.2, 1.2, 1);
      arrow.position.set(-0.5, 0.2, -TILE_D / 2 + 1);
      arrow.rotation.x = -Math.PI / 2;
      tileGroup.add(arrow);
    }

    if (this.tileType(index) === 'jail') {
      // Jail: stylized prison model (cell block + guard tower + barred gate + JAIL sign)
      this.buildJailModel(tileGroup);
    }

    if (this.tileType(index) === 'stock_market') {
      // Stock market: bar chart
      const barData = [0.6, 0.9, 0.5, 1.2, 0.8];
      barData.forEach((h, b) => {
        const barGeo = new THREE.BoxGeometry(0.2, h, 0.2);
        const barMat = new THREE.MeshStandardMaterial({
          color: b % 2 === 0 ? '#4CAF50' : '#E53935',
          roughness: 0.3,
        });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(-0.6 + b * 0.3, 0.2 + h / 2, -1);
        tileGroup.add(bar);
      });
    }

    if (this.tileType(index) === 'wheel') {
      // Wheel: circular disc with sectors
      const discGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.1, 32);
      const discMat = new THREE.MeshStandardMaterial({ color: '#FF6F00', roughness: 0.4 });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.y = 0.25;
      tileGroup.add(disc);
      // Colored sector markers
      const sectorColors = ['#4CAF50', '#66BB6A', '#2E7D32', '#EF5350', '#E53935', '#424242', '#FFD700'];
      for (let s = 0; s < 7; s++) {
        const markerGeo = new THREE.BoxGeometry(0.08, 0.12, 0.8);
        const marker = new THREE.Mesh(markerGeo, new THREE.MeshStandardMaterial({ color: sectorColors[s], roughness: 0.3 }));
        const angle = (s / 7) * Math.PI * 2;
        marker.position.set(Math.cos(angle) * 0.7, 0.32, Math.sin(angle) * 0.7);
        marker.rotation.y = -angle;
        tileGroup.add(marker);
      }
    }

    // Chance: spinning "?" cube
    if (this.tileType(index) === 'chance') {
      const qGroup = new THREE.Group();
      const qGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
      const qMat = new THREE.MeshStandardMaterial({ color: '#FF9800', roughness: 0.3, emissive: '#FF9800', emissiveIntensity: 0.3 });
      const qCube = new THREE.Mesh(qGeo, qMat);
      qCube.position.y = 0.45;
      qCube.name = 'chanceCube';
      qGroup.add(qCube);
      qGroup.position.set(0, 0, -TILE_D / 2 + 1.2);
      tileGroup.add(qGroup);
    }

    // Community Chest: treasure chest
    if (this.tileType(index) === 'community_chest') {
      const chestGroup = new THREE.Group();
      // Base box
      const chestGeo = new THREE.BoxGeometry(0.6, 0.4, 0.4);
      const chestMat = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.4 });
      const chest = new THREE.Mesh(chestGeo, chestMat);
      chest.position.y = 0.35;
      chestGroup.add(chest);
      // Lid
      const lidGeo = new THREE.BoxGeometry(0.6, 0.15, 0.2);
      const lidMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.8 });
      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.position.set(0, 0.6, -0.1);
      chestGroup.add(lid);
      // Lock
      const lockGeo = new THREE.SphereGeometry(0.06, 8, 8);
      const lock = new THREE.Mesh(lockGeo, new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.9 }));
      lock.position.set(0, 0.52, 0.15);
      chestGroup.add(lock);
      chestGroup.position.set(0, 0, -TILE_D / 2 + 1.2);
      tileGroup.add(chestGroup);
    }

    // Tax: gold coin stack
    if (this.tileType(index) === 'tax') {
      for (let c = 0; c < 3; c++) {
        const coinGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
        const coinMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.9 });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.position.set((c - 1) * 0.3, 0.15 + c * 0.1, -TILE_D / 2 + 1.5);
        coin.rotation.x = Math.PI / 2;
        tileGroup.add(coin);
      }
    }

    // Railway: small locomotive
    const railDef = ALL_RAILWAYS.find(r => r.index === index);
    if (railDef) {
      const locoGroup = new THREE.Group();
      // Boiler
      const boilerGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
      const boiler = new THREE.Mesh(boilerGeo, new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.3, metalness: 0.7 }));
      boiler.rotation.z = Math.PI / 2;
      boiler.position.y = 0.25;
      locoGroup.add(boiler);
      // Cab
      const cabGeo = new THREE.BoxGeometry(0.3, 0.3, 0.25);
      const cab = new THREE.Mesh(cabGeo, new THREE.MeshStandardMaterial({ color: '#E53935', roughness: 0.4 }));
      cab.position.set(0.35, 0.3, 0);
      locoGroup.add(cab);
      // Wheels (small cylinders)
      for (let w = -1; w <= 1; w += 2) {
        const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
        const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#616161', roughness: 0.4, metalness: 0.5 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(w * 0.2, 0.08, 0);
        locoGroup.add(wheel);
      }
      locoGroup.position.set(0, 0, TILE_D / 2 - 1.0);
      tileGroup.add(locoGroup);
    }

    // Electric Company: lightning bolt
    if (utilKind === 'electric') {
      const boltShape = new THREE.Shape();
      boltShape.moveTo(0, 0);
      boltShape.lineTo(0.25, 0.6);
      boltShape.lineTo(0.1, 0.6);
      boltShape.lineTo(0.35, 1.2);
      boltShape.lineTo(0.1, 0.65);
      boltShape.lineTo(0.25, 0.65);
      boltShape.closePath();
      const boltGeo = new THREE.ExtrudeGeometry(boltShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
      const boltMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.8, emissive: '#FFA000', emissiveIntensity: 0.4 });
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.scale.set(0.8, 0.8, 1);
      bolt.position.set(0, 0.15, 0);
      bolt.rotation.x = -Math.PI / 2;
      tileGroup.add(bolt);
    }

    // Water Works: water droplet
    if (utilKind === 'water') {
      const dropGeo = new THREE.SphereGeometry(0.25, 12, 12);
      dropGeo.scale(1, 1.3, 1);
      const drop = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color: '#2196F3', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 }));
      drop.position.set(0, 0.35, 0);
      tileGroup.add(drop);
      // Small splash ring
      const splashGeo = new THREE.TorusGeometry(0.25, 0.04, 8, 16);
      const splash = new THREE.Mesh(splashGeo, new THREE.MeshStandardMaterial({ color: '#64B5F6', roughness: 0.2 }));
      splash.rotation.x = -Math.PI / 2;
      splash.position.set(0, 0.16, 0);
      tileGroup.add(splash);
    }

    // Tree placeholder — actual GLB tree planted after preload
    if (propDef) {
      const placeholder = new THREE.Group();
      placeholder.name = 'tree-placeholder';
      placeholder.position.set(TILE_W / 2 - 0.4, 0, TILE_D / 2 - 0.7);
      tileGroup.add(placeholder);
    }

    // Go To Jail: police badge
    if (this.tileType(index) === 'goto_jail') {
      const badgeGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 6);
      const badge = new THREE.Mesh(badgeGeo, new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.9 }));
      badge.position.set(0, 0.25, TILE_D / 2 - 1.2);
      badge.rotation.x = -Math.PI / 2;
      tileGroup.add(badge);
    }

    // Corner treatments
    if (isCornerIndex(index)) {
      // Jail corners carry a full prison model above instead of the generic gold pillar
      if (this.tileType(index) !== 'jail') {
        const cornerPillarGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.0, 8);
        const cornerPillarMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.3, metalness: 0.8 });
        this.goldMaterials.push(cornerPillarMat);
        const pillar = new THREE.Mesh(cornerPillarGeo, cornerPillarMat);
        pillar.position.set(0, 0.6, 0);
        tileGroup.add(pillar);
      }
    }

    this.group.add(tileGroup);
    this.tileMeshes.set(index, tileGroup);
  }

  /**
   * Stylized prison model for a Jail corner tile — a cell block with barred windows,
   * a guard tower with a beacon lamp, a barred fence enclosure and a front gate
   * topped with a "JAIL" sign. Built from primitives to match the board's toy aesthetic.
   */
  private buildJailModel(group: THREE.Group): void {
    const stone = new THREE.MeshStandardMaterial({ color: '#8D8D8D', roughness: 0.85 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: '#616161', roughness: 0.8 });
    const barMat = new THREE.MeshStandardMaterial({ color: '#37474F', roughness: 0.3, metalness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#455A64', roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.4 });

    /** Vertical bar of the given height, centered at y. */
    const bar = (x: number, y: number, z: number, h: number): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 8), barMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };

    // Foundation slab
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 3.6), stoneDark);
    foundation.position.y = 0.09;
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    group.add(foundation);

    // ---- Cell block (back) ----
    const cellBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 1.0), stone);
    cellBody.position.set(0, 0.65, -0.95);
    cellBody.castShadow = true;
    cellBody.receiveShadow = true;
    group.add(cellBody);

    const cellRoof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 1.2), roofMat);
    cellRoof.position.set(0, 1.37, -0.95);
    cellRoof.castShadow = true;
    group.add(cellRoof);

    // Barred windows on the front face (facing the yard)
    const frontZ = -0.42;
    for (const wx of [-0.75, 0, 0.75]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05), darkMat);
      win.position.set(wx, 0.75, frontZ);
      group.add(win);
      for (let bx = -0.18; bx <= 0.18; bx += 0.12) {
        group.add(bar(wx + bx, 0.75, frontZ + 0.04, 0.5));
      }
    }
    // Rail above the windows
    const winRail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 0.07), barMat);
    winRail.position.set(0, 1.05, frontZ + 0.04);
    group.add(winRail);

    // ---- Guard tower (front-right) ----
    const tx = 1.35, tz = 1.15;
    const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.9, 10), stone);
    towerBase.position.set(tx, 0.45, tz);
    towerBase.castShadow = true;
    group.add(towerBase);

    const platform = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 1.05), stoneDark);
    platform.position.set(tx, 0.96, tz);
    platform.castShadow = true;
    group.add(platform);

    for (const s of [-1, 1]) {
      const pwX = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.26, 0.09), stone);
      pwX.position.set(tx + s * 0.48, 1.15, tz);
      pwX.castShadow = true;
      group.add(pwX);
      const pwZ = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 1.05), stone);
      pwZ.position.set(tx, 1.15, tz + s * 0.48);
      pwZ.castShadow = true;
      group.add(pwZ);
    }

    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.55, 10), roofMat);
    cone.position.set(tx, 1.56, tz);
    cone.castShadow = true;
    group.add(cone);

    // Beacon lamp on the tower top
    const lampMat = new THREE.MeshStandardMaterial({ color: '#FFC107', emissive: '#FFB300', emissiveIntensity: 1.6, roughness: 0.3 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), lampMat);
    lamp.position.set(tx, 1.92, tz);
    group.add(lamp);

    // ---- Barred fence (left + back) ----
    const addFence = (axis: 'x' | 'z', pos: number, along: number): void => {
      const railGeo = axis === 'x'
        ? new THREE.BoxGeometry(0.07, 0.08, along)
        : new THREE.BoxGeometry(along, 0.08, 0.07);
      const rBot = new THREE.Mesh(railGeo, barMat);
      rBot.position.set(axis === 'x' ? pos : 0, 0.2, axis === 'x' ? 0 : pos);
      group.add(rBot);
      const rTop = new THREE.Mesh(railGeo.clone(), barMat);
      rTop.position.set(axis === 'x' ? pos : 0, 0.85, axis === 'x' ? 0 : pos);
      group.add(rTop);
      for (let d = -1.1; d <= 1.1; d += 0.28) {
        if (axis === 'x') group.add(bar(pos, 0.52, d, 0.75));
        else group.add(bar(d, 0.52, pos, 0.75));
      }
    };
    addFence('x', -1.6, 2.4); // left wall
    addFence('z', -1.6, 2.4); // back wall

    // ---- Front gate with vertical bars ----
    const gateZ = 1.6;
    for (const gx of [-1.0, 1.0]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.16), stoneDark);
      post.position.set(gx, 0.65, gateZ);
      post.castShadow = true;
      group.add(post);
    }
    const gRail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.1), barMat);
    gRail.position.set(0, 1.3, gateZ);
    group.add(gRail);
    for (let gx = -0.8; gx <= 0.8; gx += 0.32) {
      group.add(bar(gx, 0.7, gateZ, 0.95));
    }

    // "JAIL" sign plate above the gate (double-sided so it reads from any camera angle)
    const signMat = new THREE.MeshStandardMaterial({ map: jailSignTex(), roughness: 0.5, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), signMat);
    sign.position.set(0, 1.55, gateZ + 0.03);
    group.add(sign);
    // Small sign posts
    for (const sx of [-0.65, 0.65]) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), barMat);
      sp.position.set(sx, 1.35, gateZ);
      group.add(sp);
    }
  }

  /** Replace tree placeholders with actual GLB models (call after preload) */
  plantTrees(): void {
    for (const [idx, tileGroup] of this.tileMeshes) {
      const placeholder = tileGroup.getObjectByName('tree-placeholder');
      if (!placeholder) continue;
      const tree = getModelClone(TREE_MODEL_URL);
      if (!tree) continue;
      tree.scale.setScalar(0.8 + Math.random() * 0.3);
      // Use bounding box to ground the tree properly
      const bbox = new THREE.Box3().setFromObject(tree);
      tree.position.copy(placeholder.position);
      tree.position.y = -bbox.min.y * tree.scale.y; // bottom of tree at ground level
      tree.rotation.y = Math.random() * Math.PI * 2;
      tileGroup.add(tree);
      tileGroup.remove(placeholder);
    }
  }

  update(_state: GameState): void {
    // Spin chance cubes
    const time = Date.now() * 0.001;
    for (const [idx, tileGroup] of this.tileMeshes) {
      if (this.tileType(idx) === 'chance') {
        const qCube = tileGroup.getObjectByName('chanceCube');
        if (qCube) {
          qCube.rotation.y += 0.02;
          qCube.position.y = 0.45 + Math.sin(time * 3 + idx) * 0.1;
        }
      }
    }

    // Update owner indicators
    for (const player of _state.players) {
      for (const propIdx of player.properties) {
        const ring = this.ownerRings.get(propIdx);
        if (!ring) {
          const tileGroup = this.tileMeshes.get(propIdx);
          if (!tileGroup) continue;

          const ringGeo = new THREE.TorusGeometry(0.6, 0.1, 8, 16);
          const ringMat = new THREE.MeshStandardMaterial({
            color: player.color,
            roughness: 0.3,
            emissive: player.color,
            emissiveIntensity: 0.3,
          });
          const newRing = new THREE.Mesh(ringGeo, ringMat);
          newRing.rotation.x = -Math.PI / 2;
          newRing.position.y = 0.25;
          tileGroup.add(newRing);
          this.ownerRings.set(propIdx, newRing);
        }
      }
    }
  }

  updateTime(_dt: number): void {
    // Called every frame for continuous animations
  }

  dispose(): void {
    this.group.clear();
    this.tileMeshes.clear();
    this.ownerRings.clear();
  }
}
