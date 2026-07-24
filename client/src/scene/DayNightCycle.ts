// ============================================================
// DayNightCycle — Dynamic sky, fog, and lighting transitions
// ============================================================

import * as THREE from 'three';

interface SkyKeyframe {
  t: number; // 0-1 position in cycle
  skyTop: THREE.Color;
  skyBottom: THREE.Color;
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  ambientIntensity: number;
  ambientColor: THREE.Color;
  hemiIntensity: number;
  hemiSkyColor: THREE.Color;
  hemiGroundColor: THREE.Color;
  sunIntensity: number;
  sunColor: THREE.Color;
  sunY: number; // sun elevation
}

const KEYFRAMES: SkyKeyframe[] = [
  // Dawn (0.2) — golden sunrise
  {
    t: 0.2,
    skyTop: new THREE.Color('#4A6FA5'),
    skyBottom: new THREE.Color('#F4A460'),
    fog: new THREE.Color('#D4A574'),
    fogNear: 50,
    fogFar: 180,
    ambientIntensity: 0.35,
    ambientColor: new THREE.Color('#FFE4C4'),
    hemiIntensity: 0.55,
    hemiSkyColor: new THREE.Color('#87CEEB'),
    hemiGroundColor: new THREE.Color('#8B7355'),
    sunIntensity: 0.7,
    sunColor: new THREE.Color('#FFD700'),
    sunY: 20,
  },
  // Day (0.5) — bright noon
  {
    t: 0.5,
    skyTop: new THREE.Color('#4A90D9'),
    skyBottom: new THREE.Color('#B0D4F1'),
    fog: new THREE.Color('#B8D4E8'),
    fogNear: 120,
    fogFar: 300,
    ambientIntensity: 0.45,
    ambientColor: new THREE.Color('#FFFFFF'),
    hemiIntensity: 0.7,
    hemiSkyColor: new THREE.Color('#87CEEB'),
    hemiGroundColor: new THREE.Color('#5D8C4A'),
    sunIntensity: 1.2,
    sunColor: new THREE.Color('#FFFFFF'),
    sunY: 80,
  },
  // Dusk (0.75) — warm sunset
  {
    t: 0.75,
    skyTop: new THREE.Color('#6B4C8A'),
    skyBottom: new THREE.Color('#FF7F50'),
    fog: new THREE.Color('#D4A080'),
    fogNear: 45,
    fogFar: 160,
    ambientIntensity: 0.3,
    ambientColor: new THREE.Color('#FFDAB9'),
    hemiIntensity: 0.5,
    hemiSkyColor: new THREE.Color('#CD853F'),
    hemiGroundColor: new THREE.Color('#6B4226'),
    sunIntensity: 0.6,
    sunColor: new THREE.Color('#FF6347'),
    sunY: 15,
  },
  // Night (0.0 / 1.0) — moonlight
  {
    t: 0.0,
    skyTop: new THREE.Color('#0D1530'),
    skyBottom: new THREE.Color('#1E2A50'),
    fog: new THREE.Color('#152238'),
    fogNear: 60,
    fogFar: 200,
    ambientIntensity: 0.22,
    ambientColor: new THREE.Color('#3A5A8C'),
    hemiIntensity: 0.28,
    hemiSkyColor: new THREE.Color('#2A3A5C'),
    hemiGroundColor: new THREE.Color('#1A2A3C'),
    sunIntensity: 0.18,
    sunColor: new THREE.Color('#C8D8F0'),
    sunY: 45,
  },
];

// Duplicate night at t=1.0 for wrapping
const NIGHT_FRAME = KEYFRAMES[3];
const FULL_CYCLE: SkyKeyframe[] = [
  { ...NIGHT_FRAME, t: 0.0 },
  KEYFRAMES[0], // dawn 0.2
  KEYFRAMES[1], // day 0.5
  KEYFRAMES[2], // dusk 0.75
  { ...NIGHT_FRAME, t: 1.0 },
];

export class DayNightCycle {
  private scene: THREE.Scene;
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private skyDome: THREE.Mesh | null = null;

  // Current values exposed for other systems
  nightFactor = 0; // 0=day, 1=night
  private dayTime = 0.3;
  private cycleSpeed = 1 / 120; // ~120 seconds per full cycle

  constructor(
    scene: THREE.Scene,
    sun: THREE.DirectionalLight,
    ambient: THREE.AmbientLight,
    hemi: THREE.HemisphereLight,
  ) {
    this.scene = scene;
    this.sun = sun;
    this.ambient = ambient;
    this.hemi = hemi;

    // Create gradient sky dome
    this.createSkyDome();
  }

  private createSkyDome(): void {
    const geo = new THREE.SphereGeometry(200, 64, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color('#4A90D9') },
        bottomColor: { value: new THREE.Color('#B0D4F1') },
        offset: { value: 20 },
        exponent: { value: 0.4 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0, offset, 0)).y;
          float t = clamp(pow(max(h, 0.0), exponent), 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(geo, mat);
    this.skyDome.name = 'skyDome';
    this.scene.add(this.skyDome);
  }

  /** Interpolate between two keyframes */
  private lerpKeyframes(a: SkyKeyframe, b: SkyKeyframe, t: number): SkyKeyframe {
    const ease = t; // linear is fine for slowly changing values
    return {
      t: THREE.MathUtils.lerp(a.t, b.t, ease),
      skyTop: a.skyTop.clone().lerp(b.skyTop, ease),
      skyBottom: a.skyBottom.clone().lerp(b.skyBottom, ease),
      fog: a.fog.clone().lerp(b.fog, ease),
      fogNear: THREE.MathUtils.lerp(a.fogNear, b.fogNear, ease),
      fogFar: THREE.MathUtils.lerp(a.fogFar, b.fogFar, ease),
      ambientIntensity: THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, ease),
      ambientColor: a.ambientColor.clone().lerp(b.ambientColor, ease),
      hemiIntensity: THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, ease),
      hemiSkyColor: a.hemiSkyColor.clone().lerp(b.hemiSkyColor, ease),
      hemiGroundColor: a.hemiGroundColor.clone().lerp(b.hemiGroundColor, ease),
      sunIntensity: THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, ease),
      sunColor: a.sunColor.clone().lerp(b.sunColor, ease),
      sunY: THREE.MathUtils.lerp(a.sunY, b.sunY, ease),
    };
  }

  setDayTime(dayTime: number): void {
    this.dayTime = dayTime % 1;
  }

  advance(dt: number): void {
    this.dayTime = (this.dayTime + dt * this.cycleSpeed) % 1;
  }

  update(): void {
    // Find surrounding keyframes
    let a = FULL_CYCLE[0], b = FULL_CYCLE[FULL_CYCLE.length - 1];
    for (let i = 0; i < FULL_CYCLE.length - 1; i++) {
      if (this.dayTime >= FULL_CYCLE[i].t && this.dayTime < FULL_CYCLE[i + 1].t) {
        a = FULL_CYCLE[i];
        b = FULL_CYCLE[i + 1];
        break;
      }
    }

    const range = b.t - a.t;
    const localT = range > 0 ? (this.dayTime - a.t) / range : 0;
    const kf = this.lerpKeyframes(a, b, localT);

    // Apply to scene
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(kf.skyTop);
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(kf.fog);
      this.scene.fog.near = kf.fogNear;
      this.scene.fog.far = kf.fogFar;
    }

    this.ambient.intensity = kf.ambientIntensity;
    this.ambient.color.copy(kf.ambientColor);

    this.hemi.intensity = kf.hemiIntensity;
    this.hemi.color.copy(kf.hemiSkyColor);
    this.hemi.groundColor.copy(kf.hemiGroundColor);

    this.sun.intensity = kf.sunIntensity;
    this.sun.color.copy(kf.sunColor);
    this.sun.position.set(50, kf.sunY, 30);

    // Update sky dome shader
    if (this.skyDome) {
      const mat = this.skyDome.material as THREE.ShaderMaterial;
      mat.uniforms.topColor.value.copy(kf.skyTop);
      mat.uniforms.bottomColor.value.copy(kf.skyBottom);
    }

    // Compute night factor for other systems (0=day, 1=night)
    // Night peaks at t=0 and t=1, day peaks at t=0.5
    this.nightFactor = 1 - Math.sin(this.dayTime * Math.PI);
  }

  dispose(): void {
    if (this.skyDome) {
      this.scene.remove(this.skyDome);
      this.skyDome.geometry.dispose();
      (this.skyDome.material as THREE.ShaderMaterial).dispose();
    }
  }
}
