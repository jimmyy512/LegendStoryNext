export const HAIR_STYLES = ['Hair1', 'Hair2', 'Hair3', 'Hair4'] as const;
/** Hair3 remains valid in older saves; the current rig renders it as the same ponytail as Hair1. */
export const SELECTABLE_HAIR_STYLES = ['Hair1', 'Hair2'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const HAIR_NAMES: Record<HairStyle, string> = {
  Hair1: '束髮',
  Hair2: '髮髻',
  Hair3: '束髮',
  Hair4: '斗笠',
};

export function isHairStyle(value: string): value is HairStyle {
  return HAIR_STYLES.some((style) => style === value);
}
