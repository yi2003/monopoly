// ============================================================
// NightGlow — Manage emissive intensity for nighttime
// ============================================================

import * as THREE from 'three';

/**
 * Registry of materials that should glow at night.
 * Call `setNightFactor(0-1)` each frame — 0=day, 1=full night.
 */
export class NightGlow {
  private materials: Set<THREE.MeshStandardMaterial> = new Set();
  private currentFactor = 0;

  /** Register a material for nighttime glow control */
  register(mat: THREE.MeshStandardMaterial): void {
    this.materials.add(mat);
  }

  /** Register all materials from an array (e.g. CityBuilder nightGlowMaterials) */
  registerAll(mats: THREE.MeshStandardMaterial[]): void {
    for (const m of mats) this.materials.add(m);
  }

  /** Set the night factor (0=day, 1=night) — adjusts emissiveIntensity of all registered materials */
  setNightFactor(factor: number): void {
    // Clamp and smooth
    const clamped = Math.max(0, Math.min(1, factor));
    if (Math.abs(clamped - this.currentFactor) < 0.001) return;
    this.currentFactor = clamped;

    for (const mat of this.materials) {
      // Store original emissive intensity if not already stored
      if (mat.userData._origEmissiveIntensity === undefined) {
        mat.userData._origEmissiveIntensity = mat.emissiveIntensity;
      }
      const base = mat.userData._origEmissiveIntensity as number;
      // At night, amplify; at day, keep at base level
      mat.emissiveIntensity = base + clamped * 2.5;
    }
  }

  /** Find all materials with emissive in a scene graph and register them */
  autoRegisterFromScene(scene: THREE.Scene): void {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (Array.isArray(mat)) {
          for (const m of mat) {
            if (m instanceof THREE.MeshStandardMaterial && m.emissiveIntensity > 0) {
              this.register(m);
            }
          }
        } else if (mat instanceof THREE.MeshStandardMaterial && mat.emissiveIntensity > 0) {
          this.register(mat);
        }
      }
    });
  }

  clear(): void {
    this.materials.clear();
    this.currentFactor = 0;
  }
}
