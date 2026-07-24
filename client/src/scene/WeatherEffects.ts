// ============================================================
// WeatherEffects — Rain, snow, lightning particle systems
// ============================================================

import * as THREE from 'three';
import type { WeatherType } from '@monopoly/shared';

const RAIN_COUNT = 1100;
const SNOW_COUNT = 550;
const RAIN_AREA = 80; // coverage area half-size
const RAIN_HEIGHT = 60;

export class WeatherEffects {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private rainSystem: THREE.Points | null = null;
  private snowSystem: THREE.Points | null = null;
  private lightningLight: THREE.PointLight | null = null;
  private lightningTimer = 0;
  private lightningCooldown = 0;

  private currentWeather: WeatherType = 'clear';
  private enabled = true;

  // Fog reference for weather-based adjustment
  private baseFogNear = 40;
  private baseFogFar = 180;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'weatherEffects';
    this.scene.add(this.group);

    // Capture base fog distances
    if (scene.fog instanceof THREE.Fog) {
      this.baseFogNear = scene.fog.near;
      this.baseFogFar = scene.fog.far;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearAll();
    } else {
      this.applyWeather(this.currentWeather);
    }
  }

  private clearAll(): void {
    if (this.rainSystem) { this.group.remove(this.rainSystem); this.rainSystem = null; }
    if (this.snowSystem) { this.group.remove(this.snowSystem); this.snowSystem = null; }
    if (this.lightningLight) { this.scene.remove(this.lightningLight); this.lightningLight = null; }
  }

  setWeather(weather: WeatherType): void {
    if (weather === this.currentWeather) return;
    this.currentWeather = weather;
    this.clearAll();
    if (this.enabled) {
      this.applyWeather(weather);
    }
  }

  private applyWeather(weather: WeatherType): void {
    switch (weather) {
      case 'rain':
        this.createRain();
        break;
      case 'snow':
        this.createSnow();
        break;
      case 'storm':
        this.createRain();
        this.createLightning();
        break;
      case 'fog':
        // Fog-only: adjust scene fog
        break;
      case 'clear':
      default:
        // No particles
        break;
    }
    this.updateFogForWeather(weather);
  }

  private updateFogForWeather(weather: WeatherType): void {
    if (!(this.scene.fog instanceof THREE.Fog)) return;
    switch (weather) {
      case 'rain':
        this.scene.fog.near = this.baseFogNear * 0.6;
        this.scene.fog.far = this.baseFogFar * 0.7;
        break;
      case 'snow':
        this.scene.fog.near = this.baseFogNear * 0.5;
        this.scene.fog.far = this.baseFogFar * 0.6;
        break;
      case 'fog':
        this.scene.fog.near = this.baseFogNear * 0.25;
        this.scene.fog.far = this.baseFogFar * 0.35;
        break;
      case 'storm':
        this.scene.fog.near = this.baseFogNear * 0.4;
        this.scene.fog.far = this.baseFogFar * 0.55;
        break;
      default:
        this.scene.fog.near = this.baseFogNear;
        this.scene.fog.far = this.baseFogFar;
    }
  }

  private createRain(): void {
    const positions = new Float32Array(RAIN_COUNT * 3);
    const velocities = new Float32Array(RAIN_COUNT); // stored in userData for update

    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA * 2;
      positions[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA * 2;
      velocities[i] = 15 + Math.random() * 25; // fall speed
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.userData = { velocities };

    const mat = new THREE.PointsMaterial({
      color: '#8899CC',
      size: 0.15,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.rainSystem = new THREE.Points(geo, mat);
    this.rainSystem.name = 'rain';
    this.group.add(this.rainSystem);
  }

  private createSnow(): void {
    const positions = new Float32Array(SNOW_COUNT * 3);
    const velocities = new Float32Array(SNOW_COUNT);

    for (let i = 0; i < SNOW_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA * 2;
      positions[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA * 2;
      velocities[i] = 2 + Math.random() * 5; // gentle fall
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.userData = { velocities };

    const mat = new THREE.PointsMaterial({
      color: '#FFFFFF',
      size: 0.4,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    this.snowSystem = new THREE.Points(geo, mat);
    this.snowSystem.name = 'snow';
    this.group.add(this.snowSystem);
  }

  private createLightning(): void {
    this.lightningLight = new THREE.PointLight('#FFFFFF', 0, 200);
    this.lightningLight.position.set(0, 50, 0);
    this.lightningLight.name = 'lightning';
    this.scene.add(this.lightningLight);
    this.lightningCooldown = 3 + Math.random() * 5; // seconds between strikes
  }

  update(dt: number): void {
    // Update rain
    if (this.rainSystem) {
      const positions = (this.rainSystem.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      const velocities = this.rainSystem.geometry.userData.velocities as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        positions[i * 3 + 1] -= velocities[i] * dt;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = RAIN_HEIGHT;
          positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA * 2;
          positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA * 2;
        }
      }
      this.rainSystem.geometry.attributes.position.needsUpdate = true;
    }

    // Update snow
    if (this.snowSystem) {
      const positions = (this.snowSystem.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      const velocities = this.snowSystem.geometry.userData.velocities as Float32Array;
      for (let i = 0; i < SNOW_COUNT; i++) {
        positions[i * 3 + 1] -= velocities[i] * dt;
        // Horizontal sway
        positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.3 * dt;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = RAIN_HEIGHT;
          positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA * 2;
          positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA * 2;
        }
      }
      this.snowSystem.geometry.attributes.position.needsUpdate = true;
    }

    // Update lightning
    if (this.currentWeather === 'storm' && this.lightningLight) {
      this.lightningCooldown -= dt;
      if (this.lightningCooldown <= 0 && this.lightningLight.intensity < 0.1) {
        // Strike!
        this.lightningLight.intensity = 3 + Math.random() * 5;
        this.lightningLight.position.set(
          (Math.random() - 0.5) * 100,
          40 + Math.random() * 30,
          (Math.random() - 0.5) * 100,
        );
        this.lightningTimer = 0.08 + Math.random() * 0.15;
      }
      if (this.lightningTimer > 0) {
        this.lightningTimer -= dt;
        if (this.lightningTimer <= 0) {
          this.lightningLight.intensity = 0;
          this.lightningCooldown = 3 + Math.random() * 7;
        } else {
          // Flicker
          this.lightningLight.intensity *= 0.7;
        }
      }
    }
  }

  dispose(): void {
    this.clearAll();
    this.group.clear();
    this.scene.remove(this.group);
  }
}
