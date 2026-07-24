// ============================================================
// Board — inner ground-ring tiles (0-47) + outer ground-ring tiles (72-119)
// ============================================================

import * as THREE from 'three';
import type { GameState } from '@monopoly/shared';
import {
  GROUP_COLORS, ALL_PROPERTIES, ALL_RAILWAYS, ALL_UTILITIES,
  TILE_W, TILE_D, CORNER_SIZE, INNER_BOARD_HALF, OUTER_BOARD_HALF,
  GROUND_INNER_RING_SIZE, GROUND_OUTER_RING_SIZE, OUTER_RING_OFFSET,
  getGroundTilePosition, isCornerIndex,
} from '@monopoly/shared';

export class Board {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private tileMeshes: Map<number, THREE.Group> = new Map();
  private ownerRings: Map<number, THREE.Mesh> = new Map();

  get boardGroup(): THREE.Group { return this.group; }

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.build();
  }

  private build(): void {
    const outerExtent = OUTER_BOARD_HALF + 3;

    // Base platform (green base)
    const baseGeo = new THREE.BoxGeometry(outerExtent * 2 + 4, 1.5, outerExtent * 2 + 4);
    const baseMat = new THREE.MeshStandardMaterial({ color: '#2E7D32', roughness: 0.6 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -1.5;
    base.receiveShadow = true;
    base.castShadow = true;
    this.group.add(base);

    // Wooden border frame
    const frameGeo = new THREE.BoxGeometry(outerExtent * 2 + 2, 0.6, outerExtent * 2 + 2);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.4, metalness: 0.1 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = -0.5;
    frame.receiveShadow = true;
    this.group.add(frame);

    // Gold trim
    const trimGeo = new THREE.BoxGeometry(outerExtent * 2 + 2.2, 0.1, outerExtent * 2 + 2.2);
    const trimMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.3, metalness: 0.8, emissive: '#996600', emissiveIntensity: 0.3 });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = -0.2;
    this.group.add(trim);

    // Center dice arena
    const arenaGeo = new THREE.CylinderGeometry(8, 8, 0.3, 48);
    const arenaMat = new THREE.MeshStandardMaterial({ color: '#3E2723', roughness: 0.5 });
    const arena = new THREE.Mesh(arenaGeo, arenaMat);
    arena.position.y = 0.01;
    arena.receiveShadow = true;
    this.group.add(arena);

    // Gold ring around arena
    const ringGeo = new THREE.TorusGeometry(8.2, 0.3, 16, 48);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.3, metalness: 0.8 });
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

  private buildTile(index: number): void {
    const pos = getGroundTilePosition(index);
    const tileGroup = new THREE.Group();
    tileGroup.position.set(pos.x, 0, pos.z);
    tileGroup.rotation.y = pos.rotation;

    const isCorner = isCornerIndex(index);
    const isOuter = index >= OUTER_RING_OFFSET;

    // Concrete slab
    const slabGeo = new THREE.BoxGeometry(
      isCorner ? CORNER_SIZE : TILE_W,
      0.3,
      isCorner ? CORNER_SIZE : TILE_D,
    );
    const slabColor = isOuter ? '#BDB5A8' : '#D7CCC8';
    const slabMat = new THREE.MeshStandardMaterial({ color: slabColor, roughness: 0.7 });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.y = 0.05;
    slab.receiveShadow = true;
    slab.castShadow = true;
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
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(0, 0.5, TILE_D / 2 - 0.6);
      tileGroup.add(marker);
    }

    // Utility icon
    if (ALL_UTILITIES.some(u => u.index === index)) {
      const iconGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const iconMat = new THREE.MeshStandardMaterial({
        color: index === 14 ? '#FFD700' : '#2196F3',
        roughness: 0.2,
        emissive: index === 14 ? '#FFA000' : '#1565C0',
        emissiveIntensity: 0.4,
      });
      const icon = new THREE.Mesh(iconGeo, iconMat);
      icon.position.set(0, 0.45, 0);
      tileGroup.add(icon);
    }

    // Special tiles
    if (index === 0) {
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

    if (index === 12) {
      // Jail: bars
      for (let b = 0; b < 4; b++) {
        const barGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8);
        const barMat = new THREE.MeshStandardMaterial({ color: '#616161', roughness: 0.3, metalness: 0.6 });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set(-0.6 + b * 0.4, 0.8, -TILE_D / 2 + 1.5);
        tileGroup.add(bar);
      }
    }

    if (index === 24) {
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

    if (index === 38) {
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
    if ([7, 26, 42].includes(index)) {
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
    if ([2, 19].includes(index)) {
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
    if ([4, 46].includes(index)) {
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
    if (index === 14) {
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
    if (index === 32) {
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

    // Property: small decorative tree
    if (propDef && ![1, 3, 6, 8, 9, 10, 13, 14, 15, 16, 18, 20, 21, 22, 23, 25, 27, 28, 30, 31, 32, 33, 34, 37, 39, 40, 43, 44, 45, 47].includes(index)) {
      // Only add trees to some properties to avoid clutter — let's do all properties
    }
    if (propDef) {
      // Small tree decoration
      const trunkGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8);
      const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#795548', roughness: 0.6 }));
      trunk.position.set(TILE_W / 2 - 0.4, 0.35, TILE_D / 2 - 0.7);
      tileGroup.add(trunk);
      const leavesGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
      const leaves = new THREE.Mesh(leavesGeo, new THREE.MeshStandardMaterial({ color: '#4CAF50', roughness: 0.5 }));
      leaves.position.set(TILE_W / 2 - 0.4, 0.6, TILE_D / 2 - 0.7);
      leaves.castShadow = true;
      tileGroup.add(leaves);
    }

    // Go To Jail: police badge
    if (index === 36) {
      const badgeGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 6);
      const badge = new THREE.Mesh(badgeGeo, new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.2, metalness: 0.9 }));
      badge.position.set(0, 0.25, TILE_D / 2 - 1.2);
      badge.rotation.x = -Math.PI / 2;
      tileGroup.add(badge);
    }

    // Corner treatments
    if (isCornerIndex(index)) {
      const cornerPillarGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.0, 8);
      const cornerPillarMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.3, metalness: 0.8 });
      const pillar = new THREE.Mesh(cornerPillarGeo, cornerPillarMat);
      pillar.position.set(0, 0.6, 0);
      tileGroup.add(pillar);
    }

    this.group.add(tileGroup);
    this.tileMeshes.set(index, tileGroup);
  }

  update(_state: GameState): void {
    // Spin chance cubes
    const time = Date.now() * 0.001;
    for (const [idx, tileGroup] of this.tileMeshes) {
      if ([7, 26, 42].includes(idx)) {
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
