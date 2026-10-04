import { ScrollBox } from '@pixi/ui';
import { Container, Graphics, Rectangle } from 'pixi.js';
import { ITEMS } from '../../data/content';
import { BAG_CAPACITY, STACK_SIZE, bagQuantity, usedBagSlots } from '../../game/inventory';
import { equip, getStats } from '../../game/state';
import {
  EQUIPMENT_SLOTS,
  SLOT_NAMES,
  equipmentSlot,
  type EquipmentSlot,
} from '../../game/equipment';
import type { ItemId } from '../../game/types';
import { PixelBattleHero } from '../../render/PixelBattleHero';
import { artIcon, landscapeInset } from './CharacterSheet';
import type { GamePanel, PanelRow } from './model';
import { control, drawGamePlate, label } from './widgets';

/** 穿戴、背包與比較共用同一份即時狀態，不另開裝備視窗。 */
export function inventorySheet(
  model: GamePanel,
  width: number,
  height: number,
  selectedId: string,
  select: (id: string) => void,
  press: (action: string) => void,
  renderRow: (row: PanelRow, width: number) => Container,
): Container {
  const state = model.inventoryState!;
  const pageMode = selectedId.startsWith('bagpage:');
  const requestedPage = pageMode ? Number(selectedId.split(':')[1]) || 0 : 0;
  const selectedItemId = pageMode ? selectedId.split(':')[2] : selectedId;
  const stats = getStats(state);
  const [, requestedSlot, requestedItem] = selectedId.split(':');
  const activeSlot =
    selectedId.startsWith('slot:') && EQUIPMENT_SLOTS.includes(requestedSlot as EquipmentSlot)
      ? (requestedSlot as EquipmentSlot)
      : null;
  const sections = (model.sections ?? []).filter(
    (item) => !activeSlot || equipmentSlot(item.id as ItemId) === activeSlot,
  );
  const selected =
    pageMode && !selectedItemId
      ? undefined
      : (sections.find(
          (item) => item.id === (activeSlot ? requestedItem || state[activeSlot] : selectedItemId),
        ) ?? sections[0]);
  const selectItem = (id: string) =>
    select(activeSlot ? `slot:${activeSlot}:${id}` : `bagpage:${requestedPage}:${id}`);
  const compact = width < 900;
  const margin = compact ? 16 : 32;
  const root = new Container();
  root.eventMode = 'static';
  root.addChild(new Graphics().rect(0, 0, width, height).fill(0x0c1b18));
  root.addChild(drawGamePlate(new Graphics(), 8, 8, width - 16, height - 16));
  const title = label('隨身行囊', { size: 26, family: '"Noto Serif TC", serif' });
  title.position.set(margin, 24);
  root.addChild(title);
  const money = label(`${state.name} · 銀兩 ${state.gold} 兩`, { size: 14, color: 0xe8c983 });
  money.position.set(margin, 64);
  root.addChild(money);
  const close = control({ label: '返回江湖', action: 'close', width: 96, press });
  close.position.set(width - margin - 96, 24);
  root.addChild(close);
  const areaW = width - margin * 2;
  const areaH = height - 122;
  const wornW = compact ? areaW : Math.min(310, areaW * 0.28);
  const gridW = compact ? areaW : Math.min(410, areaW * 0.35);
  const detailW = compact ? areaW : areaW - wornW - gridW - 40;
  const text = (value: string, w: number, size = 15, color = 0xeee4ca) =>
    label(value, { width: w, size, color });
  const worn = new Container();
  const wornH = compact ? 360 : Math.max(570, Math.min(680, areaH));
  worn.addChild(new Graphics().rect(0, 0, wornW, wornH).fill(0x10251f));
  worn.addChild(landscapeInset(wornW, wornH, 0.16));
  const caption = text('身上裝備', wornW, 20);
  caption.position.set(12, 12);
  worn.addChild(caption);
  const hero = new PixelBattleHero(state, { showInjuryTint: false });
  hero.scale.set(compact ? 1.05 : Math.min(1.7, (wornH - 315) / 145));
  hero.position.set(compact ? wornW * 0.25 : wornW / 2, compact ? 230 : wornH - 290);
  worn.addChild(hero);
  EQUIPMENT_SLOTS.forEach((slot, index) => {
    const id = state[slot];
    const w = compact ? wornW * 0.47 : (wornW - 36) / 2;
    const button = control({
      label: '',
      action: `slot:${slot}`,
      width: w,
      height: compact ? 50 : 76,
      selected: activeSlot === slot,
      press: select,
    });
    button.position.set(
      compact ? wornW * 0.5 : 12 + (index % 2) * (w + 12),
      compact ? 44 + index * 55 : wornH - 274 + Math.floor(index / 2) * 80,
    );
    button.accessibleTitle = `${SLOT_NAMES[slot]}：${id ? ITEMS[id].name : '未裝備'}，更換${SLOT_NAMES[slot]}`;
    if (id) {
      artIcon(
        button,
        `item-icon:${id}`,
        compact ? 25 : w / 2,
        compact ? 25 : 22,
        compact ? 36 : 32,
      );
    }
    const name = text(
      `${SLOT_NAMES[slot]}\n${id ? ITEMS[id].name : '未裝備'}`,
      compact ? w - 58 : w - 8,
      12,
    );
    name.position.set(compact ? 48 : 6, compact ? 8 : 42);
    button.addChild(name);
    worn.addChild(button);
  });
  const abilities = text(
    `攻擊 ${stats.attack}    防禦 ${stats.defense}    身法 ${stats.speed}`,
    wornW - 20,
    14,
    0xe8c983,
  );
  abilities.position.set(10, wornH - 30);
  worn.addChild(abilities);

  const grid = new Container();
  grid.addChild(
    text(
      `${activeSlot ? SLOT_NAMES[activeSlot] : '攜帶物品'} · ${usedBagSlots(state)} / ${BAG_CAPACITY} 格`,
      gridW,
      18,
    ),
  );
  if (activeSlot) {
    const all = control({ label: '全部物品', action: '', width: 92, height: 32, press: select });
    all.position.set(gridW - 92, 0);
    grid.addChild(all);
  }
  const cols = Math.max(3, Math.floor(gridW / 90));
  const cell = (gridW - (cols - 1) * 8) / cols;
  const slots = sections.flatMap((item) => {
    const id = item.id as ItemId;
    if (ITEMS[id].kind === 'quest') {
      return [];
    }
    const quantity = bagQuantity(state, id);
    const stack = ITEMS[id].kind === 'medicine' ? STACK_SIZE : 1;
    return Array.from({ length: Math.ceil(quantity / stack) }, (_, index) => ({
      ...item,
      quantity: Math.min(stack, quantity - index * stack),
      equipped: false,
    }));
  });
  const pageSize = 20;
  const pageCount = Math.ceil(Math.max(BAG_CAPACITY, slots.length) / pageSize);
  const page = Math.min(pageCount - 1, Math.max(0, requestedPage));
  const visibleSlots = activeSlot ? sections : slots.slice(page * pageSize, (page + 1) * pageSize);
  const count = activeSlot ? Math.max(cols, visibleSlots.length) : pageSize;
  if (!activeSlot) {
    const pageLabel = text(
      `第 ${page + 1} / ${pageCount} 頁 · 藥品每格 ${STACK_SIZE} 份`,
      gridW,
      12,
      0xb9c6af,
    );
    pageLabel.y = 32;
    grid.addChild(pageLabel);
    for (const [direction, caption, x] of [
      [-1, '上一頁', 0],
      [1, '下一頁', gridW - 96],
    ] as const) {
      const button = control({
        label: caption,
        action: `bagpage:${page + direction}:`,
        width: 96,
        height: 34,
        disabled: page + direction < 0 || page + direction >= pageCount,
        press: select,
      });
      button.position.set(x, 56);
      grid.addChild(button);
    }
  }
  for (let i = 0; i < count; i++) {
    const item = visibleSlots[i];
    const tile = control({
      label: '',
      action: item?.id ?? '',
      width: cell,
      height: 100,
      selected: Boolean(item && item.id === selected?.id),
      disabled: !item,
      press: selectItem,
    });
    tile.position.set(
      (i % cols) * (cell + 8),
      (activeSlot ? 40 : 100) + Math.floor(i / cols) * 108,
    );
    if (item) {
      tile.accessibleTitle = `${item.title}${item.equipped ? '，身上裝備' : ''}`;
      artIcon(tile, item.icon!, cell / 2, 32, 48);
      const name = text(ITEMS[item.id as ItemId].name, cell - 8, 12);
      name.position.set(4, 61);
      const quantity = text(`×${item.quantity}`, cell, 11, 0xe8c983);
      quantity.position.set(cell - quantity.width - 5, 5);
      tile.addChild(name, quantity);
      if (item.equipped) {
        const badge = text('穿戴中', cell - 8, 10, 0xaed9b7);
        badge.position.set(4, 82);
        tile.addChild(badge);
      }
    }
    grid.addChild(tile);
  }
  if (!activeSlot) {
    const quests = sections.filter((section) => ITEMS[section.id as ItemId].kind === 'quest');
    const questY = 112 + Math.ceil(count / cols) * 108;
    if (quests.length) {
      const caption = text('任務物品 · 不占行囊格數', gridW, 14, 0xb9c6af);
      caption.y = questY;
      grid.addChild(caption);
      quests.forEach((item, index) => {
        const button = control({
          label: item.title,
          action: item.id,
          width: gridW,
          height: 42,
          press: selectItem,
        });
        button.y = questY + 30 + index * 48;
        grid.addChild(button);
      });
    }
  }
  const details: Container[] = [];
  if (selected) {
    details.push(text('物品詳情', detailW, 20));
    const id = selected.id as ItemId;
    const item = ITEMS[id];
    details.push(
      ...selected.rows.filter((row) => row.kind !== 'action').map((row) => renderRow(row, detailW)),
    );
    if (item.kind === 'weapon' || item.kind === 'armor') {
      const wearing = state[equipmentSlot(id)!];
      const candidate = { ...state };
      const allowed = equip(candidate, id);
      const after = getStats(candidate);
      const delta = (value: number) => (value > 0 ? `+${value}` : String(value));
      details.push(
        text(`目前穿戴：${wearing ? ITEMS[wearing].name : '未裝備'}`, detailW, 14, 0xb9c6af),
      );
      if (allowed && wearing !== id) {
        details.push(
          text(
            `換裝後\n攻擊  ${stats.attack} → ${after.attack}（${delta(after.attack - stats.attack)}）\n防禦  ${stats.defense} → ${after.defense}（${delta(after.defense - stats.defense)}）\n身法  ${stats.speed} → ${after.speed}（${delta(after.speed - stats.speed)}）`,
            detailW,
            16,
            0xe8c983,
          ),
        );
      } else if (!allowed) {
        details.push(text('與目前所修武學不符，無法穿戴。', detailW, 14, 0xdba98d));
      }
    }
    details.push(
      ...selected.rows.filter((row) => row.kind === 'action').map((row) => renderRow(row, detailW)),
    );
  } else {
    details.push(
      text(
        activeSlot
          ? `尚無可替換的${SLOT_NAMES[activeSlot]}。\n可向門派的陳長悟購買。`
          : slots.length
            ? '選取物品查看詳情。\n本頁空格可收納沿途拾得的裝備與藥品。'
            : '行囊暫時空著。\n沿途取得的物品會收在這裡。',
        detailW,
      ),
    );
  }
  const addScroll = (elements: Container[], x: number, w: number) => {
    const scroll = new ScrollBox({
      type: 'vertical',
      width: w,
      height: Math.max(100, areaH),
      elementsMargin: 18,
      globalScroll: false,
      disableEasing: true,
    });
    scroll.position.set(x, 100);
    scroll.hitArea = new Rectangle(0, 0, w, Math.max(100, areaH));
    scroll.addItems(elements);
    root.addChild(scroll);
    if (compact && selectedId) {
      scroll.scrollToPosition({
        y: elements[(activeSlot && !requestedItem) || (pageMode && !selectedItemId) ? 1 : 2].y,
      });
    }
  };
  if (compact) {
    addScroll([worn, grid, ...details], margin, areaW);
  } else {
    addScroll([worn], margin, wornW);
    addScroll([grid], margin + wornW + 20, gridW);
    addScroll(details, margin + wornW + gridW + 40, detailW);
  }
  root.addChild(close);
  return root;
}
