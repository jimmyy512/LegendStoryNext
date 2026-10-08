/** 有 Codex 生成逐格動作的 NPC（tools/buildNpcFrames.py），值為各動作的影格數。 */
export const NPC_FRAMES: Readonly<Record<string, { idle?: number; gesture?: number }>> = {
  qing: { idle: 4 },
};

export type NpcAction = 'idle' | 'gesture';
