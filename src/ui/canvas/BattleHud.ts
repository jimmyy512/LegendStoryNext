import { Container, Graphics, Text, Rectangle } from 'pixi.js';
import { SKILLS } from '../../data/content';
import type { Battle } from '../../game/battle';
import { PART_CAPACITY, PART_NAMES, workingLegs } from '../../game/body';
import { BodyDiagram } from './BodyDiagram';
import { label } from './widgets';

type Button = {
  root: Container;
  bg: Graphics;
  text: Text;
  width: number;
  height: number;
  enabled: boolean;
  active?: boolean;
};
const GOLD = 0xe9c783,
  TEAL = 0x75d6c0,
  RED = 0xef8d7b;
export const battleDockHeight = (width: number, height: number): number =>
  width < 620 ? 270 : height < 520 ? 156 : 202;

/** 持續存在的戰鬥 HUD。只有版面尺寸改變才重建，不因每次命中銷毀按鈕。 */
export class BattleHud extends Container {
  private texts = new Map<string, Text>();
  private buttons = new Map<string, Button>();
  private bars = new Graphics();
  private ruler = new Graphics();
  private ownBody: BodyDiagram;
  private enemyBody: BodyDiagram;
  private banner = new Container();
  private rulerWidth: number;
  private dockY: number;
  private compact: boolean;
  private mobile: boolean;
  private cardWidth: number;
  private bodyScale: number;

  constructor(
    private battle: Battle,
    private w: number,
    h: number,
    private press: (action: string) => void,
  ) {
    super();
    this.mobile = w < 620;
    this.compact = h < 520;
    this.cardWidth = Math.min(300, (w - 32) / 2);
    this.bodyScale = this.compact ? 0.42 : this.mobile ? 0.55 : 0.85;
    this.dockY = h - battleDockHeight(w, h);
    const cardH = this.compact ? 94 : this.mobile ? 137 : 165;
    const bg = new Graphics();
    for (const x of [12, w - 12 - this.cardWidth]) {
      bg.roundRect(x, 12, this.cardWidth, cardH, 12)
        .fill({ color: 0x102322, alpha: 0.94 })
        .stroke({ color: 0x4c685e, width: 1 });
    }
    bg.rect(0, this.dockY, w, h - this.dockY)
      .fill({ color: 0x0d201e, alpha: 0.97 })
      .moveTo(0, this.dockY)
      .lineTo(w, this.dockY)
      .stroke({ color: 0x8e7c53, width: 1 });
    this.addChild(bg, this.bars);
    this.ownBody = new BodyDiagram(() => this.press('injuries'));
    this.enemyBody = new BodyDiagram((part) => this.press(`body:${part}`));
    this.ownBody.scale.set(this.bodyScale);
    this.enemyBody.scale.set(this.bodyScale);
    this.ownBody.position.set(20, 43);
    this.enemyBody.position.set(w - this.cardWidth, 43);
    this.addChild(this.ownBody, this.enemyBody);
    const contentX = 24 + 78 * this.bodyScale;
    const enemyX = w - this.cardWidth + 78 * this.bodyScale;
    this.put('ownName', 24, 17, this.mobile ? 13 : 17);
    this.put('enemyName', w - this.cardWidth, 17, this.mobile ? 13 : 17);
    const enemyTitle = this.texts.get('enemyName')!;
    enemyTitle.eventMode = 'static';
    enemyTitle.cursor = 'pointer';
    enemyTitle.accessible = true;
    enemyTitle.accessibleTitle = '切換對手';
    enemyTitle.on('pointertap', () => this.press('battle-targets'));
    this.put('hp', contentX, 48, this.mobile ? 11 : 14);
    this.put('enemyHp', enemyX, 48, this.mobile ? 11 : 14);
    this.put('mp', contentX, 76, 11, 0x9dcde3);
    if (!this.compact) {
      this.put(
        'ownStatus',
        contentX,
        101,
        this.mobile ? 10 : 12,
        TEAL,
        this.cardWidth - 78 * this.bodyScale - 20,
      );
      this.put(
        'enemyStatus',
        enemyX,
        101,
        this.mobile ? 10 : 12,
        RED,
        this.cardWidth - 78 * this.bodyScale - 20,
      );
      this.put('target', enemyX, 77, 11, GOLD);
    }
    if (w > 750 && !this.compact) {
      this.put('title', w / 2, 22, 20, GOLD, 0, true);
      this.put('phase', w / 2, 54, 14, TEAL, 0, true);
      this.put('lastHit', w / 2, 82, 14, 0xe2d9bf, w - this.cardWidth * 2 - 70, true);
      this.makeButton('battle-targets', '切換對手', w - this.cardWidth + 90, 144, 100, 26);
    }
    if (this.mobile) {
      this.makeButton(
        'battle-parts',
        '選攻擊部位',
        enemyX,
        121,
        this.cardWidth - 78 * this.bodyScale - 16,
        24,
      );
    }
    if (this.compact) {
      this.makeButton('battle-parts', '選部位', w - this.cardWidth + 160, 78, 70, 24);
    }
    const centerW = Math.min(960, w - 24),
      start = (w - centerW) / 2;
    this.put('advice', w / 2, this.dockY + 8, this.compact ? 12 : 15, GOLD, centerW - 170, true);
    this.makeButton('battle-help', '？ 說明', start + centerW - 76, this.dockY + 5, 76, 26);
    this.put('action', start, this.dockY + (this.compact ? 29 : 37), 12, TEAL, centerW);
    this.rulerWidth = this.mobile ? centerW : centerW * 0.46;
    const rulerY = this.dockY + (this.mobile ? 76 : this.compact ? 49 : 62);
    this.ruler.position.set(start, rulerY);
    this.ruler.eventMode = 'static';
    this.ruler.cursor = 'pointer';
    this.ruler.hitArea = new Rectangle(0, 0, this.rulerWidth, 40);
    this.ruler.on('pointerdown', (e) => {
      const x = this.ruler.toLocal(e.global).x;
      this.press(`distance:${1 + (9 * (x - 40)) / (this.rulerWidth - 44)}`);
    });
    this.addChild(this.ruler);
    const legendY = rulerY - 2;
    this.put('rulerLegend', start + 3, legendY + 3, 10, 0xc1d8ca);
    this.set('rulerLegend', '我射程\n敵射程');
    const moveX = this.mobile ? start : start + centerW * 0.5;
    const moveY = this.mobile ? rulerY + 48 : rulerY;
    const moveW = this.mobile ? centerW : centerW * 0.5;
    [
      ['近身\n貼身纏鬥', 'distance:2'],
      ['持距\n站在射程內', `distance:${battle.player.route === 'sword' ? 4.3 : 2.3}`],
      ['拉開\n退出敵射程', 'distance:8'],
      ['停步回氣\n恢復腳力', 'distance-hold'],
    ].forEach(([name, action], i) =>
      this.makeButton(action, name, moveX + (i * moveW) / 4, moveY, moveW / 4 - 5, 40),
    );
    const skillY = this.mobile ? moveY + 44 : rulerY + 48;
    const gap = 6,
      cols = this.mobile ? 3 : 6,
      bw = (centerW - gap * (cols - 1)) / cols;
    const skills = SKILLS[battle.player.route];
    const commands = [
      ['battle:pause', '開始交鋒'],
      ...skills.map((s) => [`battle:skill:${s.id}`, s.name]),
      ['battle:defend', '防禦'],
      ['battle:items', '藥品'],
      ['battle:escape', '撤退'],
    ];
    commands.forEach(([action, name], i) =>
      this.makeButton(
        action,
        name,
        start + (i % cols) * (bw + gap),
        skillY + Math.floor(i / cols) * 46,
        bw,
        41,
      ),
    );
    if (!this.mobile && !this.compact) {
      this.put('keys', w / 2, h - 23, 11, 0x9aaca2, 0, true).text =
        'A / D 調整距離　·　空白鍵 暫停　·　點敵人部位圖選擇攻擊位置';
    }
    this.addChild(this.banner);
    const bannerW = Math.min(390, w - 32),
      bannerY = Math.max(cardH + 28, (this.dockY + cardH) / 2 - 40);
    this.banner.addChild(
      new Graphics()
        .roundRect(0, 0, bannerW, 112, 12)
        .fill({ color: 0x102322, alpha: 0.94 })
        .stroke({ color: GOLD, width: 1 }),
    );
    this.banner.position.set((w - bannerW) / 2, bannerY);
    this.banner.eventMode = 'static';
    this.banner.cursor = 'pointer';
    this.banner.on('pointertap', () => this.press('battle:pause'));
    const bannerTitle = this.put('bannerTitle', bannerW / 2, 10, 20, GOLD, 0, true, this.banner);
    bannerTitle.text = '準備交鋒';
    this.put('bannerHelp', bannerW / 2, 44, 12, 0xdce4d6, bannerW - 24, true, this.banner).text =
      '先按「開始交鋒」\n進入射程會自動普攻，點招式預約下一擊';
    this.put('bannerHint', bannerW / 2, 86, 11, 0x9dcde3, bannerW - 24, true, this.banner).text =
      '第一次交手？按操作區右上「？ 說明」看規則';
    this.update(battle);
  }
  private put(
    id: string,
    x: number,
    y: number,
    size: number,
    color = 0xe8e9db,
    width = 0,
    center = false,
    parent: Container = this,
  ): Text {
    const t = label('', { size, color, width: width || undefined });
    t.position.set(x, y);
    if (center) {
      t.anchor.set(0.5, 0);
    }
    parent.addChild(t);
    this.texts.set(id, t);
    return t;
  }
  private set(id: string, value: string): void {
    const t = this.texts.get(id);
    if (t && t.text !== value) {
      t.text = value;
    }
  }
  private makeButton(
    action: string,
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const root = new Container(),
      bg = new Graphics(),
      t = label(title, { size: this.mobile || this.compact ? 12 : 14, width: width - 10 });
    t.anchor.set(0.5);
    t.position.set(width / 2, height / 2);
    root.position.set(x, y);
    root.addChild(bg, t);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.accessible = true;
    root.accessibleTitle = title;
    root.tabIndex = 0;
    const button = { root, bg, text: t, width, height, enabled: true };
    this.buttons.set(action, button);
    this.addChild(root);
    root.on('pointertap', (e) => {
      e.stopPropagation();
      if (button.enabled) {
        this.press(action === 'battle:pause' && this.battle.result ? 'battle-end' : action);
      }
    });
  }
  update(b: Battle): void {
    this.battle = b;
    const enemy = b.enemies[b.target],
      range = b.attackRange(b.queuedAction?.type === 'skill' ? b.queuedAction.skill : undefined);
    const distance = b.distance(),
      inRange = b.inRange(b.target, range),
      waiting = b.playerProgress >= 1 && !inRange;
    this.ownBody.update(b.player.body);
    this.enemyBody.update(enemy.body, b.targetPart);
    this.set('ownName', `Lv.${b.player.level} · ${b.player.name}`);
    this.set(
      'enemyName',
      `${enemy.level ? `Lv.${enemy.level}` : '敵方'} · ${enemy.name}${b.enemies.length > 1 ? ' ▾' : ''}`,
    );
    this.set('hp', `${b.player.hp} / ${b.stats.maxHp}`);
    this.set('enemyHp', `${enemy.hp} / ${enemy.stats.maxHp}`);
    this.set('mp', `內力 ${b.player.mp} / ${b.stats.maxMp}`);
    this.set(
      'target',
      `${PART_NAMES[b.targetPart]} ${enemy.body[b.targetPart]}/${PART_CAPACITY[b.targetPart]}`,
    );
    const ownStatus = [
      this.mobile
        ? `出手 ${Math.round(b.playerProgress * 100)}%`
        : `出手 ${Math.round(b.playerProgress * 100)}% · 滿了自動出招`,
      b.defending ? '護體防守' : b.exhausted ? '腳力耗盡' : b.holdingPosition ? '停步回氣' : '',
      `氣勢 ${'◆'.repeat(b.momentum)}${'◇'.repeat(3 - b.momentum)}${b.momentum === 3 ? ' 招式爆發' : ''}`,
    ]
      .filter(Boolean)
      .join('\n');
    this.set('ownStatus', ownStatus);
    this.set(
      'enemyStatus',
      enemy.strikeRange
        ? b.intent(b.target)
        : enemy.broken
          ? '破甲 · 防禦降低'
          : enemy.opening
            ? '破綻 · 趁隙追擊'
            : this.mobile
              ? `蓄勢 ${Math.round(enemy.progress * 100)}%`
              : `${b.intent(b.target)}\n蓄勢 ${Math.round(enemy.progress * 100)}%`,
    );
    this.set('title', b.encounter.name);
    const lastHit = [...b.events]
      .reverse()
      .find(
        (e) => e.kind === 'damage' || e.kind === 'miss' || e.kind === 'guard' || e.kind === 'heal',
      );
    if (lastHit) {
      const name = lastHit.skill
        ? SKILLS[b.player.route].find((s) => s.id === lastHit.skill)?.name
        : lastHit.kind === 'damage'
          ? lastHit.source === 'player'
            ? '普通攻擊'
            : lastHit.heavy
              ? '敵方重擊'
              : '敵方普攻'
          : '';
      this.set(
        'lastHit',
        lastHit.kind === 'damage'
          ? `${name} · ${lastHit.source === 'player' ? '命中' : '我方'}${PART_NAMES[lastHit.part!]} −${lastHit.amount}`
          : lastHit.kind === 'miss'
            ? '攻擊落空 · 對手已離開射程'
            : lastHit.kind === 'guard'
              ? `${name || '防禦'} · 護體生效`
              : '使用藥品 · 已回復',
      );
    }
    this.set('phase', b.result ? '交鋒結束' : b.paused ? '戰術暫停' : '交鋒中');
    let advice = b.paused
      ? '選好站位與攻擊部位，再開始交鋒'
      : b.guarding
        ? '收勢防守中 · 擋下攻擊後恢復普攻'
        : b.strike
          ? '正在出招 · 命中時仍需在射程內'
          : b.exhausted
            ? '腳力耗盡 · 等待回氣'
            : enemy.strikeRange
              ? `${enemy.name}正在${b.intent(b.target).includes('重擊') ? '重擊蓄力' : '出手'}！拉開或防禦`
              : !inRange
                ? distance < range.min
                  ? '太近了 · 後退到射程內'
                  : '距離太遠 · 靠近才能出招'
                : enemy.opening
                  ? '敵人露出破綻 · 趁現在使出招式'
                  : '已進入射程 · 自動普攻中';
    if (b.result) {
      advice =
        b.result === 'victory'
          ? `獲勝 · 銀兩 +${b.reward.gold} · 修為 +${b.reward.xp}`
          : b.result === 'defeat'
            ? '已無法再戰 · 回安全處療傷'
            : '成功撤退';
    }
    this.set('advice', advice);
    const queued = b.queuedAction;
    const skillName =
      queued?.type === 'skill'
        ? SKILLS[b.player.route].find((s) => s.id === queued.skill)?.name
        : queued?.type === 'defend'
          ? '防禦'
          : queued?.type === 'item'
            ? '使用藥品'
            : queued?.type === 'escape'
              ? '撤退'
              : '普通攻擊';
    // 距離戰最重要的兩件事：我打不打得到、敵人打不打得到我。
    const reach = inRange ? '我打得到 ✓' : distance < range.min ? '太近打不到' : '太遠打不到';
    const threat = b.inRange(b.target, b.enemyRange(b.target)) ? '敵打得到我 ⚠' : '敵打不到我';
    const move = b.holdingPosition ? '停步' : `走向 ${b.desiredDistance.toFixed(1)}`;
    const stage = b.strike ? '起招' : waiting ? '等待射程' : b.recovery ? '收招' : '下次';
    this.set(
      'action',
      this.mobile
        ? `距離 ${distance.toFixed(1)} → ${move}　${reach}　${threat}\n${stage}：${skillName}　腳力 ${Math.round(b.stamina)}`
        : `距離 ${distance.toFixed(1)}（${move}）　｜　${reach}　｜　${threat}　｜　${stage}：${skillName}　｜　腳力 ${Math.round(b.stamina)}`,
    );
    const cx = 24 + 78 * this.bodyScale,
      ex = this.w - this.cardWidth + 78 * this.bodyScale,
      bw = this.cardWidth - 78 * this.bodyScale - 28;
    this.bars.clear();
    for (const [x, value, max, color] of [
      [cx, b.player.hp, b.stats.maxHp, TEAL],
      [ex, enemy.hp, enemy.stats.maxHp, RED],
    ]) {
      this.bars
        .roundRect(x, 70, bw, 4, 2)
        .fill(0x2e4540)
        .roundRect(x, 70, Math.max(0.1, (bw * value) / max), 4, 2)
        .fill(color);
    }
    if (!this.compact) {
      // 出手進度條：滿了就出手，雙方並排才看得出誰先動。
      for (const [x, value, color] of [
        [cx, b.playerProgress, GOLD],
        [ex, enemy.progress, RED],
      ]) {
        this.bars
          .roundRect(x, 95, bw, 3, 1.5)
          .fill(0x2e4540)
          .roundRect(x, 95, Math.max(0.1, bw * value), 3, 1.5)
          .fill(color);
      }
    }
    const px = (v: number) => 40 + Math.max(0, Math.min(1, (v - 1) / 9)) * (this.rulerWidth - 44);
    const er = b.enemyRange(b.target);
    this.ruler
      .clear()
      .roundRect(0, 0, this.rulerWidth, 40, 5)
      .fill(0x1c3831)
      .rect(px(range.min), 4, px(range.max) - px(range.min), 10)
      .fill({ color: TEAL, alpha: 0.65 })
      .rect(px(er.min), 20, px(er.max) - px(er.min), 6)
      .fill({ color: RED, alpha: 0.65 });
    for (let n = 1; n <= 10; n++) {
      this.ruler.moveTo(px(n), 29).lineTo(px(n), 34).stroke({ color: 0x78988a, width: 1 });
    }
    this.ruler
      .moveTo(px(b.desiredDistance), 0)
      .lineTo(px(b.desiredDistance), 30)
      .stroke({ color: GOLD, width: 2 })
      .circle(px(distance), 15, 6)
      .fill(0xf5f6ed)
      .stroke({ color: 0x13221e, width: 2 });
    for (const [action, button] of this.buttons) {
      let title = button.text.text,
        active = false,
        enabled = !b.result;
      if (action === 'battle:pause') {
        title = b.result ? '返回探索' : b.paused ? '▶ 開始交鋒' : 'Ⅱ 暫停';
        enabled = true;
        active = b.paused;
      }
      const skill = SKILLS[b.player.route].find((s) => action === `battle:skill:${s.id}`);
      if (skill) {
        const queuedSkill = queued?.type === 'skill' && queued.skill === skill.id;
        active = queuedSkill;
        enabled = enabled && b.player.mp >= skill.cost && b.skillPower(skill.id) > 0;
        title = `${queuedSkill ? (b.strike ? '施展 ' : '已預約 ') : ''}${skill.name}\n${skill.effect === 'counter' ? '護體反擊' : skill.effect === 'break' ? '削弱防禦' : '強力攻擊'} · 氣 ${skill.cost}`;
      }
      if (action === 'battle:defend') {
        title = b.defending ? '防守中 · 減傷 60%' : '立即防禦\n腳力 20 · 減傷 60%';
        enabled = enabled && b.stamina >= 20 && b.guardCooldown === 0;
        active = b.defending || queued?.type === 'defend';
      }
      if (action === 'battle:escape') {
        enabled = enabled && b.encounter.escapable && workingLegs(b.player.body) > 0;
      }
      if (action === 'distance-hold') {
        active = b.holdingPosition;
      }
      if (action.startsWith('distance:')) {
        active = !b.holdingPosition && Math.abs(Number(action.slice(9)) - b.desiredDistance) < 0.1;
      }
      button.enabled = enabled;
      button.root.alpha = enabled ? 1 : 0.4;
      button.root.accessible = enabled;
      button.root.accessibleTitle = title;
      if (button.text.text !== title) {
        button.text.text = title;
      }
      if (button.active !== active) {
        button.active = active;
        button.bg
          .clear()
          .roundRect(0, 0, button.width, button.height, 7)
          .fill(active ? 0x385a48 : 0x203832)
          .stroke({ color: active ? GOLD : 0x58746a, width: active ? 2 : 1 });
      }
    }
    this.banner.visible = b.paused && !b.result && b.clock.elapsed === 0;
    this.set('bannerTitle', b.clock.elapsed > 0 ? '戰術暫停' : '準備交鋒');
    this.set(
      'bannerHelp',
      b.clock.elapsed > 0
        ? '可以調整站位與攻擊部位\n按「開始交鋒」或空白鍵繼續'
        : '點此開始交鋒\n進入射程會自動普攻，點招式預約下一擊',
    );
  }
}
