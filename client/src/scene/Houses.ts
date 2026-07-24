// ============================================================
// Houses — Green houses & red hotels on property tiles
// ============================================================

import * as THREE from 'three';
import type { GameState } from '@monopoly/shared';

interface HouseGroup {
  tileIndex: number;
  count: number;
  meshes: THREE.Group[];
}

export class Houses {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private houseGroups: Map<number, HouseGroup> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  updateState(state: GameState): void {
    // Collect all house data from all players
    const allHouses: Map<number, number> = new Map();

    for (const player of state.players) {
      for (const [tileIdx, count] of Object.entries(player.houses)) {
        const idx = Number(tileIdx);
        allHouses.set(idx, (allHouses.get(idx) || 0) + count);
      }
    }

    // Update house meshes
    for (const [tileIdx, count] of allHouses) {
      let hg = this.houseGroups.get(tileIdx);

      if (!hg || hg.count !== count) {
        // Remove old
        if (hg) {
          for (const m of hg.meshes) this.group.remove(m);
        }

        // Create new
        const meshes: THREE.Group[] = [];
        const pos = this.getTilePosition(tileIdx);

        for (let i = 0; i < count; i++) {
          const isHotel = i >= 4; // 5th = hotel (red)
          const houseGroup = new THREE.Group();

          if (isHotel) {
            // Hotel: larger red building
            const bodyGeo = new THREE.BoxGeometry(0.4, 0.5, 0.35);
            const bodyMat = new THREE.MeshStandardMaterial({ color: '#D32F2F', roughness: 0.4 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.25;
            body.castShadow = true;
            houseGroup.add(body);

            // Roof
            const roofGeo = new THREE.ConeGeometry(0.28, 0.25, 4);
            const roofMat = new THREE.MeshStandardMaterial({ color: '#B71C1C', roughness: 0.5 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.y = 0.55;
            roof.castShadow = true;
            houseGroup.add(roof);

            // Sign
            const signGeo = new THREE.BoxGeometry(0.5, 0.1, 0.05);
            const signMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.3, emissive: '#FFD700', emissiveIntensity: 0.3 });
            const sign = new THREE.Mesh(signGeo, signMat);
            sign.position.y = 0.65;
            houseGroup.add(sign);
          } else {
            // House: small green building
            const bodyGeo = new THREE.BoxGeometry(0.3, 0.3, 0.25);
            const bodyMat = new THREE.MeshStandardMaterial({ color: '#388E3C', roughness: 0.4 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.15;
            body.castShadow = true;
            houseGroup.add(body);

            // Roof
            const roofGeo = new THREE.ConeGeometry(0.22, 0.18, 4);
            const roofMat = new THREE.MeshStandardMaterial({ color: '#1B5E20', roughness: 0.5 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.y = 0.33;
            roof.castShadow = true;
            houseGroup.add(roof);
          }

          // Position along the tile edge
          const offsetX = (i % 2 === 0 ? -0.4 : 0.4) + (Math.floor(i / 2) * 0.1);
          const offsetZ = 1.8 - i * 0.9; // spread along tile depth

          houseGroup.position.set(
            pos.x + offsetX,
            0.1,
            pos.z + offsetZ,
          );

          this.group.add(houseGroup);
          meshes.push(houseGroup);
        }

        this.houseGroups.set(tileIdx, { tileIndex: tileIdx, count, meshes });
      }
    }

    // Remove houses for tiles no longer owned
    for (const [tileIdx, hg] of this.houseGroups) {
      if (!allHouses.has(tileIdx)) {
        for (const m of hg.meshes) this.group.remove(m);
        this.houseGroups.delete(tileIdx);
      }
    }
  }

  private getTilePosition(index: number): { x: number; z: number } {
    const TILE_W = 2.8;
    const BOARD_HALF = 5.0 + 7 * TILE_W;
    const CORNER_SIZE = 5.0;
    const side = Math.floor(index / 12);
    const sideIdx = index % 12;
    const offset = CORNER_SIZE / 2 + sideIdx * (TILE_W + 0.15);

    switch (side) {
      case 0: return { x: -BOARD_HALF + offset, z: -BOARD_HALF };
      case 1: return { x: BOARD_HALF, z: -BOARD_HALF + offset };
      case 2: return { x: BOARD_HALF - offset, z: BOARD_HALF };
      case 3: return { x: -BOARD_HALF, z: BOARD_HALF - offset };
      default: return { x: 0, z: 0 };
    }
  }

  dispose(): void {
    this.group.clear();
    this.houseGroups.clear();
  }
}
