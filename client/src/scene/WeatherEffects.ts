// ============================================================
// WeatherEffects — Rain, snow, lightning particle systems
// ============================================================

import * as THREE from 'three';
import type { WeatherType } from '@monopoly/shared';

const RAIN_COUNT = 5000;
const SNOW_COUNT = 2500;
const RAIN_AREA = 100;
const RAIN_HEIGHT = 70;

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
    const velocities = new Float32Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA * 2;
      positions[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA * 2;
      velocities[i] = 18 + Math.random() * 30;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.userData = { velocities };

    const mat = new THREE.PointsMaterial({
      color: '#8899CC',
      size: 0.25,
      transparent: true,
      opacity: 0.6,
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
    const time = Date.now() * 0.001;

    // Update rain
    if (this.rainSystem) {
      const positions = (this.rainSystem.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      const velocities = this.rainSystem.geometry.userData.velocities as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        positions[i * 3 + 1] -= velocities[i] * dt;
        // Wind drift
        positions[i * 3] -= (4 + Math.sin(i * 0.1 + time) * 2) * dt;
        positions[i * 3 + 2] -= (2 + Math.cos(i * 0.1 + time) * 1) * dt;
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
        // Gentle swaying
        positions[i * 3] += Math.sin(time * 2 + i * 0.7) * 0.8 * dt;
        positions[i * 3 + 2] += Math.cos(time * 1.5 + i * 0.5) * 0.5 * dt;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = RAIN_HEIGHT;
          positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA * 2;
          positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA * 2;
        }
      }
      this.snowSystem.geometry.attributes.position.needsUpdate = true;
    }

    // Weather lighting — darken sky during rain/snow/storm
    if (this.currentWeather !== 'clear' && this.currentWeather !== 'fog') {
      const sun = this.scene.userData.sun as THREE.DirectionalLight;
      const darken = this.currentWeather === 'storm' ? 0.35 : this.currentWeather === 'rain' ? 0.55 : 0.75;
      if (sun && sun.intensity > 0.1) {
        sun.intensity *= darken;
      }
      const amb = this.scene.userData.ambient as THREE.AmbientLight;
      if (amb) {
        amb.intensity *= this.currentWeather === 'storm' ? 0.5 : 0.75;
      }
    }

    // Fog for foggy weather
    if (this.currentWeather === 'fog' && this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 8;
      this.scene.fog.far = 60;
    }

    // Update lightning
    if (this.currentWeather === 'storm' && this.lightningLight) {
      this.lightningCooldown -= dt;
      if (this.lightningCooldown <= 0 && this.lightningLight.intensity < 0.1) {
        this.lightningLight.intensity = 6 + Math.random() * 8;
        this.lightningLight.position.set(
          (Math.random() - 0.5) * 120,
          40 + Math.random() * 30,
          (Math.random() - 0.5) * 120,
        );
        this.lightningTimer = 0.08 + Math.random() * 0.12;
      }
      if (this.lightningTimer > 0) {
        this.lightningTimer -= dt;
        if (this.lightningTimer <= 0) {
          this.lightningLight.intensity = 0;
          this.lightningCooldown = 2 + Math.random() * 5;
        } else {
          this.lightningLight.intensity *= 0.6;
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
