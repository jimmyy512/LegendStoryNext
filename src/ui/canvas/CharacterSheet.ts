import { ScrollBox } from '@pixi/ui';
import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { INNER_ARTS, ITEMS, QUESTS, SKILLS } from '../../data/content';
import { HAIR_NAMES } from '../../game/appearance';
import { BODY_PARTS, PART_CAPACITY, limbPower, movementRate } from '../../game/body';
import { getStats } from '../../game/state';
import { TALENTS, TALENT_IDS, availableTalentPoints } from '../../game/talents';
import {
  CROSS_TRAINED,
  ROUTE_NAMES,
  canStudyMartialArt,
  changeMartialArt,
} from '../../game/martialTraining';
import { equippedItems, EQUIPMENT_SLOTS, SLOT_NAMES } from '../../game/equipment';
import { PixelBattleHero } from '../../render/PixelBattleHero';
import type { GamePanel, PanelRow } from './model';
import { control, drawGamePlate, healthBar, label } from './widgets';

export function artIcon(parent: Container, key: string, x: number, y: number, size: number): void {
  const texture = Assets.get<Texture>(key);
  if (!texture) {
    return;
  }
  if (key === 'item-icon:inkPants' || key === 'item-icon:guardPants') {
    const greaves = key.endsWith('guardPants');
    const shin = Assets.get<Texture>(`pants-shin:${key.split(':')[1]}`);
    if (shin) {
      const pants = new Container();
      for (const side of [-1, 1]) {
        const leg = new Container();
        leg.scale.x = side;
        leg.x = side * 5;
        const upper = new Container();
        const thigh = new Sprite(texture);
        thigh.position.set(greaves ? -8.68 : -6.24, greaves ? -4.97 : -4.47);
        upper.rotation = Math.atan2(8.9, 24.45);
        upper.addChild(thigh);
        const calf = new Sprite(shin);
        calf.position.set(greaves ? -7.35 : -8.34, 26 - (greaves ? 0.57 : 0.44));
        leg.addChild(upper, calf);
        pants.addChild(leg);
      }
      const bounds = pants.getLocalBounds();
      const scale = size / Math.max(bounds.width, bounds.height);
      pants.scale.set(scale);
      pants.position.set(
        x - (bounds.x + bounds.width / 2) * scale,
        y - (bounds.y + bounds.height / 2) * scale,
      );
      parent.addChild(pants);
      return;
    }
  }
  const image = new Sprite(texture);
  image.anchor.set(0.5);
  image.scale.set(Math.min(size / texture.width, size / texture.height));
  image.position.set(x, y);
  parent.addChild(image);
}

export function landscapeInset(width: number, height: number, alpha: number): Container {
  const root = new Container();
  const texture = Assets.get<Texture>('title-scene');
  if (texture) {
    const image = new Sprite(texture);
    image.scale.set(Math.max(width / texture.width, height / texture.height));
    image.position.set((width - image.width) / 2, (height - image.height) / 2);
    image.alpha = alpha;
    const mask = new Graphics().rect(0, 0, width, height).fill(0xffffff);
    root.addChild(image, mask);
    root.mask = mask;
  }
  return root;
}

/** 人物資訊以固定分區呈現；詳細內容獨立捲動，人物與分類保持可見。 */
export function characterSheet(
  model: GamePanel,
  width: number,
  height: number,
  sectionId: string,
  select: (id: string) => void,
  press: (action: string) => void,
  renderRow: (row: PanelRow, width: number) => Container,
): Container {
  const state = model.hero!;
  const stats = getStats(state);
  const root = new Container();
  const compact = width < 850;
  const margin = compact ? 12 : 26;
  const sections = model.sections!;
  const selected = sections.find((entry) => entry.id === sectionId.split(':')[0]) ?? sections[0];
  root.eventMode = 'static';
  root.addChild(new Graphics().rect(0, 0, width, height).fill(0x0c1b18));
  root.addChild(drawGamePlate(new Graphics(), margin, 12, width - margin * 2, height - 24));
  const title = label('俠客', { size: 28, family: '"Noto Serif TC", serif' });
  title.position.set(margin + 20, 24);
  root.addChild(title);
  const identity = label(
    `${state.name}  ·  第 ${state.level} 重${compact ? '' : `  /  ${!['arrival', 'trial', 'report'].includes(state.quest) ? '全真門人' : '江湖散人'}`}`,
    { size: compact ? 15 : 20, width: width - 210 },
  );
  identity.position.set(margin + (compact ? 20 : 100), compact ? 62 : 31);
  root.addChild(identity);
  const close = control({ label: '返回江湖', action: 'close', width: compact ? 80 : 108, press });
  close.position.set(width - margin - close.width - 12, 22);
  root.addChild(close);
  root.addChild(
    new Graphics().rect(margin + 18, compact ? 100 : 82, width - margin * 2 - 36, 1).fill(0x7e7954),
  );
  const navW = compact ? width - margin * 2 - 24 : 138;
  sections.forEach((section, index) => {
    const button = control({
      label: compact ? section.title : `${section.title}\n${section.caption}`,
      action: section.id,
      width: compact ? (navW - 6 * (sections.length - 1)) / sections.length : navW,
      height: compact ? 46 : 74,
      selected: selected.id === section.id,
      press: select,
    });
    button.position.set(
      margin + 12 + (compact ? (index * (navW + 6)) / sections.length : 0),
      compact ? 116 : 110 + index * 86,
    );
    root.addChild(button);
  });
  const startX = compact ? margin + 18 : margin + 172;
  const startY = compact ? 178 : 104;
  const areaW = width - startX - margin - 18;
  const areaH = height - startY - 50;
  const heroW = Math.min(330, areaW * 0.43);
  const renderHero = (w: number, h: number): Container => {
    const board = new Container();
    board.addChild(new Graphics().rect(0, 0, w, h).fill(0x10251f));
    board.addChild(landscapeInset(w, h, 0.13));
    const hero = new PixelBattleHero(state);
    const scale = Math.min((h - 245) / 145, (w - 40) / 110, 2.35);
    hero.scale.set(Math.max(0.75, scale));
    hero.position.set(w / 2, Math.min(h - 195, h / 2 + 70));
    board.addChild(hero);
    const name = label(state.name, { size: 24, family: '"Noto Serif TC", serif' });
    name.anchor.set(0.5, 0);
    name.position.set(w / 2, 14);
    board.addChild(name);
    const garments = label(HAIR_NAMES[state.hair], { size: 12, color: 0xc4c6ab });
    garments.anchor.set(0.5, 0);
    garments.position.set(w / 2, 52);
    garments.visible = h > 400;
    board.addChild(garments);
    EQUIPMENT_SLOTS.forEach((slot, index) => {
      const item = state[slot];
      const button = control({
        label: '',
        action: item ? `inspect-item:${item}` : 'panel:bag',
        width: (w - 40) / 3,
        height: 82,
        press,
      });
      button.position.set(
        12 + (index % 3) * ((w - 40) / 3 + 8),
        h - 182 + Math.floor(index / 3) * 88,
      );
      button.accessibleTitle = `${SLOT_NAMES[slot]}：${item ? ITEMS[item].name : '未裝備'}，前往行囊更換`;
      if (item) {
        artIcon(button, `item-icon:${item}`, button.width / 2, 23, 34);
      }
      const text = label(`${SLOT_NAMES[slot]}\n${item ? ITEMS[item].name : '未裝備'}`, {
        size: 11,
        width: button.width - 8,
      });
      text.anchor.set(0.5, 0);
      text.position.set(button.width / 2, 46);
      button.addChild(text);
      board.addChild(button);
    });
    return board;
  };
  if (!compact) {
    const portrait = renderHero(heroW, areaH);
    portrait.position.set(startX, startY);
    root.addChild(portrait);
  }
  const contentX = compact ? startX : startX + heroW + 26;
  const contentW = compact ? areaW : areaW - heroW - 26;
  const items: Container[] = [];
  if (compact && (selected.id === 'overview' || selected.id === 'look')) {
    items.push(renderHero(contentW, 430));
  }
  const text = (value: string, size = 15, color = 0xeee4ca) =>
    label(value, { size, color, width: contentW });
  const meter = (name: string, value: number, max: number, color: number) => {
    const group = new Container();
    group.addChild(text(`${name}    ${value} / ${max}`, 15));
    const bar = healthBar({ width: contentW, value, max, color });
    bar.position.y = 31;
    group.addChild(bar);
    return group;
  };
  if (selected.id === 'overview') {
    items.push(text('行走江湖', 24), text(INNER_ARTS[state.route].name, 16, 0xe8c983));
    items.push(
      meter('生命', state.hp, stats.maxHp, 0x87b69d),
      meter('內力', state.mp, stats.maxMp, 0x85a6c6),
      meter('修為', state.xp, state.level * 60, 0xcab273),
    );
    const base = text(
      `攻擊  ${stats.attack}       防禦  ${stats.defense}       身法  ${stats.speed}\n銀兩  ${state.gold}       移速  ${Math.round(movementRate(state.body) * 100)}%`,
      16,
    );
    items.push(base);
    const injuries = BODY_PARTS.filter((part) => state.body[part] < PART_CAPACITY[part]);
    items.push(
      text('身體與行裝', 20),
      text(
        injuries.length
          ? `${injuries.length} 處傷勢影響目前狀態，於「傷勢」查看各部位。`
          : '七處部位完好，可正常行動與出招。',
        14,
        0xb9c6af,
      ),
    );
    const pair = new Container();
    SKILLS[state.route].forEach((skill, index) => {
      const button = control({
        label: '',
        action: `skills:${skill.id}`,
        width: (contentW - 12) / 2,
        height: 96,
        press: select,
      });
      button.position.x = (index * (contentW + 12)) / 2;
      button.accessibleTitle = `查看${skill.name}`;
      artIcon(button, `skill-icon:${skill.id}`, button.width / 2, 30, 44);
      const name = text(skill.name, 14);
      name.anchor.set(0.5, 0);
      name.position.set(button.width / 2, 60);
      button.addChild(name);
      pair.addChild(button);
    });
    items.push(text('當前武學', 20), pair);
    items.push(
      control({
        label:
          availableTalentPoints(state) > 0
            ? `天賦 · 尚有 ${availableTalentPoints(state)} 點可分配`
            : `天賦 · ${state.talents.length ? state.talents.map((id) => TALENTS[id].name).join('、') : '第 2 重開啟'}`,
        action: 'talents',
        width: contentW,
        height: 48,
        press: select,
      }),
    );
    items.push(text('能力來源', 20));
    const growth = state.level - 1;
    const sources = [
      [
        '攻擊',
        `根基 ${17 + (state.route === 'sword' ? 2 : 0)}  ＋  境界 ${growth * 3}  ＋  裝備 ${equippedItems(state).reduce((sum, id) => sum + (ITEMS[id].attack ?? 0), 0)}`,
      ],
      [
        '防禦',
        `根基 ${5 + (state.route === 'fist' ? 2 : 0)}  ＋  境界 ${growth * 2}  ＋  裝備 ${equippedItems(state).reduce((sum, id) => sum + (ITEMS[id].defense ?? 0), 0)}`,
      ],
      [
        '身法',
        `根基 ${8 + (state.route === 'sword' ? 2 : 0)}  ＋  境界 ${growth}  ＋  裝備 ${equippedItems(state).reduce((sum, id) => sum + (ITEMS[id].speed ?? 0), 0)}`,
      ],
    ];
    for (const [name, source] of sources) {
      items.push(text(`${name}    ${source}`, 14, 0xc4cbb8));
    }
    items.push(
      control({
        label: `${QUESTS[state.quest].title} · 查看旅途紀錄`,
        action: 'panel:journal',
        width: contentW,
        height: 46,
        press,
      }),
    );
  } else if (selected.id === 'talents') {
    const chosenId = TALENT_IDS.find((id) => id === sectionId.split(':')[1]) ?? TALENT_IDS[0];
    const chosen = TALENTS[chosenId];
    const points = availableTalentPoints(state);
    const learned = state.talents.includes(chosenId);
    items.push(
      text('修習天賦', 24),
      text(`可用 ${points} 點 · 已領悟 ${state.talents.length} 項`, 18, 0xe8c983),
    );
    items.push(text('第 2、3 重各得 1 點，第一章最多選擇兩項。', 14, 0xb9c6af));
    const choices = new Container();
    const buttonW = (contentW - 16) / 3;
    TALENT_IDS.forEach((id, index) => {
      const talent = TALENTS[id];
      const owned = state.talents.includes(id);
      const button = control({
        label: '',
        action: `talents:${id}`,
        width: buttonW,
        height: 138,
        selected: id === chosenId,
        press: select,
      });
      button.position.x = index * (buttonW + 8);
      button.accessibleTitle = `查看${talent.name}${owned ? '，已領悟' : ''}`;
      artIcon(button, talent.icon, buttonW / 2, 34, 46);
      const title = label(talent.name, { size: 15, width: buttonW - 10 });
      title.anchor.set(0.5, 0);
      title.position.set(buttonW / 2, 64);
      button.addChild(title);
      const status = label(owned ? '已領悟' : talent.style, {
        size: 12,
        color: owned ? 0xe8c983 : 0xb9c6af,
      });
      status.anchor.set(0.5, 0);
      status.position.set(buttonW / 2, 105);
      button.addChild(status);
      choices.addChild(button);
    });
    items.push(
      choices,
      text(chosen.name, 22),
      text(chosen.effect, 16),
      text(chosen.hint, 14, 0xb9c6af),
    );
    items.push(
      control({
        label: learned
          ? '已領悟 · 戰鬥中自動生效'
          : points > 0
            ? `領悟${chosen.name} · 1 點`
            : state.level < 2
              ? '第 2 重可領悟'
              : '可用點數不足',
        action: `talent:${chosenId}`,
        width: contentW,
        height: 48,
        primary: !learned && points > 0,
        disabled: learned || points < 1,
        press,
      }),
    );
    items.push(text('重新配置', 20), text('回到全真山門，可免費退還全部天賦點數。', 14, 0xb9c6af));
    items.push(
      control({
        label: state.map === 'temple' ? '退還點數，重新配置' : '回山門重新配置 · 帶路',
        action: state.map === 'temple' ? 'talent:reset' : 'guide:training',
        width: contentW,
        height: 46,
        disabled: state.talents.length === 0,
        press,
      }),
    );
  } else if (selected.id === 'skills') {
    const skills = SKILLS[state.route];
    const chosen = skills.find((skill) => skill.id === sectionId.split(':')[1]) ?? skills[0];
    items.push(
      text('所習武學', 24),
      text(
        `${INNER_ARTS[state.route].name} · ${state.route === 'sword' ? '劍法' : '拳掌'}`,
        16,
        0xe8c983,
      ),
      text(INNER_ARTS[state.route].description, 14, 0xb9c6af),
    );
    const other = state.route === 'sword' ? 'fist' : 'sword';
    if (state.flags.includes(CROSS_TRAINED)) {
      const preview = structuredClone(state);
      changeMartialArt(preview, other);
      const next = getStats(preview);
      items.push(
        text(`另一門武學 · ${ROUTE_NAMES[other]} / ${INNER_ARTS[other].name}`, 18, 0xe8c983),
      );
      items.push(
        text(
          `${SKILLS[other].map((skill) => skill.name).join('、')}\n攻擊 ${stats.attack} → ${next.attack}　防禦 ${stats.defense} → ${next.defense}\n身法 ${stats.speed} → ${next.speed}　生命上限 ${stats.maxHp} → ${next.maxHp}`,
          14,
        ),
      );
      items.push(
        text(
          `切換時${preview.weapon ? `穿戴${ITEMS[preview.weapon].name}` : '未持有相符兵器，將卸下目前武器'}。其餘裝備保留，不恢復生命與內力。`,
          13,
          0xb9c6af,
        ),
      );
      items.push(
        control({
          label: `改修${ROUTE_NAMES[other]} · 切換內功與兩式招式`,
          action: `martial:${other}`,
          width: contentW,
          height: 46,
          press,
        }),
      );
    } else {
      items.push(
        text(
          canStudyMartialArt(state)
            ? '另一門武學可向徐長卿學習，學成後可在探索中切換。'
            : '拜入全真後，可向徐長卿學習另一門武學。',
          14,
          0xb9c6af,
        ),
      );
      if (canStudyMartialArt(state)) {
        items.push(
          control({
            label: `向徐長卿請教${ROUTE_NAMES[other]} · 帶路`,
            action: 'guide:martial',
            width: contentW,
            height: 46,
            press,
          }),
        );
      }
    }
    items.push(text('目前使用的招式', 20));
    const slots = new Container();
    skills.forEach((skill, index) => {
      const button = control({
        label: '',
        action: `skills:${skill.id}`,
        width: (contentW - 12) / 2,
        height: 112,
        selected: chosen.id === skill.id,
        press: select,
      });
      button.position.x = (index * (contentW + 12)) / 2;
      button.accessibleTitle = `查看${skill.name}`;
      artIcon(button, `skill-icon:${skill.id}`, button.width / 2, 35, 54);
      const name = label(skill.name, { size: 15, width: button.width - 12 });
      name.anchor.set(0.5, 0);
      name.position.set(button.width / 2, 74);
      button.addChild(name);
      slots.addChild(button);
    });
    items.push(slots, text(chosen.name, 25), text(chosen.description, 16));
    items.push(
      text(
        `內力消耗    ${chosen.cost}\n發力部位    ${chosen.limbs.hands === 2 ? '雙手' : chosen.limbs.hands === 1 ? '單手' : '無手部需求'}${chosen.limbs.legs ? ` · ${chosen.limbs.legs === 2 ? '雙腿' : '單腿'}` : ''}\n部位發揮    ${Math.round(limbPower(state.body, chosen.limbs) * 100)}%\n${chosen.effect === 'counter' ? '反擊倍率' : '攻擊倍率'}    ${chosen.multiplier.toFixed(2)} 倍`,
        16,
      ),
    );
    if (chosen.limbs.hands === 2) {
      items.push(text('單手失能仍可施展，威力減半；雙手失能則無法出招。', 13, 0xb9c6af));
    }
    items.push(
      text('交鋒運用', 20),
      text(
        chosen.effect === 'counter'
          ? '敵人準備重擊時預約護體，接下攻擊後反擊。'
          : chosen.effect === 'break'
            ? '先削弱對手防禦，再以重擊追擊。'
            : '在對手收招或滿氣勢時出手，把握爆發時機。',
        14,
        0xb9c6af,
      ),
    );
    items.push(text('在戰鬥操作列選取招式，即可預約下一次出手。', 13, 0xb9c6af));
  } else {
    items.push(text(selected.title, 24), text(selected.caption, 14, 0xb9c6af));
    items.push(...selected.rows.map((row) => renderRow(row, contentW)));
  }
  const scroll = new ScrollBox({
    type: 'vertical',
    width: contentW,
    height: Math.max(80, areaH),
    elementsMargin: 18,
    globalScroll: false,
    disableEasing: true,
  });
  scroll.position.set(contentX, startY);
  scroll.addItems(items);
  root.addChild(scroll);
  const footer = text('選擇分類查看詳情 · 裝備可點選更換', 12, 0xb9c6af);
  footer.position.set(startX, height - 34);
  root.addChild(footer);
  return root;
}
