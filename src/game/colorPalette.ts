import * as THREE from 'three';

export type CubeSkinId = 'classic' | 'gold' | 'diamond' | 'fire' | 'ramzan';

const SKIN_STOPS: Record<CubeSkinId, string[]> = {
  classic: [
    '#FF5E7E', // Coral Rose
    '#FF8A48', // Sunset Tangerine
    '#FFC847', // Sunburst Gold
    '#38E596', // Mint Emerald
    '#14D2F4', // Electric Sky Cyan
    '#4F7BFF', // Cobalt Sapphire
    '#9D5CFF', // Vivid Orchid
    '#FF4FA3', // Berry Magenta
  ],
  gold: [
    '#FDE047', // 24K Bright Gold
    '#FACC15', // Royal Gold
    '#F59E0B', // Warm Amber Gold
    '#FEF08A', // Champagne Gleam
    '#EAB308', // Imperial Bullion
  ],
  diamond: [
    '#E0F2FE', // Frosted Diamond
    '#7DD3FC', // Crystal Sky
    '#38BDF8', // Glacial Cyan
    '#A5F3FC', // Prism Ice
    '#818CF8', // Sapphire Facet
  ],
  fire: [
    '#FF2A54', // Crimson Flare
    '#FF5500', // Molten Magma
    '#FF8800', // Solar Blaze
    '#FFB703', // White-Hot Core
    '#DC2626', // Ember Ruby
  ],
  ramzan: [
    '#10B981', // Crescent Emerald
    '#FACC15', // Lantern Gold
    '#34D399', // Oasis Mint
    '#FDE68A', // Starlight Gold
    '#059669', // Royal Jade
  ],
};

export interface SkinMaterialSpec {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  baseEmissiveHex: number;
}

export function getSkinMaterialSpec(skinId: CubeSkinId): SkinMaterialSpec {
  switch (skinId) {
    case 'gold':
      return {
        roughness: 0.16,
        metalness: 0.82,
        clearcoat: 0.65,
        clearcoatRoughness: 0.12,
        baseEmissiveHex: 0x291800,
      };
    case 'diamond':
      return {
        roughness: 0.08,
        metalness: 0.34,
        clearcoat: 0.96,
        clearcoatRoughness: 0.06,
        baseEmissiveHex: 0x051b2c,
      };
    case 'fire':
      return {
        roughness: 0.22,
        metalness: 0.24,
        clearcoat: 0.52,
        clearcoatRoughness: 0.16,
        baseEmissiveHex: 0x3b0a00,
      };
    case 'ramzan':
      return {
        roughness: 0.14,
        metalness: 0.56,
        clearcoat: 0.82,
        clearcoatRoughness: 0.1,
        baseEmissiveHex: 0x042619,
      };
    default:
      return {
        roughness: 0.24,
        metalness: 0.06,
        clearcoat: 0.42,
        clearcoatRoughness: 0.18,
        baseEmissiveHex: 0x000000,
      };
  }
}

const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

export function getBlockColor(
  layerIndex: number,
  seedOffset: number,
  skinId: CubeSkinId = 'classic',
  outColor?: THREE.Color,
): THREE.Color {
  const stops = SKIN_STOPS[skinId] ?? SKIN_STOPS.classic;
  const target = outColor ?? new THREE.Color();
  const progress = Math.abs(layerIndex * 0.18 + seedOffset) % stops.length;
  const idxA = Math.floor(progress) % stops.length;
  const idxB = (idxA + 1) % stops.length;
  const t = progress - Math.floor(progress);

  _colorA.set(stops[idxA]);
  _colorB.set(stops[idxB]);
  target.copy(_colorA).lerp(_colorB, t);
  return target;
}

export function getAtmosphereColors(
  layerIndex: number,
  seedOffset: number,
  skinId: CubeSkinId = 'classic',
): { topHex: string; bottomHex: string } {
  if (skinId === 'gold') {
    return { topHex: '#18130a', bottomHex: '#332510' };
  }
  if (skinId === 'diamond') {
    return { topHex: '#0a1628', bottomHex: '#132d4e' };
  }
  if (skinId === 'fire') {
    return { topHex: '#1c0a0e', bottomHex: '#3c1318' };
  }
  if (skinId === 'ramzan') {
    return { topHex: '#061c17', bottomHex: '#0d382d' };
  }

  const baseHue = ((layerIndex * 3.5 + seedOffset * 45) % 360) / 360;
  _colorA.setHSL(baseHue, 0.48, 0.13);
  _colorB.setHSL((baseHue + 0.08) % 1.0, 0.55, 0.24);
  return {
    topHex: `#${_colorA.getHexString()}`,
    bottomHex: `#${_colorB.getHexString()}`,
  };
}
