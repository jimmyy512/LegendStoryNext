/**
 * Codex 生成的逐格攻擊（站姿、蓄勢、舉起、出手、延伸、收勢）與四格受擊，
 * 由 tools/buildEnemyFrames.py 對位：貼圖單位與待機圖相同，腳底在格底。
 */
export const ENEMY_SEQUENCES: Readonly<Record<string, { strike: number; hurt: number }>> = {
  disciple: { strike: 6, hurt: 4 },
  zombie: { strike: 6, hurt: 4 },
  boss: { strike: 6, hurt: 4 },
};
