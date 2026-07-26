// ============================================================
// PostProcessing — Film-grade look with era-driven colour grade,
// bloom, vignette, and grain. Ported from opus5 World.js.
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { EraGrade } from '@monopoly/shared';

// ── Film Grade Shader ──────────────────────────────────────────

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    contrast: { value: 1.0 },
    saturation: { value: 1.0 },
    warmth: { value: 0.0 },
    vignette: { value: 0.3 },
    grain: { value: 0.02 },
    time: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float contrast, saturation, warmth, vignette, grain, time;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;

      // Contrast
      col = (col - 0.5) * contrast + 0.5;

      // Saturation
      float gray = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(gray), col, saturation);

      // Warmth (red/blue shift)
      col.r += warmth * 0.08;
      col.b -= warmth * 0.06;

      // Film grain (animated)
      float n = hash(vUv * vec2(1920.0, 1080.0) + time) * 2.0 - 1.0;
      col += n * grain;

      // Vignette
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - smoothstep(0.35, 0.95, d) * vignette;

      gl_FragColor = vec4(col, c.a);
    }
  `,
};

// ── PostProcessing Manager ─────────────────────────────────────

export class PostProcessing {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  gradePass: ShaderPass;

  private renderer: THREE.WebGLRenderer;
  private bloomOn = true;
  private targetGrade: EraGrade | null = null;
  private currentGrade: EraGrade | null = null;
  private gradeT = 1.0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ) {
    this.renderer = renderer;
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // Bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h), 0.55, 0.4, 0.85,
    );
    this.composer.addPass(this.bloomPass);

    // Film grade
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    // Output (tone-map / colour-space)
    this.composer.addPass(new OutputPass());
  }

  /** Transition to a new era grade (lerps smoothly). */
  setGrade(grade: EraGrade, instant = false): void {
    this.targetGrade = grade;
    if (instant || !this.currentGrade) {
      this.currentGrade = { ...grade };
      this.gradeT = 1.0;
      this.applyGrade(this.currentGrade, 1);
    } else {
      this.gradeT = 0.0;
    }
  }

  setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength;
  }

  setBloomEnabled(on: boolean): void {
    this.bloomOn = on;
    this.bloomPass.enabled = on;
  }

  /** Call each frame to smooth-transition grade & animate grain */
  update(dt: number): void {
    if (this.targetGrade && this.gradeT < 1.0) {
      this.gradeT = Math.min(1.0, this.gradeT + dt * 0.85);
      this.applyGrade(this.targetGrade, this.gradeT);
      if (this.gradeT >= 1.0) {
        this.currentGrade = { ...this.targetGrade };
      }
    }

    // Animate film grain
    this.gradePass.uniforms.time.value += dt;
  }

  private applyGrade(g: EraGrade, t: number): void {
    const from = this.currentGrade;
    const lerp = (a: number, b: number) => a + (b - a) * t;
    if (from) {
      this.gradePass.uniforms.contrast.value = lerp(from.contrast, g.contrast);
      this.gradePass.uniforms.saturation.value = lerp(from.saturation, g.saturation);
      this.gradePass.uniforms.warmth.value = lerp(from.warmth, g.warmth);
      this.gradePass.uniforms.vignette.value = lerp(from.vignette, g.vignette);
      this.gradePass.uniforms.grain.value = lerp(from.grain, g.grain);
    } else {
      this.gradePass.uniforms.contrast.value = g.contrast;
      this.gradePass.uniforms.saturation.value = g.saturation;
      this.gradePass.uniforms.warmth.value = g.warmth;
      this.gradePass.uniforms.vignette.value = g.vignette;
      this.gradePass.uniforms.grain.value = g.grain;
    }
  }

  render(): void {
    this.composer.render();
  }

  resize(w: number, h: number): void {
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
