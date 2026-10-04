import { type Input, ScrollBox } from '@pixi/ui';
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { NameInput } from './NameInput';
import { bodyStatus } from './BodyStatus';
import { artIcon, characterSheet, landscapeInset } from './CharacterSheet';
import { inventorySheet } from './InventorySheet';
import { PixelBattleHero } from '../../render/PixelBattleHero';
import type { GamePanel, PanelRow } from './model';
import { clear, control, drawGamePlate, label, surface } from './widgets';

/** 所有面板都在 Pixi 內排版，文字輸入由 Pixi Input 接上系統鍵盤。 */
export class PanelOverlay {
  readonly root = new Container();
  private model: GamePanel | null = null;
  private textInput: NameInput | null = null;
  private width = 0;
  private height = 0;
  private scrollable = false;
  private section = '';
  dialogueStageHeight = 0;
  constructor(private readonly press: (action: string) => void) {}

  get visible(): boolean {
    return this.model !== null;
  }

  show(model: GamePanel): void {
    if (this.model?.title !== model.title) {
      this.section = '';
    }
    if (model.initialSection) {
      this.section = model.initialSection;
    }
    this.hide();
    this.model = model;
    this.draw();
  }

  hide(): void {
    this.model = null;
    clear(this.root);
    this.textInput = null;
  }

  resize(width: number, height: number): void {
    // 鍵盤彈出或旋轉時保留 Input，避免重建原生輸入框而中斷中文組字。
    this.textInput?.removeFromParent();
    this.width = width;
    this.height = height;
    this.draw();
  }

  private draw(): void {
    this.dialogueStageHeight = 0;
    clear(this.root);
    if (!this.model || !this.width) {
      return;
    }
    const shade = new Graphics()
      .rect(0, 0, this.width, this.height)
      .fill({ color: 0x061512, alpha: this.model.layout === 'dialogue' ? 0.16 : 0.65 });
    shade.eventMode = 'static';
    this.root.addChild(shade);
    if (this.model.layout === 'creation') {
      this.drawCreation();
      return;
    }
    if (this.model.inventoryState) {
      this.root.addChild(
        inventorySheet(
          this.model,
          this.width,
          this.height,
          this.section,
          (id) => {
            this.section = id;
            this.draw();
          },
          this.press,
          (row, width) => this.row(row, width, this.width < 900 ? 16 : 18),
        ),
      );
      return;
    }
    if (this.model.hero && this.model.sections?.length) {
      this.root.addChild(
        characterSheet(
          this.model,
          this.width,
          this.height,
          this.section,
          (id) => {
            this.section = id;
            this.draw();
          },
          this.press,
          (row, width) => this.row(row, width),
        ),
      );
      return;
    }
    if (this.model.layout === 'folio' && this.model.sections?.length) {
      this.drawFolio();
      return;
    }
    if (this.model.layout === 'dialogue') {
      this.drawDialogue();
      return;
    }
    if (this.model.layout === 'notice') {
      this.drawNotice();
      return;
    }
    const width = Math.min(this.model.rows.length <= 4 ? 480 : 660, this.width - 24);
    const rows = this.model.subtitle
      ? [{ kind: 'text' as const, text: this.model.subtitle }, ...this.model.rows]
      : this.model.rows;
    const portraitWidth = this.model.portrait && width >= 520 ? 160 : 0;
    const items = rows.map((row) => this.row(row, width - 32 - portraitWidth));
    const contentHeight =
      items.reduce((sum, item) => sum + item.height, 0) + Math.max(0, items.length - 1) * 10;
    const height = Math.min(
      this.height - 16,
      Math.max(portraitWidth ? 270 : 180, contentHeight + 82),
    );
    this.scrollable = contentHeight + 82 > height;
    const panel = new Container();
    panel.position.set((this.width - width) / 2, (this.height - height) / 2);
    panel.eventMode = 'static';
    panel.hitArea = new Rectangle(0, 0, width, height);
    panel.addChild(this.panelBacking(width, height));
    this.drawHeader(panel, width);
    if (portraitWidth) {
      this.drawPortrait(panel, height);
    }
    this.drawRows(panel, { width, height }, items, portraitWidth);
    this.root.addChild(panel);
  }

  private drawFolio(): void {
    const model = this.model!;
    const sections = model.sections!;
    const selected = sections.find((item) => item.id === this.section) ?? sections[0];
    this.section = selected.id;
    const w = Math.min(900, this.width - 24);
    const mobile = w < 620;
    const x = mobile ? 20 : 252;
    const contentW = w - x - 24;
    const contentRows = selected.rows.map((row) => this.row(row, contentW));
    const rowHeight = contentRows.reduce((sum, row) => sum + row.height + 16, 0);
    const columns = model.inventory ? (mobile ? 4 : 2) : 2;
    const navCellH = model.inventory ? 94 : 61;
    const mobileNavH = Math.min(
      model.inventory ? 195 : 129,
      Math.ceil(sections.length / columns) * (navCellH + 7) - 7,
    );
    const desiredH =
      selected.id === 'body' && model.hero
        ? mobile
          ? 790
          : Math.max(650, rowHeight + 122)
        : model.hero
          ? mobile
            ? 680
            : 560
          : mobile
            ? 102 + mobileNavH + rowHeight + 32
            : Math.max(Math.min(sections.length * 68 + 116, 540), rowHeight + 122);
    const h = Math.min(desiredH, this.height - 24);
    const panel = new Container();
    panel.position.set((this.width - w) / 2, (this.height - h) / 2);
    panel.eventMode = 'static';
    panel.hitArea = new Rectangle(0, 0, w, h);
    panel.addChild(this.panelBacking(w, h));
    this.drawHeader(panel, w);
    const subtitle = label(model.subtitle ?? '', { width: w - 40, size: 12, color: 0xb8c8ad });
    subtitle.position.set(20, 49);
    panel.addChild(subtitle);
    const navW = mobile ? w - 32 : 208;
    const navH = mobile ? Math.min(mobileNavH, Math.max(61, h - 180)) : h - 108;
    const nav = new ScrollBox({
      type: 'vertical',
      width: navW,
      height: navH,
      elementsMargin: 7,
      globalScroll: false,
      disableEasing: true,
    });
    nav.position.set(16, 82);
    const navButtons = sections.map((section) => {
      const button = control({
        label: model.inventory ? '' : `${section.title}\n${section.caption}`,
        action: section.id,
        width: model.inventory
          ? (navW - (columns - 1) * 8) / columns
          : mobile
            ? (navW - 8) / 2
            : navW,
        height: navCellH,
        selected: section.id === selected.id,
        press: (id) => {
          this.section = id;
          this.draw();
        },
      });
      if (model.inventory && section.icon) {
        button.accessibleTitle = `${section.title} ${section.caption}`;
        const bw = (navW - (columns - 1) * 8) / columns;
        const texture = Assets.get<Texture>(section.icon);
        if (texture) {
          const icon = new Sprite(texture);
          icon.anchor.set(0.5);
          icon.scale.set(Math.min((bw - 12) / texture.width, 52 / texture.height));
          icon.position.set(bw / 2, 32);
          button.addChild(icon);
        }
        const name = label(section.title.split(' ×')[0], { size: 11, width: bw - 8 });
        name.anchor.set(0.5, 0);
        name.position.set(bw / 2, 58);
        const qty = label(`×${section.quantity}`, { size: 11, color: 0xe6ca88 });
        qty.position.set(bw - qty.width - 6, 4);
        button.addChild(name, qty);
        if (section.equipped) {
          const worn = label('已裝備', { size: 10, color: 0xc4d9b9 });
          worn.position.set(5, 77);
          button.addChild(worn);
        }
      }
      return button;
    });
    if (mobile || model.inventory) {
      const navRows: Container[] = [];
      for (let i = 0; i < navButtons.length; i += columns) {
        const row = new Container();
        row.addChild(navButtons[i]);
        for (let c = 1; c < columns && navButtons[i + c]; c++) {
          navButtons[i + c].x = (c * (navW + 8)) / columns;
          row.addChild(navButtons[i + c]);
        }
        navRows.push(row);
      }
      nav.addItems(navRows);
    } else {
      nav.addItems(navButtons);
    }
    panel.addChild(nav);
    const y = mobile ? 82 + navH + 20 : 92;
    const contentH = h - y - 30;
    const divider = new Graphics();
    if (mobile) {
      divider.rect(20, y - 10, w - 40, 1).fill(0x71836b);
    } else {
      divider.rect(235, 84, 1, h - 112).fill(0x71836b);
    }
    panel.addChild(divider);
    const items: Container[] = [];
    if (selected.hero && model.hero) {
      const stage = new Container();
      const stageH = 154;
      stage.addChild(new Graphics().rect(0, 0, contentW, stageH).fill(0x10231f));
      stage.addChild(
        new Graphics()
          .ellipse(contentW / 2, stageH - 16, 48, 10)
          .fill({ color: 0x030c0a, alpha: 0.5 }),
      );
      const hero = new PixelBattleHero(model.hero);
      hero.scale.set(1);
      hero.position.set(contentW / 2, stageH - 18);
      stage.addChild(hero);
      items.push(stage);
    }
    items.push(...contentRows);
    const scroll = new ScrollBox({
      type: 'vertical',
      width: contentW,
      height: Math.max(50, contentH),
      elementsMargin: 16,
      globalScroll: false,
      disableEasing: true,
    });
    scroll.position.set(x, y);
    scroll.addItems(items);
    panel.addChild(scroll);
    const more = items.reduce((sum, item) => sum + item.height + 16, 0) > contentH;
    const footer = label(more ? '上下滑動查看內容' : '點選左側分類查看詳情', {
      size: 10,
      color: 0xb8c8ad,
    });
    footer.text = mobile && !more ? '上方選取分類 · 下方查看詳情' : footer.text;
    footer.position.set(x, h - 21);
    panel.addChild(footer);
    this.root.addChild(panel);
  }

  private drawCreation(): void {
    const model = this.model!;
    const w = Math.min(1060, this.width - 24);
    const mobile = w < 680;
    const h = Math.min(this.height - 24, mobile ? 790 : 660);
    const panel = new Container();
    panel.position.set((this.width - w) / 2, (this.height - h) / 2);
    panel.eventMode = 'static';
    panel.addChild(this.panelBacking(w, h));
    this.drawHeader(panel, w);
    const x = mobile ? 22 : 310;
    const cw = w - x - 24;
    if (!mobile) {
      const landscape = landscapeInset(264, h - 92, 0.32);
      landscape.position.set(18, 70);
      panel.addChild(landscape);
      const name = label('初入江湖', { size: 32, width: 180, family: '"Noto Serif TC", serif' });
      name.position.set(44, 96);
      panel.addChild(name);
      const prose = label('一個名號，\n一身武藝。\n\n松風林外，\n你的江湖由此開始。', {
        size: 17,
        width: 210,
        color: 0xd3cfac,
      });
      prose.position.set(44, 160);
      panel.addChild(prose);
      if (model.hero) {
        const hero = new PixelBattleHero(model.hero);
        hero.scale.set(1.65);
        hero.position.set(150, h - 62);
        const shadow = new Graphics()
          .ellipse(150, h - 57, 58, 10)
          .fill({ color: 0x10271d, alpha: 0.45 });
        panel.addChild(shadow, hero);
      }
    }
    const items: Container[] = [];
    const nameRow = model.rows.find((row) => row.kind === 'input')!;
    items.push(
      label('俠客姓名', { size: 16 }),
      this.row(nameRow, cw),
      label('選擇初修武學', { size: 20 }),
    );
    for (const route of ['sword', 'fist']) {
      const row = model.rows.find(
        (row) => row.kind === 'action' && row.action === `route:${route}`,
      );
      if (!row || row.kind !== 'action') {
        continue;
      }
      const button = control({
        ...row,
        label: '',
        width: cw,
        height: mobile ? 112 : 124,
        press: this.press,
      });
      button.accessibleTitle = row.label;
      artIcon(button, route === 'sword' ? 'item-icon:sword' : 'item-icon:wraps', 45, 52, 64);
      const title = label(route === 'sword' ? '劍法 · 破甲尋隙' : '拳掌 · 護體反擊', {
        size: 18,
        width: cw - 112,
        color: row.selected ? 0xffd786 : 0xeee4ca,
      });
      title.position.set(88, 12);
      const detail = label(
        route === 'sword'
          ? '清風破甲削弱防禦\n落雁一劍蓄勢重擊'
          : '抱元守一護體反擊\n伏龍掌近身爆發',
        { size: 14, width: cw - 108, color: 0xc4cbb8 },
      );
      detail.position.set(88, 46);
      button.addChild(title, detail);
      if (row.selected) {
        const selected = label('已選定', { size: 12, color: 0xffd786 });
        selected.position.set(cw - selected.width - 12, button.height - 24);
        button.addChild(selected);
      }
      items.push(button);
    }
    items.push(
      label('新旅程會更新自動存檔；手動存檔仍會保留。', { size: 12, width: cw, color: 0xb9c6af }),
    );
    const scroll = new ScrollBox({
      type: 'vertical',
      width: cw,
      height: h - 150,
      elementsMargin: 14,
      globalScroll: false,
      disableEasing: true,
    });
    scroll.position.set(x, 72);
    scroll.addItems(items);
    panel.addChild(scroll);
    const begin = control({
      label: '踏入松風林',
      action: 'create',
      width: cw,
      height: 50,
      primary: true,
      press: this.press,
    });
    begin.position.set(x, h - 66);
    panel.addChild(begin);
    this.root.addChild(panel);
  }

  private drawDialogue(): void {
    const model = this.model!;
    const objectPortrait = model.portrait?.startsWith('item-icon:') ?? false;
    const w = Math.min(objectPortrait ? 700 : 960, this.width - 24);
    const mobile = w < 620;
    const portraitW = model.portrait
      ? objectPortrait
        ? mobile
          ? 84
          : 116
        : mobile
          ? 124
          : 190
      : 0;
    const textW = w - 48 - portraitW;
    const textRows = model.rows.filter((row) => row.kind === 'text');
    const choices = model.rows.filter((row) => row.kind === 'action');
    const body = textRows.map((row) =>
      row.kind === 'text'
        ? label(row.text, { width: textW, size: mobile ? 16 : 19 })
        : this.row(row, textW),
    );
    const buttons = choices.map((row) => this.row(row, w - 40));
    const bodyH = Math.max(
      model.portrait ? (objectPortrait ? 100 : mobile ? 150 : 180) : 64,
      body.reduce((sum, item) => sum + item.height + 12, 0),
    );
    const desired = 96 + bodyH + buttons.reduce((sum, item) => sum + item.height + 10, 0);
    const h = Math.min(this.height - 24, desired);
    const panel = new Container();
    panel.position.set((this.width - w) / 2, this.height - h - 12);
    this.dialogueStageHeight = panel.y;
    panel.eventMode = 'static';
    panel.hitArea = new Rectangle(0, 0, w, h);
    panel.addChild(this.panelBacking(w, h));
    this.drawHeader(panel, w);
    const role = label(model.subtitle ?? '', { size: 12, color: 0xc5bf9b });
    role.position.set(20, 44);
    panel.addChild(role);
    const content = new Container();
    const speech = new Container();
    speech.addChild(
      new Graphics().rect(0, 0, w - 40, bodyH).fill({ color: 0x142b27, alpha: 0.01 }),
    );
    let y = 0;
    for (const item of body) {
      item.position.set(portraitW, y);
      y += item.height + 12;
      speech.addChild(item);
    }
    if (model.portrait === 'player' && model.hero) {
      const hero = new PixelBattleHero(model.hero);
      const bounds = hero.getLocalBounds();
      const scale = Math.min((portraitW - 20) / bounds.width, bodyH / bounds.height);
      hero.scale.set(scale);
      hero.position.set(portraitW / 2 - (bounds.x + bounds.width / 2) * scale, -bounds.y * scale);
      speech.addChild(hero);
    } else if (model.portrait) {
      const texture = Assets.get<Texture>(model.portrait);
      if (texture) {
        texture.source.scaleMode = 'nearest';
        const frame = new Container();
        const portrait = new Sprite(texture);
        portrait.anchor.set(0.5, 0);
        const bust = objectPortrait || model.portrait.startsWith('portrait:');
        portrait.scale.set(
          Math.min(
            ((portraitW - 10) / texture.width) * (bust ? 1 : 1.5),
            (bodyH * (bust ? 1 : 1.8)) / texture.height,
          ),
        );
        portrait.position.set(portraitW / 2 - 6, 0);
        const mask = new Graphics().rect(0, 0, portraitW - 12, bodyH).fill(0xffffff);
        frame.addChild(portrait, mask);
        frame.mask = mask;
        speech.addChild(frame);
      }
    }
    content.addChild(speech);
    const scroll = new ScrollBox({
      type: 'vertical',
      width: w - 40,
      height: h - 86,
      elementsMargin: 12,
      globalScroll: false,
      disableEasing: true,
    });
    scroll.position.set(20, 72);
    scroll.addItems([content, ...buttons]);
    panel.addChild(scroll);
    this.root.addChild(panel);
  }

  private drawNotice(): void {
    const model = this.model!;
    const w = Math.min(480, this.width - 24);
    const body = model.rows
      .filter((row) => row.kind !== 'action')
      .map((row) => this.row(row, w - 48));
    const actions = model.rows.filter((row) => row.kind === 'action');
    const textH = body.reduce((sum, item) => sum + item.height + 12, 0);
    const h = Math.min(this.height - 24, Math.max(210, textH + 158));
    const panel = new Container();
    panel.position.set((this.width - w) / 2, (this.height - h) / 2);
    panel.eventMode = 'static';
    panel.hitArea = new Rectangle(0, 0, w, h);
    panel.addChild(this.panelBacking(w, h));
    this.drawHeader(panel, w);
    const scroll = new ScrollBox({
      type: 'vertical',
      width: w - 48,
      height: Math.max(40, h - 154),
      elementsMargin: 12,
      globalScroll: false,
      disableEasing: true,
    });
    scroll.position.set(24, 76);
    scroll.addItems(body);
    panel.addChild(scroll);
    panel.addChild(
      new Graphics().rect(12, h - 68, w - 24, 56).fill({ color: 0x070e0b, alpha: 0.35 }),
    );
    const gap = 12;
    const bw = (w - 48 - gap * Math.max(0, actions.length - 1)) / Math.max(1, actions.length);
    actions.forEach((row, index) => {
      const button = control({
        ...row,
        width: bw,
        height: 44,
        primary: index === 0,
        press: this.press,
      });
      button.position.set(24 + (actions.length - 1 - index) * (bw + gap), h - 62);
      panel.addChild(button);
    });
    this.root.addChild(panel);
  }

  private drawHeader(panel: Container, width: number): void {
    const title = label(this.model!.title, {
      size: 20,
      width: width - 90,
      family: '"Noto Serif TC", "PMingLiU", serif',
    });
    title.position.set(16, 12);
    panel.addChild(title);
    if (this.model!.skipAction) {
      const skip = control({
        label: '略過',
        action: this.model!.skipAction,
        width: 56,
        press: this.press,
      });
      skip.position.set(width - 66, 8);
      panel.addChild(skip);
    }
    if (this.model!.dismissible !== false) {
      const close = control({ label: '關閉', action: 'close', width: 56, press: this.press });
      close.position.set(width - 66, 8);
      panel.addChild(close);
    }
  }

  private drawRows(
    panel: Container,
    size: { width: number; height: number },
    items: Container[],
    portraitWidth: number,
  ): void {
    const width = size.width - 32 - portraitWidth;
    const scroll = new ScrollBox({
      type: 'vertical',
      width,
      height: Math.max(60, size.height - 82),
      elementsMargin: 10,
      globalScroll: false,
      disableEasing: true,
    });
    scroll.position.set(16 + portraitWidth, 60);
    scroll.addItems(items);
    panel.addChild(scroll);
    if (this.scrollable) {
      const hint = label('上下滑動查看更多', { size: 10, color: 0xa7b29c });
      hint.position.set(16, size.height - 19);
      panel.addChild(hint);
    }
  }

  private drawPortrait(panel: Container, height: number): void {
    const texture = Assets.get<Texture>(this.model!.portrait!);
    if (!texture) {
      return;
    }
    const backdrop = drawGamePlate(new Graphics(), 16, 60, 144, height - 76);
    panel.addChild(backdrop);
    texture.source.scaleMode = 'nearest';
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(Math.min(136 / texture.width, (height - 90) / texture.height));
    sprite.position.set(88, height - 16);
    panel.addChild(sprite);
  }

  private row(row: PanelRow, width: number, textSize = 14): Container {
    if (row.kind === 'body') {
      return bodyStatus(row.body, width);
    }
    if (row.kind === 'action') {
      const title = label(row.label, { width: width - 16, size: 13 });
      const height = Math.max(44, title.height + 18);
      title.destroy();
      return control({ ...row, width, height, press: this.press });
    }
    if (row.kind === 'input') {
      return this.input(row, width);
    }
    const text = label(row.text, {
      width: row.icon ? width - 100 : width,
      size: row.emphasis === 'heading' ? Math.max(18, textSize + 4) : textSize,
      color: row.emphasis === 'muted' ? 0xa7b29c : 0xeee4ca,
    });
    if (!row.icon) {
      return text;
    }
    const texture = Assets.get<Texture>(row.icon);
    if (!texture) {
      return text;
    }
    const entry = new Container();
    const portrait = row.icon.startsWith('portrait:');
    const iconSize = portrait ? 84 : row.icon.startsWith('item-icon:') ? 84 : 52;
    const height = portrait ? Math.max(156, text.height) : Math.max(iconSize, text.height);
    entry.addChild(new Graphics().rect(0, 0, width, height).fill({ color: 0, alpha: 0 }));
    if (portrait) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);
      sprite.scale.set(Math.min(iconSize / texture.width, 156 / texture.height));
      sprite.position.set(iconSize / 2, height);
      entry.addChild(sprite);
    } else {
      artIcon(entry, row.icon, iconSize / 2, height / 2, iconSize);
    }
    text.position.set(iconSize + 16, (height - text.height) / 2);
    entry.addChild(text);
    return entry;
  }

  private panelBacking(width: number, height: number): Container {
    const frame = new Container();
    frame.addChild(drawGamePlate(new Graphics(), 0, 0, width, height, { alpha: 1 }));
    const grain = new Graphics();
    for (let y = 58; y < height - 12; y += 6) {
      grain
        .moveTo(10, y)
        .lineTo(width - 10, y)
        .stroke({ color: 0x92a58a, alpha: y % 18 === 0 ? 0.035 : 0.015, width: 1 });
    }
    grain.rect(10, 8, width - 20, 43).fill({ color: 0x080f0c, alpha: 0.3 });
    const headerBottom = this.model?.subtitle ? 70 : 55;
    grain
      .moveTo(16, headerBottom)
      .lineTo(width - 16, headerBottom)
      .stroke({ color: 0xb9a673, alpha: 0.45, width: 1 });
    for (const x of [7, width - 7]) {
      for (const y of [7, height - 7]) {
        grain.circle(x, y, 2).fill(0xb8a274).circle(x, y, 0.7).fill(0x394536);
      }
    }
    frame.addChild(grain);
    return frame;
  }

  private input(row: Extract<PanelRow, { kind: 'input' }>, width: number): Input {
    if (this.textInput) {
      this.textInput.resizeField(width);
      return this.textInput;
    }
    const input = new NameInput({
      bg: surface(width, 48),
      value: row.value,
      maxLength: 12,
      padding: 12,
      textStyle: { fontSize: 18, fill: 0xeee4ca, fontFamily: 'sans-serif' },
    });
    input.label = 'hero-name';
    input.accessible = true;
    input.accessibleHint = '俠客姓名';
    input.tabIndex = 0;
    input.onChange.connect((value) => {
      row.value = value;
      row.change(value);
    });
    this.textInput = input;
    return input;
  }

  dispose(): void {
    this.root.destroy({ children: true });
  }
}
