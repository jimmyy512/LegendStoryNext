import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { dialoguePortrait } from '../src/ui/dialoguePortrait';

describe('互動立繪', () => {
  const entities = Object.values(MAPS).flatMap((map) => map.entities);

  it('所有非人物互動使用物件圖，人物仍保留人物立繪', () => {
    for (const entity of entities.filter((entry) => entry.kind !== 'portal')) {
      const art = dialoguePortrait(entity);
      const person = entity.kind === 'npc' || entity.kind === 'enemy';
      expect(art.includes('object-portrait')).toBe(!person);
      expect(art.includes('portrait-bg-npc')).toBe(person);
    }
  });

  it('木箱、青蘭、酒壺與手札不是同一張圖', () => {
    const art = ['forest-chest', 'flower', 'wine', 'journal'].map((id) => {
      const entity = entities.find((entry) => entry.id === id)!;
      return dialoguePortrait({ ...entity, name: '測試物件' });
    });
    expect(new Set(art).size).toBe(4);
    expect(art[2]).toContain('>酒</text>');
  });

  it('物件名稱不能插入額外 HTML', () => {
    const art = dialoguePortrait({ id: 'other', name: '\"><script>', kind: 'clue', x: 0, y: 0 });
    expect(art).toContain('&quot;&gt;&lt;script&gt;');
    expect(art).not.toContain('<script>');
  });
});
