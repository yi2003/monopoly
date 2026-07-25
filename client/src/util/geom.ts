/* Geometry helpers — ported from opus5.
   Shared box geometry (origin at floor centre), convenience mesh constructors. */

import * as THREE from 'three';

// Shared box geometry — origin at floor centre so scaling works from ground up
const _box = new THREE.BoxGeometry(1, 1, 1);
_box.translate(0, 0.5, 0);

export function boxMesh(
  w: number, h: number, d: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(_box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Unique box geometry (for UV-critical facades). Origin at floor centre. */
export function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

export function cylMesh(
  rTop: number, rBot: number, h: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
  segs = 12,
): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function planeMesh(
  w: number, d: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      if (c.geometry && c.geometry !== _box) c.geometry.dispose();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        for (const mat of mats) {
          if (!mat || (mat as any).userData?.shared) continue;
          for (const key of Object.keys(mat)) {
            const v = (mat as any)[key];
            if (v && v.isTexture && !v.userData?.shared) v.dispose();
          }
          mat.dispose();
        }
      }
    }
  });
}

export function setOpacity(root: THREE.Object3D, a: number): void {
  root.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      if (!m) continue;
      m.transparent = a < 0.999;
      m.opacity = a;
      m.depthWrite = a > 0.9;
    }
  });
}

export function cloneMat(mat: THREE.Material): THREE.Material {
  const m = mat.clone();
  (m as any).userData = { ...((mat as any).userData || {}), shared: false };
  return m;
}
