import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'

/**
 * Weathering v3 wear shaders.
 * Per decay.md: surface/material lead; structural failure late, partial, localized;
 * shell never dissolves into lattice/ground. Mass stays mass.
 */

const WEAR_VARYING = /* glsl */ `
attribute float aEdge;
attribute float aNoise;
attribute vec3 aDrape;
uniform float uWear;
uniform float uBaseY;
uniform vec2 uTilt;
uniform vec3 uFail; // x = fail side 0..3, y = roof fail seed, z = window fail seed
uniform vec3 uOrigin; // cell centroid xz in x/z, unused y
varying float vEdge;
varying float vNoise;
varying vec3 vLocal;
varying float vRelY;
varying float vSideFail;
varying float vRoofFail;
varying float vPanelMask; // 1 = single cladding panel (one bay × one story)
`

/**
 * Plaster / foundation / shell vertex path.
 * aNoise is fragment-only mottling — NEVER displaces the mass.
 * The only stage-driven move is a reclaim-gated lintel sag on the single fail bay.
 */
const WEAR_VERTEX_PLASTER = /* glsl */ `
#include <begin_vertex>
float story = 1.05;
float h = max(position.y - uBaseY, 0.0);
vRelY = clamp(h / max(story * 4.0, 0.001), 0.0, 1.0);

vec2 d = position.xz - uOrigin.xz;
float ax = abs(d.x);
float az = abs(d.y);
float side = ax > az ? (d.x >= 0.0 ? 1.0 : 3.0) : (d.y >= 0.0 ? 2.0 : 0.0);
float failSide = floor(uFail.x + 0.001);
vSideFail = step(0.5, 1.0 - abs(side - failSide));
vRoofFail = 0.0;

// One bay (near face center) × ground story only — not the whole fail facade.
float along = side == 1.0 || side == 3.0 ? d.y : d.x;
float bay = 1.0 - smoothstep(0.16, 0.34, abs(along));
float yStory = h / story;
float story0 = smoothstep(0.28, 0.42, yStory) * (1.0 - smoothstep(0.78, 0.92, yStory));
vPanelMask = vSideFail * bay * story0;

float reclaim = smoothstep(2.15, 2.45, uWear);

// Lintel sag only over that same single panel.
float lintelBand = smoothstep(0.55, 0.62, yStory) * (1.0 - smoothstep(0.7, 0.8, yStory));
float lintelSag = reclaim * vPanelMask * lintelBand;
transformed.y -= story * 0.16 * lintelSag;

vEdge = aEdge;
vNoise = aNoise;
vLocal = position;
`

/** Tarp-only: retract toward tie points. Not applied to plaster shells. */
const WEAR_VERTEX_TARP = /* glsl */ `
#include <begin_vertex>
float story = 1.05;
vRelY = clamp((position.y - uBaseY) / max(story * 4.0, 0.001), 0.0, 1.0);
vSideFail = 0.0;
vRoofFail = 0.0;
vPanelMask = 0.0;
float drapeAmt = smoothstep(1.45, 2.45, uWear);
transformed += aDrape * (1.0 - drapeAmt);
vEdge = aEdge;
vNoise = aNoise;
vLocal = position;
`

const WEAR_FRAGMENT = /* glsl */ `
#include <color_fragment>
float intensity = max(uWearIntensity, 0.0);
float settled = smoothstep(0.2, 1.05, uWear) * intensity;
float abandoned = smoothstep(1.05, 2.05, uWear) * intensity;
float reclaim = smoothstep(2.15, 2.95, uWear) * intensity;

// —— Shared concrete/plaster recipe: mottled chalk + soft stain — NOT board siding ——
vec3 concrete = vec3(0.72, 0.71, 0.68);
vec3 painted = mix(concrete, uPaint, 0.28);
vec3 col = mix(painted, diffuseColor.rgb, 0.22);
vec3 chalk = vec3(0.86, 0.84, 0.78);
float face = 1.0 - vEdge;
// Irregular blotches from aNoise — never a regular vertical period.
float blotch = smoothstep(0.28, 0.82, vNoise);
col = mix(col, mix(col, chalk, 0.7), settled * face * (0.22 + 0.45 * blotch));
col = mix(col, col * vec3(0.8, 0.78, 0.74), abandoned * face * (0.15 + 0.28 * blotch));

// Soft water stain at roof/sill bands + sparse blotches (no fract-stripe "planks").
float sillBand = smoothstep(0.32, 0.4, vRelY) * (1.0 - smoothstep(0.42, 0.5, vRelY));
float roofRun = smoothstep(0.78, 0.95, vRelY);
float stain = (roofRun * 0.55 + sillBand * 0.7 + blotch * 0.28)
  * smoothstep(0.35, 1.2, uWear) * intensity;
vec3 stainCol = vec3(0.42, 0.38, 0.32);
col = mix(col, col * stainCol, clamp(stain * 0.4, 0.0, 0.55));

// Rust on metal edges only; rare drips require strong aEdge (lintel/rail), not whole faces.
float rustAmt = smoothstep(0.85, 2.0, uWear) * intensity;
vec3 rustCol = vec3(0.52, 0.22, 0.08);
float rustPatch = smoothstep(0.55, 0.95, fract(vNoise * 9.0 + vLocal.y * 0.7));
col = mix(col, rustCol, rustAmt * vEdge * (0.55 + 0.4 * rustPatch));
float dripPath = fract(vNoise * 6.3 + vLocal.y * 0.15);
float drip = smoothstep(0.12, 0.0, abs(dripPath - 0.5))
  * smoothstep(0.92, 0.45, vRelY)
  * vEdge;
col = mix(col, rustCol * 0.88, rustAmt * drip * 0.35);

// —— One missing cladding panel (single bay × ground story). Caps early in
// reclaim; does not grow with more age or wearIntensity; no noise shredding.
float holeGate = smoothstep(2.2, 2.4, uWear); // saturates; ignores intensity
float hole = holeGate * vPanelMask;
vec3 voidCol = vec3(0.04, 0.045, 0.055);
col = mix(col, voidCol, hole * 0.88);
col = mix(col, rustCol, hole * vEdge * 0.45);

// Footing reads stained, not dissolved into terrain (debris is separate geometry).
float footing = 1.0 - smoothstep(0.0, 0.14, vRelY);
col = mix(col, col * vec3(0.62, 0.58, 0.52), reclaim * footing * 0.25);

// Reclaimed: chalked masonry + edge rust — mass remains legible.
col = mix(col, col * vec3(0.9, 0.88, 0.84), reclaim * face * 0.18);
col = mix(col, rustCol * 0.75, reclaim * vEdge * 0.4);

diffuseColor.rgb = col;
`

export type WearUniforms = {
  uWear: { value: number }
  uBaseY: { value: number }
  uTilt: { value: Vector2 }
  uPaint: { value: Color }
  uGround: { value: Color }
  uWearIntensity: { value: number }
  uFail: { value: Vector3 }
  uOrigin: { value: Vector3 }
}

/**
 * Fallback failure params when neighbors are unknown (e.g. freestanding scenery).
 * South bay fails (default street face); roof/window strength from radial distance.
 * Prefer failFromExposure() from lotRules when neighbors are known.
 */
export function cellFailParams(ix: number, iz: number, height = 3, maxStories = 8) {
  const r = Math.sqrt(ix * ix + iz * iz)
  const rim = Math.min(1, r / 8)
  return {
    failSide: 0,
    roofSeed: 0.25 + 0.75 * Math.min(1, height / Math.max(1, maxStories)),
    windowSeed: 0.35 + rim * 0.4,
  }
}

export function createWearUniforms(
  baseY: number,
  tiltX: number,
  tiltZ: number,
  paint: Color,
  originX = 0,
  originZ = 0,
  failSide = 0,
  roofSeed = 0.5,
  windowSeed = 0.5,
): WearUniforms {
  return {
    uWear: { value: 0 },
    uBaseY: { value: baseY },
    uTilt: { value: new Vector2(tiltX, tiltZ) },
    uPaint: { value: paint.clone() },
    uGround: { value: new Color('#2c3038') },
    uWearIntensity: { value: 1 },
    uFail: { value: new Vector3(failSide, roofSeed, windowSeed) },
    uOrigin: { value: new Vector3(originX, baseY, originZ) },
  }
}

function bindWear(material: MeshStandardMaterial | ShaderMaterial, wear: WearUniforms, fragment: boolean) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWear = wear.uWear
    shader.uniforms.uBaseY = wear.uBaseY
    shader.uniforms.uTilt = wear.uTilt
    shader.uniforms.uPaint = wear.uPaint
    shader.uniforms.uGround = wear.uGround
    shader.uniforms.uWearIntensity = wear.uWearIntensity
    shader.uniforms.uFail = wear.uFail
    shader.uniforms.uOrigin = wear.uOrigin
    const vertexChunk = fragment ? WEAR_VERTEX_PLASTER : WEAR_VERTEX_TARP
    shader.vertexShader = WEAR_VARYING + shader.vertexShader.replace('#include <begin_vertex>', vertexChunk)
    if (fragment) {
      shader.fragmentShader =
        /* glsl */ `
          varying float vEdge;
          varying float vNoise;
          varying vec3 vLocal;
          varying float vRelY;
          varying float vSideFail;
          varying float vRoofFail;
          varying float vPanelMask;
          uniform float uWear;
          uniform float uWearIntensity;
          uniform vec3 uPaint;
          uniform vec3 uGround;
          uniform vec3 uFail;
        ` + shader.fragmentShader.replace('#include <color_fragment>', WEAR_FRAGMENT)
    }
  }
  material.customProgramCacheKey = () =>
    fragment ? 'weathering-v3-plaster-wear-v7' : 'weathering-v3-tarp-wear-v7'
  material.needsUpdate = true
}

export function createPlasterMaterial(wear: WearUniforms) {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
  })
  bindWear(material, wear, true)
  return material
}

export function createTarpMaterial(wear: WearUniforms) {
  // Worn canvas — lit like the shell (Standard), not an unlit black silhouette.
  const material = new MeshStandardMaterial({
    color: '#b8a888',
    roughness: 0.92,
    metalness: 0,
    side: DoubleSide,
    transparent: true,
    opacity: 1,
    depthWrite: true,
  })
  bindWear(material, wear, false)
  const wearCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    wearCompile(shader, renderer)
    shader.fragmentShader =
      'uniform float uWear;\n' +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        /* glsl */ `
          // Small deferred-maintenance patches; keep fabric readable under lights.
          float show = smoothstep(1.45, 2.2, uWear);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.85, show * 0.25);
          diffuseColor.a *= mix(0.0, 0.92, show);
          #include <opaque_fragment>
        `,
      )
  }
  material.customProgramCacheKey = () => 'weathering-v3-tarp-wear-v7'
  return material
}

/**
 * Sparse base rubble — fades in at reclaimed only.
 * No wear vertex warp (mass/debris stay where placed).
 */
export function createDebrisMaterial(wear: WearUniforms) {
  const material = new MeshStandardMaterial({
    color: '#5c534a',
    roughness: 1,
    metalness: 0.08,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: DoubleSide,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWear = wear.uWear
    shader.fragmentShader =
      'uniform float uWear;\n' +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        /* glsl */ `
          // Left-behind scrap at the shell base — not landscaping.
          float show = smoothstep(2.05, 2.7, uWear);
          diffuseColor.a *= show;
          #include <opaque_fragment>
        `,
      )
  }
  material.customProgramCacheKey = () => 'weathering-v3-debris-v1'
  material.needsUpdate = true
  return material
}

export function createGlowMaterial(wear: WearUniforms) {
  return new ShaderMaterial({
    uniforms: {
      uWear: wear.uWear,
      uBaseY: wear.uBaseY,
      uTilt: wear.uTilt,
      uFail: wear.uFail,
      uOrigin: wear.uOrigin,
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    toneMapped: false,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
}

/**
 * Per-pane glazing. aOrder / aSideDist drive wear-ordered crack→break
 * (fail bay first; opposite face never fully gone). Independent of cladding void.
 */
export function createGlassMaterial(wear: WearUniforms) {
  return new ShaderMaterial({
    uniforms: {
      uWear: wear.uWear,
      uLightDir: { value: new Vector3(0.45, 0.85, 0.35).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aOrder;
      attribute float aSideDist;
      uniform float uWear;
      varying float vCrack;
      varying float vBroken;
      varying vec3 vViewN;
      varying vec3 vViewPos;
      varying vec3 vWorldN;
      void main() {
        // Thresholds match lotRules glassCrackWear / glassBreakWear (held = intact).
        float order = aOrder;
        float sd = aSideDist;
        float crackAt = sd >= 1.5 ? 1.85 + order * 0.1 : sd >= 0.5 ? 1.25 + order * 0.16 : 1.0 + order * 0.14;
        float breakAt = sd >= 1.5 ? 9.0 : sd >= 0.5 ? 2.55 + order * 0.12 : 1.45 + order * 0.18;
        vBroken = sd >= 1.5 ? 0.0 : smoothstep(breakAt, breakAt + 0.2, uWear);
        vCrack = smoothstep(crackAt, crackAt + 0.18, uWear) * (1.0 - vBroken);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vViewN = normalize(normalMatrix * normal);
        vWorldN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightDir;
      varying float vCrack;
      varying float vBroken;
      varying vec3 vViewN;
      varying vec3 vViewPos;
      varying vec3 vWorldN;
      void main() {
        // Intact: cool lit glass. Cracked: duller with grit. Broken: nearly gone.
        vec3 n = normalize(vWorldN);
        float ndl = max(dot(n, normalize(uLightDir)), 0.0);
        vec3 viewDir = normalize(-vViewPos);
        float fres = pow(1.0 - max(abs(dot(normalize(vViewN), viewDir)), 0.0), 2.2);
        vec3 glassCol = vec3(0.58, 0.66, 0.72);
        vec3 lit = glassCol * (0.38 + 0.5 * ndl) + vec3(0.55, 0.6, 0.65) * fres * 0.55;
        vec3 cracked = mix(lit, lit * vec3(0.55, 0.52, 0.48), 0.55);
        vec3 voidCol = vec3(0.04, 0.045, 0.05);
        vec3 col = mix(mix(lit, cracked, clamp(vCrack, 0.0, 1.0)), voidCol, clamp(vBroken, 0.0, 1.0));
        float alpha = mix(mix(0.58, 0.4, vCrack), 0.05, vBroken);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
  })
}
