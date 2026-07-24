// ============================================================
// ModelLoader — GLTF/GLB model loading with caching
// ============================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/** Cache of loaded models: url → original group (never mutated, clone for each use) */
const modelCache = new Map<string, THREE.Group>();

/**
 * Load a GLB/GLTF model. Results are cached — subsequent calls return instantly.
 * Enable shadows on all child meshes automatically.
 */
export function loadModel(url: string): Promise<THREE.Group> {
  const cached = modelCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        // Enable shadows on all meshes
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        modelCache.set(url, gltf.scene);
        resolve(gltf.scene);
      },
      undefined, // onProgress
      (err) => reject(new Error(`Failed to load model "${url}": ${err}`)),
    );
  });
}

/**
 * Preload multiple models in parallel. Returns when all are cached.
 * Call this early (e.g. during a loading screen) so loadModel() is instant later.
 */
export async function preloadModels(urls: string[]): Promise<void> {
  await Promise.all(urls.map((url) => loadModel(url)));
}

/**
 * Get a clone of a cached model. Returns null if the model hasn't been loaded yet.
 * Use this to place independent instances of the same model in the scene.
 */
export function getModelClone(url: string): THREE.Group | null {
  const cached = modelCache.get(url);
  if (!cached) return null;
  // deep-clone so each instance is independent
  return cached.clone(true);
}
