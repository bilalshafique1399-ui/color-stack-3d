import * as THREE from 'three';

/**
 * Curated high-vibrancy Color Stack palette stops.
 * Smoothly interpolates across tropical coral,amber, emerald, sky cyan, cobalt, and orchid.
 */
const VIBRANT_STOPS = [
  '#FF5E7E', // Coral Rose
  '#FF8A48', // Sunset Tangerine
  '#FFC847', // Sunburst Gold
  '#38E596', // Mint Emerald
  '#14D2F4', // Electric Sky Cyan
  '#4F7BFF', // Cobalt Sapphire
  '#9D5CFF', // Vivid Orchid
  '#FF4FA3', // Berry Magenta
];

const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

export function getBlockColor(layerIndex: number, seedOffset: number, outColor?: THREE.Color): THREE.Color {
  const target = outColor ?? new THREE.Color();
  const progress = (layerIndex * 0.14 + seedOffset) % VIBRANT_STOPS.length;
  const idxA = Math.floor(progress) % VIBRANT_STOPS.length;
  const idxB = (idxA + 1) % VIBRANT_STOPS.length;
  const t = progress - Math.floor(progress);

  _colorA.set(VIBRANT_STOPS[idxA]);
  _colorB.set(VIBRANT_STOPS[idxB]);
  target.copy(_colorA).lerp(_colorB, t);
  return target;
}

export function getAtmosphereColors(layerIndex: number, seedOffset: number): { topHex: string; bottomHex: string } {
  const baseHue = ((layerIndex * 3.5 + seedOffset * 45) % 360) / 360;
  _colorA.setHSL(baseHue, 0.48, 0.13);
  _colorB.setHSL((baseHue + 0.08) % 1.0, 0.55, 0.24);
  return {
    topHex: `#${_colorA.getHexString()}`,
    bottomHex: `#${_colorB.getHexString()}`,
  };
}
