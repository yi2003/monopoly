// ============================================================
// Vehicles — Cars, buses, trucks, bicycles on roads
// ============================================================

import * as THREE from 'three';
import type { ThemeId } from '@monopoly/shared';
import { audioManager } from '../audio/AudioManager';

type VehicleType = 'car' | 'bus' | 'truck' | 'bicycle';

interface VehicleData {
  group: THREE.Group;
  vehicleType: VehicleType;
  path: THREE.Vector3[];
  pathIndex: number;
  pathT: number;
  speed: number;
  direction: number; // 0=forward, 1=backward
  hornCooldown: number; // seconds until can honk again
}

const CAR_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#FDD835', '#FFFFFF', '#424242', '#8E24AA'];
const THEME_TRIM_COLORS: Record<ThemeId, string> = {
  classic: '#FFD700',
  shanghai: '#00BCD4',
  tokyo: '#212121',
};

export class Vehicles {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private vehicles: VehicleData[] = [];
  private theme: ThemeId = 'classic';
  private density = 1.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'vehicles';
    this.scene.add(this.group);
  }

  setTheme(theme: ThemeId): void {
    this.theme = theme;
  }

  setDensity(factor: number): void {
    this.density = Math.max(0, factor);
  }

  setRoadPaths(paths: THREE.Vector3[][]): void {
    this.clear();
    const baseCount = Math.floor(paths.length * 4 * this.density);

    for (let i = 0; i < baseCount; i++) {
      const path = paths[i % paths.length];
      if (path.length < 2) continue;

      const vtype = this.randomVehicleType(path);
      const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];

      const group = this.createVehicle(vtype, color);
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
      });
    }
  }

  private randomVehicleType(path: THREE.Vector3[]): VehicleType {
    const segLen = path[0].distanceTo(path[path.length - 1]);
    const r = Math.random();
    if (segLen < 15) {
      // Short paths: mostly bicycles
      return r < 0.6 ? 'bicycle' : r < 0.9 ? 'car' : 'truck';
    }
    return r < 0.55 ? 'car' : r < 0.75 ? 'bus' : r < 0.9 ? 'truck' : 'bicycle';
  }

  private getSpeed(vtype: VehicleType): number {
    switch (vtype) {
      case 'bicycle': return 0.8 + Math.random() * 0.5;
      case 'car': return 1.6 + Math.random() * 0.8;
      case 'bus': return 1.1 + Math.random() * 0.5;
      case 'truck': return 1.0 + Math.random() * 0.4;
    }
  }

  private createVehicle(vtype: VehicleType, color: string): THREE.Group {
    switch (vtype) {
      case 'car': return this.createCar(color);
      case 'bus': return this.createBus(color);
      case 'truck': return this.createTruck(color);
      case 'bicycle': return this.createBicycle(color);
    }
  }

  private createCar(color: string): THREE.Group {
    const group = new THREE.Group();
    const trimColor = THEME_TRIM_COLORS[this.theme] || THEME_TRIM_COLORS.classic;

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.0, 0.4, 2.0);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    // Cabin (top)
    const cabinGeo = new THREE.BoxGeometry(0.85, 0.25, 0.9);
    const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshStandardMaterial({
      color: '#87CEEB', roughness: 0.1, metalness: 0.3,
    }));
    cabin.position.set(0, 0.7, -0.15);
    cabin.castShadow = true;
    group.add(cabin);

    // Trim strip
    const trimGeo = new THREE.BoxGeometry(1.02, 0.05, 2.02);
    const trim = new THREE.Mesh(trimGeo, new THREE.MeshStandardMaterial({
      color: trimColor, roughness: 0.3, metalness: 0.5, emissive: trimColor, emissiveIntensity: 0.2,
    }));
    trim.position.y = 0.3;
    group.add(trim);

    // Wheels
    for (let s = -1; s <= 1; s += 2) {
      for (let f = -1; f <= 1; f += 2) {
        const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12);
        const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.8 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(s * 0.55, 0.18, f * 0.65);
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    // Headlights (rear) and taillights
    for (let f = -1; f <= 1; f += 2) {
      const lightGeo = new THREE.BoxGeometry(0.3, 0.1, 0.05);
      const isFront = f === 1;
      const lightColor = isFront ? '#FFF9C4' : '#E53935';
      const light = new THREE.Mesh(lightGeo, new THREE.MeshStandardMaterial({
        color: lightColor,
        roughness: 0.2,
        emissive: lightColor,
        emissiveIntensity: 0.6,
      }));
      light.position.set(0, 0.3, f * 1.0);
      group.add(light);
    }

    return group;
  }

  private createBus(color: string): THREE.Group {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.3, 1.1, 3.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // Windows
    for (let i = 0; i < 3; i++) {
      const winGeo = new THREE.BoxGeometry(1.15, 0.35, 0.55);
      const win = new THREE.Mesh(winGeo, new THREE.MeshStandardMaterial({
        color: '#87CEEB', roughness: 0.1, metalness: 0.2,
      }));
      win.position.set(0, 0.95, -0.8 + i * 0.8);
      group.add(win);
    }

    // Route sign
    const signGeo = new THREE.BoxGeometry(0.9, 0.2, 0.1);
    const sign = new THREE.Mesh(signGeo, new THREE.MeshStandardMaterial({
      color: '#FFD700', roughness: 0.3, emissive: '#FFD700', emissiveIntensity: 0.5,
    }));
    sign.position.set(0, 1.3, -1.4);
    group.add(sign);

    // 6 wheels
    for (let w = 0; w < 3; w++) {
      for (let s = -1; s <= 1; s += 2) {
        const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12);
        const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.8 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(s * 0.7, 0.22, -0.9 + w * 0.9);
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    return group;
  }

  private createTruck(color: string): THREE.Group {
    const group = new THREE.Group();

    // Cab
    const cabGeo = new THREE.BoxGeometry(1.0, 0.8, 1.2);
    const cab = new THREE.Mesh(cabGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 }));
    cab.position.set(0, 0.55, 1.0);
    cab.castShadow = true;
    group.add(cab);

    // Cargo box
    const cargoGeo = new THREE.BoxGeometry(1.1, 1.0, 2.2);
    const cargo = new THREE.Mesh(cargoGeo, new THREE.MeshStandardMaterial({ color: '#BDBDBD', roughness: 0.5, metalness: 0.4 }));
    cargo.position.set(0, 0.65, -0.8);
    cargo.castShadow = true;
    group.add(cargo);

    // Wheels
    for (let w = 0; w < 2; w++) {
      for (let s = -1; s <= 1; s += 2) {
        const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12);
        const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.8 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(s * 0.55, 0.22, (w === 0 ? 1.0 : -1.0));
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    return group;
  }

  private createBicycle(_color: string): THREE.Group {
    const group = new THREE.Group();

    // Frame (simplified as tubes)
    const frameMat = new THREE.MeshStandardMaterial({ color: '#616161', roughness: 0.3, metalness: 0.7 });

    // Down tube
    const dtGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
    const dt = new THREE.Mesh(dtGeo, frameMat);
    dt.position.set(0, 0.3, 0);
    dt.rotation.x = Math.PI / 3;
    group.add(dt);

    // Top tube
    const ttGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8);
    const tt = new THREE.Mesh(ttGeo, frameMat);
    tt.position.set(0, 0.55, 0.1);
    group.add(tt);

    // Seat post
    const spGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 8);
    const sp = new THREE.Mesh(spGeo, frameMat);
    sp.position.set(0, 0.65, 0.15);
    group.add(sp);

    // Seat
    const seatGeo = new THREE.BoxGeometry(0.15, 0.05, 0.2);
    const seat = new THREE.Mesh(seatGeo, new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.7 }));
    seat.position.set(0, 0.78, 0.15);
    group.add(seat);

    // Wheels
    for (let f = -1; f <= 1; f += 2) {
      const wheelGeo = new THREE.TorusGeometry(0.2, 0.03, 8, 16);
      const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.7 }));
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(0, 0.2, f * 0.35);
      wheel.castShadow = true;
      group.add(wheel);
    }

    // Rider (simple figure)
    const riderGroup = new THREE.Group();
    const torsoGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.25, 6);
    const torso = new THREE.Mesh(torsoGeo, new THREE.MeshStandardMaterial({ color: '#1976D2', roughness: 0.6 }));
    torso.position.y = 0.85;
    riderGroup.add(torso);

    const headGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: '#FFDAB9', roughness: 0.5 }));
    head.position.y = 1.05;
    riderGroup.add(head);

    riderGroup.position.y = 0;
    group.add(riderGroup);

    return group;
  }

  /** Sample position on path at normalized t (0-1) */
  private samplePath(path: THREE.Vector3[], t: number): [THREE.Vector3, number] {
    const totalLen = this.pathLength(path);
    let targetDist = t * totalLen;
    let segIdx = 0;
    let accumulated = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const segLen = path[i].distanceTo(path[i + 1]);
      if (accumulated + segLen >= targetDist) {
        const localT = (targetDist - accumulated) / segLen;
        return [path[i].clone().lerp(path[i + 1], localT), i + localT];
      }
      accumulated += segLen;
      segIdx = i;
    }
    return [path[path.length - 1].clone(), path.length - 1];
  }

  private pathLength(path: THREE.Vector3[]): number {
    let len = 0;
    for (let i = 0; i < path.length - 1; i++) {
      len += path[i].distanceTo(path[i + 1]);
    }
    return len;
  }

  update(dt: number): void {
    for (const v of this.vehicles) {
      const totalLen = this.pathLength(v.path);
      const segLen = v.speed * dt;

      v.pathT += (v.direction === 0 ? 1 : -1) * segLen / totalLen;
      if (v.pathT >= 1) {
        v.pathT = 0;
      } else if (v.pathT <= 0) {
        v.pathT = 1;
      }

      const [pos, segIdx] = this.samplePath(v.path, v.pathT);
      v.group.position.set(pos.x, 0.05, pos.z);

      // Face movement direction
      if (segIdx < v.path.length - 1) {
        const dir = v.path[Math.floor(segIdx) + 1].clone().sub(v.path[Math.floor(segIdx)]).normalize();
        if (v.direction === 1) dir.negate();
        const angle = Math.atan2(dir.x, dir.z);
        v.group.rotation.y = angle;
      }

      // Random horns and bells
      v.hornCooldown -= dt;
      if (v.hornCooldown <= 0) {
        v.hornCooldown = 6 + Math.random() * 25;
        if (Math.random() < 0.25) {
          if (v.vehicleType === 'bicycle') {
            audioManager.playBicycleBell();
          } else {
            audioManager.playCarHorn();
          }
        }
      }
    }
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
