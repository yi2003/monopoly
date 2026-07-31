// ============================================================
// Vehicles — Era-specific cars, buses, trucks, pods on roads
// Ported from opus5 Vehicles.js with era-distinct geometries
// ============================================================

import * as THREE from 'three';
import type { ThemeId, EraId } from '@monopoly/shared';
import { getEra } from '@monopoly/shared';
import type { EraDef } from '@monopoly/shared';
import { audioManager } from '../audio/AudioManager';

type VehicleType = string; // era traffic types: sedan40s, pod, etc.

interface VehicleData {
  group: THREE.Group;
  vehicleType: VehicleType;
  path: THREE.Vector3[];
  pathIndex: number;
  pathT: number;
  speed: number;
  direction: number; // 0=forward, 1=backward
  hornCooldown: number;
  flying: boolean;
  altitude: number;
}

const ERA_BODY_COLORS: Record<string, string[]> = {
  '1945': ['#2a2a2a', '#3a3028', '#4a1a1a', '#1a2a3a', '#5a4a30'],
  '1985': ['#c0c0c0', '#101010', '#e02040', '#2040a0', '#e0e020', '#8020a0'],
  '2025': ['#e8e8e8', '#1a1a1a', '#3a80c0', '#c02020', '#2a2a2a', '#80c0a0'],
  '2055': ['#c0e8e0', '#80ffe0', '#1a2830', '#e0e0ff', '#40c8a0'],
};

// ── helpers ──

function mat(color: string, rough = 0.45, metal = 0.55): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function wheelMesh(r: number, dark: THREE.MeshStandardMaterial): THREE.Mesh {
  const w = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.22, 10),
    dark,
  );
  w.rotation.z = Math.PI / 2;
  return w;
}

function addWheels(g: THREE.Group, positions: [number, number][], r: number, dark: THREE.MeshStandardMaterial): void {
  for (const [x, z] of positions) {
    const w = wheelMesh(r, dark);
    w.position.set(x, r, z);
    g.add(w);
  }
}

function lightPad(color: string, emissiveIntensity = 1.5): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity, roughness: 0.4,
  });
}

// ── Era-specific vehicle builders (ported from opus5) ──

/** 1945: Classic rounded sedan */
function buildClassicSedan(g: THREE.Group, body: THREE.MeshStandardMaterial, dark: THREE.MeshStandardMaterial, glass: THREE.MeshStandardMaterial, light: THREE.MeshStandardMaterial, scale = 1): void {
  const L = 4.6 * scale, W = 1.8, H = 1.15;
  const b = (w: number, h: number, d: number, mat: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  b(L, H * 0.55, W, body, 0, 0.35, 0);
  b(L * 0.55, H * 0.5, W * 0.92, body, -0.1, 0.35 + H * 0.5, 0); // cabin
  b(L * 0.4, H * 0.38, W * 0.85, glass, 0.05, 0.55 + H * 0.35, 0); // windows
  b(0.08, 0.15, W * 0.9, chrome, L / 2 - 0.05, 0.5, 0); // bumper
  b(0.15, 0.12, 0.35, light, L / 2 - 0.02, 0.55, 0.55);
  b(0.15, 0.12, 0.35, light, L / 2 - 0.02, 0.55, -0.55);
  addWheels(g, [[L * 0.3, W * 0.45], [L * 0.3, -W * 0.45], [-L * 0.3, W * 0.45], [-L * 0.3, -W * 0.45]], 0.34, dark);
}

/** 1985: Boxy 80s sedan */
function buildBoxSedan(g: THREE.Group, body: THREE.MeshStandardMaterial, dark: THREE.MeshStandardMaterial, glass: THREE.MeshStandardMaterial, light: THREE.MeshStandardMaterial, lenMul = 1, hMul = 1): void {
  const L = 4.5 * lenMul, W = 1.85, H = 1.2 * hMul;
  const b = (w: number, h: number, d: number, mat2: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat2);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  b(L, H * 0.5, W, body, 0, 0.32, 0);
  b(L * 0.55, H * 0.45, W * 0.92, body, -0.05, 0.32 + H * 0.45, 0);
  b(L * 0.45, H * 0.35, W * 0.85, glass, 0.1, 0.5 + H * 0.3, 0);
  b(0.12, 0.1, 0.55, light, L / 2, 0.5, 0.5);
  b(0.12, 0.1, 0.55, light, L / 2, 0.5, -0.5);
  addWheels(g, [[L * 0.3, W * 0.48], [L * 0.3, -W * 0.48], [-L * 0.3, W * 0.48], [-L * 0.3, -W * 0.48]], 0.34, dark);
}

/** 2025: Modern EV with light bar */
function buildEvCar(g: THREE.Group, body: THREE.MeshStandardMaterial, dark: THREE.MeshStandardMaterial, glass: THREE.MeshStandardMaterial, light: THREE.MeshStandardMaterial): void {
  buildBoxSedan(g, body, dark, glass, light, 1.05, 0.95);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.06, 1.6),
    lightPad('#a0d0ff', 2),
  );
  bar.position.set(2.2, 0.55, 0);
  g.add(bar);
}

/** 2025: SUV */
function buildSuv(g: THREE.Group, body: THREE.MeshStandardMaterial, dark: THREE.MeshStandardMaterial, glass: THREE.MeshStandardMaterial, light: THREE.MeshStandardMaterial, sleek = false): void {
  const L = 4.8, W = 2.0, H = sleek ? 1.55 : 1.75;
  const b = (w: number, h: number, d: number, mat2: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat2);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  b(L, H * 0.55, W, body, 0, 0.4, 0);
  b(L * 0.7, H * 0.5, W * 0.95, body, -0.1, 0.4 + H * 0.5, 0);
  b(L * 0.55, H * 0.4, W * 0.88, glass, 0.05, 0.55 + H * 0.4, 0);
  b(0.1, 0.12, 0.6, light, L / 2, 0.65, 0.55);
  b(0.1, 0.12, 0.6, light, L / 2, 0.65, -0.55);
  addWheels(g, [[L * 0.3, W * 0.5], [L * 0.3, -W * 0.5], [-L * 0.3, W * 0.5], [-L * 0.3, -W * 0.5]], 0.42, dark);
}

/** 1945/1985: Box truck */
function buildBoxTruck(g: THREE.Group, body: THREE.MeshStandardMaterial, dark: THREE.MeshStandardMaterial, glass: THREE.MeshStandardMaterial, light: THREE.MeshStandardMaterial, vintage = false, delivery = false): void {
  const L = delivery ? 4.2 : 5.2, W = 2.0;
  const b = (w: number, h: number, d: number, mat2: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat2);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  b(L * 0.35, 1.4, W, body, L * 0.28, 0.35, 0); // cab
  b(L * 0.55, vintage ? 1.8 : 2.2, W * 0.95, body, -L * 0.15, 0.35, 0); // cargo
  b(L * 0.2, 0.7, W * 0.85, glass, L * 0.32, 1.1, 0); // windshield
  b(0.1, 0.12, 0.4, light, L / 2, 0.7, 0.55);
  b(0.1, 0.12, 0.4, light, L / 2, 0.7, -0.55);
  addWheels(g, [[L * 0.28, W * 0.5], [L * 0.28, -W * 0.5], [-L * 0.25, W * 0.5], [-L * 0.25, -W * 0.5]], 0.4, dark);
}

/** City bus */
function buildCityBus(g: THREE.Group, body: THREE.MeshStandardMaterial, dark: THREE.MeshStandardMaterial, glass: THREE.MeshStandardMaterial, light: THREE.MeshStandardMaterial): void {
  const L = 8.5, W = 2.4, H = 2.8;
  const b = (w: number, h: number, d: number, mat2: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat2);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  b(L, H, W, body, 0, 0.35, 0);
  b(L * 0.9, H * 0.45, 0.08, glass, 0, 1.5, W / 2 + 0.02);
  b(L * 0.9, H * 0.45, 0.08, glass, 0, 1.5, -W / 2 - 0.02);
  b(0.08, H * 0.5, W * 0.8, glass, L / 2 + 0.02, 1.4, 0);
  b(0.15, 0.2, 0.7, light, L / 2, 0.8, 0.7);
  b(0.15, 0.2, 0.7, light, L / 2, 0.8, -0.7);
  addWheels(g, [[L * 0.35, W * 0.55], [L * 0.35, -W * 0.55], [-L * 0.3, W * 0.55], [-L * 0.3, -W * 0.55]], 0.5, dark);
  // Route sign
  b(0.9, 0.2, 0.1, lightPad('#FFD700', 0.8), 0, 1.8, -L * 0.4);
}

/** 2025: Scooter */
function buildScooter(g: THREE.Group, body: THREE.MeshStandardMaterial, dark: THREE.MeshStandardMaterial): void {
  const b = (w: number, h: number, d: number, mat2: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat2);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  b(1.4, 0.25, 0.45, body, 0, 0.35, 0);
  b(0.08, 0.9, 0.08, dark, 0.5, 0.35, 0);
  b(0.5, 0.06, 0.06, dark, 0.5, 1.2, 0);
  addWheels(g, [[0.45, 0], [-0.45, 0]], 0.22, dark);
}

/** Simple bicycle (1945/2025) */
function buildBicycle(g: THREE.Group, rimMat: THREE.MeshStandardMaterial): void {
  const dark = mat('#1a1a1a', 0.6, 0.4);
  addWheels(g, [[0.5, 0], [-0.5, 0]], 0.32, rimMat);
  const b = (w: number, h: number, d: number, mat2: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat2);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  b(0.9, 0.05, 0.05, dark, 0, 0.7, 0);
  b(0.05, 0.55, 0.05, dark, 0.35, 0.45, 0);
  b(0.4, 0.04, 0.04, dark, 0.4, 1.0, 0);
}

/** 2055: Autonomous pod with hover pads and light strips */
function buildPod(g: THREE.Group, body: THREE.MeshStandardMaterial, glass: THREE.MeshStandardMaterial, light: THREE.MeshStandardMaterial, mag = false): void {
  const L = 3.6, W = 1.8, H = 1.6;
  const b = (w: number, h: number, d: number, mat2: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat2);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  b(L, H * 0.7, W, body, 0, mag ? 0.6 : 0.2, 0);
  b(L * 0.7, H * 0.5, W * 0.9, glass, 0.1, mag ? 1.1 : 0.7, 0);
  // Biolume light strip
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(L * 0.8, 0.06, 0.06),
    lightPad('#40ffe0', 2.5),
  );
  strip.position.set(0, mag ? 0.55 : 0.25, W / 2 + 0.02);
  g.add(strip);
  if (!mag) {
    // Hover pads
    for (const [x, z] of [[1, 0.6], [1, -0.6], [-1, 0.6], [-1, -0.6]]) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.3, 0.12, 8),
        mat('#40ffe0', 0.3, 0.5),
      );
      pad.position.set(x, 0.05, z);
      g.add(pad);
    }
  }
}

/** 2055: Flying drone taxi */
function buildDroneTaxi(g: THREE.Group, body: THREE.MeshStandardMaterial, glass: THREE.MeshStandardMaterial): void {
  buildPod(g, body, glass, lightPad('#40ffe0', 0), true);
  g.position.y = 0;
  const arm = mat('#80ffe0', 0.3, 0.7);
  for (const [x, z] of [[1.2, 1.0], [1.2, -1.0], [-1.2, 1.0], [-1.2, -1.0]]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.08), arm);
    a.position.set(x * 0.5, 2.0, z * 0.5);
    g.add(a);
    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12),
      mat('#40ffe0', 0.4, 0.3),
    );
    rotor.position.set(x * 0.7, 2.05, z * 0.7);
    g.add(rotor);
  }
}

// Shared materials
const chrome = mat('#c8d0d8', 0.25, 1);
const glassMat = new THREE.MeshStandardMaterial({
  color: '#88aacc', roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.65,
});

// ── Vehicle class ──

export class Vehicles {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private vehicles: VehicleData[] = [];
  private theme: ThemeId = 'classic';
  private era: EraId = '2025';
  private density = 1.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'vehicles';
    this.scene.add(this.group);
  }

  setTheme(theme: ThemeId): void { this.theme = theme; }
  setEra(era: EraId): void { this.era = era; }

  setDensity(factor: number): void {
    this.density = Math.max(0, factor);
  }

  setRoadPaths(paths: THREE.Vector3[][]): void {
    this.clear();
    const eraDef = getEra(this.era);
    const eraTraffic = eraDef.traffic;
    const eraDensity = eraTraffic.density * this.density;
    const baseCount = Math.floor(paths.length * 4 * eraDensity);

    for (let i = 0; i < baseCount; i++) {
      const pathIdx = i % paths.length;
      const path = paths[pathIdx];
      if (path.length < 2) continue;

      const isOuterRing = pathIdx < 4;
      const trafficTypes = eraTraffic.types;
      const vtype = isOuterRing
        ? trafficTypes[trafficTypes.length - 2] || trafficTypes[0] // prefer trucks on outer
        : trafficTypes[Math.floor(Math.random() * trafficTypes.length)];

      const group = this.makeVehicle(vtype, eraDef);
      const startT = Math.random();
      const [pos] = this.samplePath(path, startT);
      group.position.copy(pos);
      group.position.y = 0.05;

      this.group.add(group);
      this.vehicles.push({
        group,
        vehicleType: vtype,
        path: [...path],
        pathIndex: 0,
        pathT: startT,
        speed: this.getSpeed(vtype),
        direction: Math.random() < 0.5 ? 0 : 1,
        hornCooldown: 8 + Math.random() * 25,
        flying: vtype === 'droneTaxi',
        altitude: vtype === 'droneTaxi' ? 8 + Math.random() * 14 : 0,
      });
    }
  }

  private getSpeed(vtype: VehicleType): number {
    const eraDef = getEra(this.era);
    const spd = eraDef.traffic.speed;
    const flying = vtype === 'droneTaxi';
    switch (vtype) {
      case 'bicycle':
      case 'bike':
      case 'cycle': return (0.8 + Math.random() * 0.5) * spd;
      case 'scooter': return (1.0 + Math.random() * 0.5) * spd;
      case 'sedan40s':
      case 'coupe40s': return (1.3 + Math.random() * 0.5) * spd;
      case 'sedan80s':
      case 'muscle80s': return (1.7 + Math.random() * 0.6) * spd;
      case 'evSedan':
      case 'suv25': return (1.5 + Math.random() * 0.4) * spd;
      case 'pod':
      case 'maglev': return (2.0 + Math.random() * 0.8) * spd * (flying ? 1.3 : 1);
      case 'bus60s':
      case 'bus': return (1.1 + Math.random() * 0.5) * spd;
      case 'truck40s':
      case 'truck':
      case 'van80s':
      case 'delivery': return (1.0 + Math.random() * 0.4) * spd;
      default: return (1.5 + Math.random() * 0.5) * spd;
    }
  }

  /** Create an era-specific vehicle geometry */
  private makeVehicle(type: VehicleType, _eraDef: EraDef): THREE.Group {
    const g = new THREE.Group();
    const colors = ERA_BODY_COLORS[this.era] || ERA_BODY_COLORS['2025'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const body = mat(color);
    const dark = mat('#1a1a1a', 0.6, 0.4);
    const light = lightPad('#ffe8a0');

    // Dispatch to era-specific builder based on vehicle type
    const builders: Record<string, () => void> = {
      // 1945
      sedan40s: () => buildClassicSedan(g, body, dark, glassMat, light, 1.0),
      coupe40s: () => buildClassicSedan(g, body, dark, glassMat, light, 0.85),
      truck40s: () => buildBoxTruck(g, body, dark, glassMat, light, true),
      // 1985
      sedan80s: () => buildBoxSedan(g, body, dark, glassMat, light),
      muscle80s: () => buildBoxSedan(g, body, dark, glassMat, light, 1.15, 0.9),
      van80s: () => buildBoxTruck(g, body, dark, glassMat, light, false),
      taxi80s: () => { buildBoxSedan(g, mat('#c8a020'), dark, glassMat, light); addTaxiSign(g); },
      // 2025
      evSedan: () => buildEvCar(g, body, dark, glassMat, light),
      suv25: () => buildSuv(g, body, dark, glassMat, light, true),
      scooter: () => buildScooter(g, body, dark),
      delivery: () => buildBoxTruck(g, mat('#e8e8e8'), dark, glassMat, light, false, true),
      bike: () => buildBicycle(g, mat('#cccccc', 0.4, 0.8)),
      // 2055
      pod: () => buildPod(g, body, glassMat, lightPad('#40ffe0')),
      droneTaxi: () => buildDroneTaxi(g, body, glassMat),
      maglev: () => buildPod(g, body, glassMat, lightPad('#40ffe0', 2.5), true),
      cycle: () => buildBicycle(g, mat('#40ffe0', 0.3, 0.8)),
    };

    (builders[type] || builders.sedan80s || (() => buildBoxSedan(g, body, dark, glassMat, light)))();

    return g;
  }

  update(dt: number): void {
    for (const v of this.vehicles) {
      const totalLen = this.pathLength(v.path);
      const segLen = v.speed * dt;

      v.pathT += (v.direction === 0 ? 1 : -1) * segLen / totalLen;
      if (v.pathT >= 1) v.pathT = 0;
      else if (v.pathT <= 0) v.pathT = 1;

      const [pos, segIdx] = this.samplePath(v.path, v.pathT);
      const y = v.flying ? v.altitude + Math.sin(v.pathT * 3) * 0.5 : 0.05;
      v.group.position.set(pos.x, y, pos.z);

      if (segIdx < v.path.length - 1) {
        const dir = v.path[Math.floor(segIdx) + 1].clone().sub(v.path[Math.floor(segIdx)]).normalize();
        if (v.direction === 1) dir.negate();
        v.group.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
      }

      v.hornCooldown -= dt;
      if (v.hornCooldown <= 0) {
        v.hornCooldown = 6 + Math.random() * 25;
        if (Math.random() < 0.25) {
          if (v.vehicleType === 'bicycle' || v.vehicleType === 'bike' || v.vehicleType === 'cycle' || v.vehicleType === 'scooter') {
            audioManager.playBicycleBell();
          } else {
            audioManager.playCarHorn();
          }
        }
      }
    }
  }

  private samplePath(path: THREE.Vector3[], t: number): [THREE.Vector3, number] {
    const totalLen = this.pathLength(path);
    let targetDist = t * totalLen;
    let accumulated = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const segLen = path[i].distanceTo(path[i + 1]);
      if (accumulated + segLen >= targetDist) {
        const localT = (targetDist - accumulated) / segLen;
        return [path[i].clone().lerp(path[i + 1], localT), i + localT];
      }
      accumulated += segLen;
    }
    return [path[path.length - 1].clone(), path.length - 1];
  }

  private pathLength(path: THREE.Vector3[]): number {
    let len = 0;
    for (let i = 0; i < path.length - 1; i++) len += path[i].distanceTo(path[i + 1]);
    return len;
  }

  clear(): void {
    for (const v of this.vehicles) {
      this.group.remove(v.group);
      v.group.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }
    this.vehicles = [];
  }

  dispose(): void {
    this.clear();
    this.group.clear();
    this.scene.remove(this.group);
  }
}

function addTaxiSign(g: THREE.Group): void {
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.25, 0.2),
    lightPad('#e0c020', 0.8),
  );
  sign.position.set(0, 1.7, 0);
  g.add(sign);
}
