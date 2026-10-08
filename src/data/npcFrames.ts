/** 有 Codex 生成逐格動作的 NPC（tools/buildNpcFrames.py），值為各動作的影格數。 */
export const NPC_FRAMES: Readonly<Record<string, { idle?: number; gesture?: number }>> = {
  master: { idle: 4, gesture: 4 },
  qing: { idle: 4, gesture: 4 },
  yin: { idle: 4, gesture: 4 },
  fong: { idle: 4, gesture: 4 },
  wo: { idle: 4, gesture: 4 },
  'chance-qinglan': { idle: 4, gesture: 4 },
  'chance-tangwan': { idle: 4, gesture: 4 },
  'chance-suyin': { idle: 4, gesture: 4 },
};

export type NpcAction = 'idle' | 'gesture';
