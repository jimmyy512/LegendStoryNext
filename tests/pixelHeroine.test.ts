import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AtlasAttachmentLoader,
  RegionAttachment,
  SkeletonJson,
  Spine,
  TextureAtlas,
} from '@esotericsoftware/spine-pixi-v8';
import {
  DEFAULT_LOOK,
  GEAR_SLOTS,
  PixelHeroine,
  WEAPONS,
  type PixelLook,
  type PixelMotion,
  type PixelWeapon,
} from '../src/render/PixelHeroine';

const base = 'public/assets/characters/pixelHeroine/';
const atlas = new TextureAtlas(readFileSync(`${base}pixel-heroine.atlas`, 'utf8'));
const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
  JSON.parse(readFileSync(`${base}pixel-heroine.json`, 'utf8')),
);
function heroine() {
  // Only replace asset fetching. Exercise the real Spine skeleton, skins and animation state.
  vi.spyOn(Spine, 'from').mockImplementation(
    () => new Spine({ skeletonData: data, autoUpdate: false }),
  );
  return new PixelHeroine('test/');
}
afterEach(() => vi.restoreAllMocks());
const look = (change: Partial<PixelLook>): PixelLook => ({ ...DEFAULT_LOOK, ...change });

/** 靴子附件四角中最低的一點（y 向下，0 為地面）。 */
function soles(hero: PixelHeroine): number[] {
  const vertices = new Float32Array(8);
  return ['bootL', 'bootR'].map((name) => {
    const slot = hero.actor.skeleton.findSlot(name)!;
    const attachment = slot.pose.attachment as RegionAttachment;
    attachment.computeWorldVertices(slot, attachment.getOffsets(slot.pose), vertices, 0, 2);
    return Math.max(vertices[1], vertices[3], vertices[5], vertices[7]);
  });
}
const world = (hero: PixelHeroine, bone: string) => hero.actor.skeleton.findBone(bone)!.appliedPose;

describe('像素女俠的實際骨架與裝備', () => {
  it('空手與持劍使用不同待機、步行與攻擊軌道', () => {
    const hero = heroine();
    hero.pose('idle', 0.2);
    expect(hero.actor.state.getTrack(0)!.animation!.name).toBe('idle');
    hero.equip(look({ outfit: 'ivory', weapon: 'sword' }), 'healthy');
    hero.pose('idle', 0.2);
    expect(hero.actor.state.getTrack(0)!.animation!.name).toBe('idleArmedR');
    hero.pose('walk', 0.2);
    expect(hero.actor.state.getTrack(0)!.animation!.name).toBe('walkArmedR');
    hero.pose('attack', 0.45);
    expect(hero.actor.state.getTrack(0)!.animation!.name).toBe('slashR');
    // 引刃時持劍手舉過頭頂。
    expect(world(hero, 'weaponR').worldY).toBeLessThan(world(hero, 'head').worldY);
    hero.equip(look({ outfit: 'ivory', weapon: 'none' }), 'healthy');
    hero.pose('attack', 0.45);
    expect(hero.actor.state.getTrack(0)!.animation!.name).toBe('palmBoth');
    hero.destroy({ children: true });
  });

  it('每種兵器都有跑、跳、倒地，失能時換左手版本', () => {
    const hero = heroine();
    for (const weapon of Object.keys(WEAPONS) as PixelWeapon[]) {
      for (const injury of ['healthy', 'disabled'] as const) {
        hero.equip(look({ weapon }), injury);
        for (const motion of ['run', 'jump', 'down'] as const) {
          hero.pose(motion, 0.3);
          const name = hero.actor.state.getTrack(0)!.animation!.name;
          expect(name.startsWith(motion)).toBe(true);
          if (WEAPONS[weapon].sided) {
            expect(name.endsWith(injury === 'disabled' ? 'L' : 'R')).toBe(true);
          }
        }
      }
    }
    hero.destroy({ children: true });
  });

  it('跳躍騰空時雙腳離地並收腿，落地後回到地面', () => {
    const hero = heroine();
    hero.pose('jump', 0);
    const standing = world(hero, 'hip').worldY;
    hero.pose('jump', 0.45);
    // y 向下：騰空時靴底高於地面，髖部也比起跳前高。
    expect(Math.max(...soles(hero))).toBeLessThan(-20);
    expect(world(hero, 'hip').worldY).toBeLessThan(standing - 25);
    const leg = Math.hypot(
      world(hero, 'footR').worldX - world(hero, 'thighR').worldX,
      world(hero, 'footR').worldY - world(hero, 'thighR').worldY,
    );
    hero.pose('idle', 0);
    const straight = Math.hypot(
      world(hero, 'footR').worldX - world(hero, 'thighR').worldX,
      world(hero, 'footR').worldY - world(hero, 'thighR').worldY,
    );
    expect(leg).toBeLessThan(straight - 3);
    hero.pose('jump', 0.9);
    for (const sole of soles(hero)) {
      expect(Math.abs(sole)).toBeLessThan(1.5);
    }
    hero.destroy({ children: true });
  });

  it('倒地後整個人向後躺平，頭在腳的後方且貼近地面', () => {
    const hero = heroine();
    hero.pose('down', 1.4);
    const head = world(hero, 'head');
    const foot = world(hero, 'footR');
    expect(head.worldX).toBeLessThan(foot.worldX - 40);
    expect(Math.abs(head.worldY)).toBeLessThan(20);
    hero.destroy({ children: true });
  });

  it('臉型依髮色換整顆頭，髮型只管馬尾', () => {
    const hero = heroine();
    const faces = hero.faces('silver');
    expect(faces).toEqual(
      expect.arrayContaining(['classic', 'phoenix', 'round', 'serene', 'fierce']),
    );
    const head = () =>
      (hero.actor.skeleton.findSlot('head')!.pose.attachment as RegionAttachment).path;
    hero.equip(look({ hairColor: 'silver', face: 'fierce' }), 'healthy');
    expect(head()).toBe('head_silver_fierce');
    hero.equip(look({ hairColor: 'silver', face: 'classic', hairStyle: 'bun' }), 'healthy');
    expect(head()).toBe('head_silver');
    expect(hero.actor.skeleton.findSlot('hair')!.pose.attachment).toBeNull();
    hero.destroy({ children: true });
  });

  it('站定的動作中，兩隻靴底都貼在地面且不滑動', () => {
    const hero = heroine();
    for (const [weapon, motions] of [
      ['none', ['idle', 'attack', 'hurt']],
      ['sword', ['idle', 'attack', 'hurt']],
      ['spear', ['idle', 'attack', 'hurt']],
      ['fan', ['idle', 'attack']],
      ['darts', ['idle', 'attack']],
      ['knuckles', ['idle', 'attack']],
    ] as const) {
      hero.equip(look({ weapon }), 'healthy');
      for (const motion of motions as readonly PixelMotion[]) {
        const feet: number[][] = [];
        for (const time of [0, 0.25, 0.5, 0.62, 0.75, 1.2]) {
          hero.pose(motion, time);
          soles(hero).forEach((y) => expect(y).toBeCloseTo(0, 1));
          feet.push(['L', 'R'].map((side) => world(hero, `foot${side}`).worldX));
        }
        for (const sample of feet) {
          sample.forEach((x, i) => expect(x).toBeCloseTo(feet[0][i], 3));
        }
      }
    }
    hero.destroy({ children: true });
  });

  it('走路時每一格至少一隻腳著地，另一腳會抬起', () => {
    const hero = heroine();
    let lifted = 0;
    for (let frame = 0; frame < 20; frame++) {
      hero.pose('walk', frame / 25);
      const [left, right] = soles(hero);
      expect(Math.max(left, right)).toBeCloseTo(0, 1);
      if (Math.min(left, right) < -2) {
        lifted++;
      }
    }
    expect(lifted).toBeGreaterThan(4);
    hero.destroy({ children: true });
  });

  it('出掌時腰部前移、雙掌推到頭部前方', () => {
    const hero = heroine();
    hero.pose('attack', 0);
    const guardHip = hero.actor.skeleton.findBone('hip')!.pose.x;
    hero.pose('attack', 0.75);
    expect(hero.actor.skeleton.findBone('hip')!.pose.x).toBeGreaterThan(guardHip + 5);
    for (const side of ['L', 'R']) {
      expect(world(hero, `palm${side}`).worldX).toBeGreaterThan(world(hero, 'head').worldX + 10);
    }
    hero.destroy({ children: true });
  });

  it('右手失能後武器轉移到左手，空手時清除雙手武器', () => {
    const hero = heroine();
    hero.equip(look({ outfit: 'ivory', weapon: 'sword' }), 'healthy');
    hero.pose('attack', 0.75);
    const slot = (name: string) => hero.actor.skeleton.findSlot(name)!.pose.attachment;
    expect(slot('weaponR')).not.toBeNull();
    expect(slot('weaponL')).toBeNull();
    hero.equip(look({ outfit: 'jade', weapon: 'saber' }), 'disabled');
    hero.pose('attack', 0.75);
    expect(slot('weaponR')).toBeNull();
    expect(slot('weaponL')).not.toBeNull();
    expect(hero.actor.state.getTrack(0)!.animation!.name).toBe('slashL');
    hero.equip(look({ outfit: 'jade', weapon: 'none' }), 'disabled');
    hero.pose('attack', 0.75);
    expect(slot('weaponR')).toBeNull();
    expect(slot('weaponL')).toBeNull();
    hero.destroy({ children: true });
  });

  it('出掌、走路、受擊與倒拖時間軸都不會讓傷手重新出招', () => {
    const hero = heroine();
    hero.equip(look({ outfit: 'ivory', weapon: 'none' }), 'disabled');
    const rotations: number[] = [];
    for (const motion of ['idle', 'attack', 'walk', 'hurt'] as const) {
      for (const t of [0, 0.4, 0.75, 1.2, 0.25, 0]) {
        hero.pose(motion, t);
        rotations.push(
          hero.actor.skeleton.findBone('upperR')!.pose.rotation,
          hero.actor.skeleton.findBone('foreR')!.pose.rotation,
        );
      }
    }
    for (let i = 2; i < rotations.length; i++) {
      expect(rotations[i]).toBeCloseTo(rotations[i % 2], 5);
    }
    hero.equip(look({ outfit: 'ivory', weapon: 'none' }), 'healthy');
    hero.pose('attack', 0.75);
    expect(world(hero, 'palmR').worldX).toBeGreaterThan(world(hero, 'head').worldX + 10);
    hero.destroy({ children: true });
  });

  it('受擊疊在護身姿勢上，兵刃不會垂到地面', () => {
    const hero = heroine();
    hero.equip(look({ outfit: 'ivory', weapon: 'sword' }), 'healthy');
    hero.pose('idle', 0);
    const guard = world(hero, 'weaponR').worldY;
    hero.pose('hurt', 0.1);
    expect(hero.actor.state.getTrack(1)!.animation!.name).toBe('hurt');
    expect(Math.abs(world(hero, 'weaponR').worldY - guard)).toBeLessThan(6);
    hero.destroy({ children: true });
  });

  it('衣褲靴髮每一種組合都找得到 Skin，換裝不影響骨架', () => {
    const hero = heroine();
    const outfits = hero.skinOptions('outfit');
    const pants = hero.skinOptions('pants');
    const boots = hero.skinOptions('boots');
    const colors = hero.skinOptions('hair');
    expect(outfits.length).toBeGreaterThanOrEqual(3);
    expect(pants.length).toBeGreaterThanOrEqual(4);
    expect(boots.length).toBeGreaterThanOrEqual(4);
    expect(colors.length).toBeGreaterThanOrEqual(4);
    for (const outfit of outfits) {
      for (const pant of pants) {
        for (const boot of boots) {
          for (const hairColor of colors) {
            for (const hairStyle of hero.hairStyles(hairColor)) {
              hero.equip(
                look({ outfit, pants: pant, boots: boot, hairColor, hairStyle }),
                'healthy',
              );
            }
          }
        }
      }
    }
    hero.equip(look({ hairStyle: 'bun' }), 'healthy');
    hero.pose('idle', 0);
    expect(hero.actor.skeleton.findSlot('hair')!.pose.attachment).toBeNull();
    hero.destroy({ children: true });
  });

  it('每種兵器在正常與右手失能時都有待機、步行、攻擊', () => {
    const hero = heroine();
    for (const weapon of Object.keys(WEAPONS) as PixelWeapon[]) {
      for (const injury of ['healthy', 'disabled'] as const) {
        hero.equip(look({ weapon }), injury);
        for (const motion of ['idle', 'walk', 'attack', 'hurt'] as const) {
          hero.pose(motion, 0.3);
          expect(hero.actor.state.getTrack(0)!.animation).toBeTruthy();
        }
        const item = WEAPONS[weapon].item;
        const held = injury === 'disabled' ? 'weaponL' : 'weaponR';
        hero.pose('idle', 0);
        expect(Boolean(hero.actor.skeleton.findSlot(held)!.pose.attachment)).toBe(Boolean(item));
      }
    }
    hero.destroy({ children: true });
  });

  it('長槍雙手持握時前手扶在槍桿上，右手失能改單手', () => {
    const hero = heroine();
    // 前手到槍桿（後手握點到前手扶點的線段）的距離。突刺時槍桿會從前手滑出，手仍貼在桿上。
    const gap = () => {
      const hand = world(hero, 'handL');
      const a = world(hero, 'weaponR');
      const b = world(hero, 'supportR');
      const [dx, dy] = [b.worldX - a.worldX, b.worldY - a.worldY];
      const k = Math.max(
        0,
        Math.min(
          1,
          ((hand.worldX - a.worldX) * dx + (hand.worldY - a.worldY) * dy) / (dx * dx + dy * dy),
        ),
      );
      return Math.hypot(hand.worldX - a.worldX - dx * k, hand.worldY - a.worldY - dy * k);
    };
    hero.equip(look({ weapon: 'spear' }), 'healthy');
    for (const t of [0, 0.2, 0.3, 0.38, 0.6, 0.9]) {
      hero.pose('attack', t);
      expect(gap()).toBeLessThan(3);
    }
    hero.equip(look({ weapon: 'spear' }), 'disabled');
    hero.pose('attack', 0.38);
    expect(hero.actor.state.getTrack(0)!.animation!.name).toBe('thrustL');
    expect(hero.actor.skeleton.findSlot('weaponL')!.pose.attachment).not.toBeNull();
    hero.destroy({ children: true });
  });

  it('摺扇揚手時展開、收勢時收起，飛鏢出手後手中暫時沒有鏢', () => {
    const hero = heroine();
    const held = () => hero.actor.skeleton.findSlot('weaponR')!.pose.attachment?.name ?? null;
    hero.equip(look({ weapon: 'fan' }), 'healthy');
    hero.pose('attack', 0);
    expect(held()).toBe('weaponR');
    hero.pose('attack', 0.5);
    expect(held()).toBe('weaponROpen');
    hero.pose('attack', 1.3);
    expect(held()).toBe('weaponR');
    hero.pose('idle', 0);
    expect(held()).toBe('weaponR');
    hero.equip(look({ weapon: 'darts' }), 'healthy');
    hero.pose('attack', 0.2);
    expect(held()).toBe('weaponR');
    hero.pose('attack', 0.6);
    expect(held()).toBeNull();
    hero.pose('attack', 1.1);
    expect(held()).toBe('weaponR');
    hero.destroy({ children: true });
  });

  it('疊加裝備各有自己的插槽，可以全部穿上也可以逐件卸下', () => {
    const hero = heroine();
    const attachment = (slot: string) => hero.actor.skeleton.findSlot(slot)!.pose.attachment;
    const slots: Record<string, string[]> = {
      headwear: ['headwear'],
      cape: ['cape'],
      shoulders: ['shoulderL', 'shoulderR'],
      armor: ['armor'],
      robe: ['robe'],
      trinket: ['trinket'],
    };
    const full = Object.fromEntries(
      GEAR_SLOTS.map((slot) => [slot, hero.skinOptions(`gear/${slot}`)[0]]),
    ) as PixelLook['gear'];
    for (const slot of GEAR_SLOTS) {
      expect(hero.skinOptions(`gear/${slot}`).length).toBeGreaterThan(0);
    }
    hero.equip(look({ gear: full }), 'healthy');
    hero.pose('walk', 0.3);
    for (const names of Object.values(slots)) {
      names.forEach((name) => expect(attachment(name)).not.toBeNull());
    }
    for (const slot of GEAR_SLOTS) {
      hero.equip(look({ gear: { ...full, [slot]: 'none' } }), 'healthy');
      hero.pose('idle', 0);
      slots[slot].forEach((name) => expect(attachment(name)).toBeNull());
    }
    hero.destroy({ children: true });
  });
});
