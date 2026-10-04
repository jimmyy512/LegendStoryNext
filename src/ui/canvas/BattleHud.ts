import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { SKILLS } from '../../data/content';
import { BATTLE_LEFT, type Battle } from '../../game/battle';
import { battleThreat } from '../../game/battleThreat';
import { opponentName } from '../../game/opponentName';
import { PART_CAPACITY, PART_NAMES, workingLegs } from '../../game/body';
import { BodyDiagram } from './BodyDiagram';
import { battleOutcomeSheet } from './BattleOutcome';
import { battleSkillStatus } from './battleSkillStatus';
import { accessibleLabel, drawGamePlate, label } from './widgets';

type Button = {
  root: Container;
  bg: Graphics;
  text: Text;
  width: number;
  height: number;
  enabled: boolean;
  active?: boolean;
  emergency?: boolean;
};
const GOLD = 0xe9c783,
  TEAL = 0x75d6c0,
  RED = 0xef8d7b;
export const battleDockHeight = (width: number, height: number, finished = false): number =>
  height < 520 ? (finished ? 186 : 140) : width < 620 ? 354 : 240;

/** 持續存在的戰鬥 HUD。只有版面尺寸改變才重建，不因每次命中銷毀按鈕。 */
export class BattleHud extends Container {
  private texts = new Map<string, Text>();
  private buttons = new Map<string, Button>();
  private bars = new Graphics();
  private warningFrame = new Graphics();
  private ownBody: BodyDiagram;
  private enemyBody: BodyDiagram;
  private dockY: number;
  private compact: boolean;
  private mobile: boolean;
  private cardWidth: number;
  private bodyScale: number;
  private outcome: Container | null = null;

  constructor(
    private battle: Battle,
    private w: number,
    private h: number,
    private press: (action: string) => void,
  ) {
    super();
    this.compact = h < 520;
    this.mobile = w < 620 && !this.compact;
    this.cardWidth = Math.min(320, (w - 32) / 2);
    this.bodyScale = this.compact ? 0.42 : this.mobile ? 0.55 : 0.85;
    this.dockY = h - battleDockHeight(w, h);
    const cardH = this.compact ? 94 : this.mobile ? 137 : 165;
    const bg = new Graphics();
    for (const x of [12, w - 12 - this.cardWidth]) {
      drawGamePlate(bg, x, 12, this.cardWidth, cardH, { alpha: 0.94 });
    }
    if (w > 750 && !this.compact) {
      drawGamePlate(bg, w / 2 - 170, 12, 340, 78, { alpha: 0.84 });
    }
    bg.rect(0, this.dockY, w, h - this.dockY)
      .fill({ color: 0x10231f, alpha: 0.98 })
      .rect(0, this.dockY, w, 3)
      .fill(0xb79a5d)
      .rect(0, this.dockY + 5, w, 1)
      .fill({ color: 0x577466, alpha: 0.7 });
    for (const x of [20, w - 27]) {
      bg.rect(x, this.dockY + 11, 7, 7)
        .fill(0x9f8454)
        .rect(x + 2, this.dockY + 13, 3, 3)
        .fill(0x1c352d);
    }
    if (w > 750 && !this.compact) {
      this.warningFrame
        .roundRect(w / 2 - 173, 10, 346, 82, 8)
        .stroke({ color: RED, width: 2 })
        .rect(w / 2 - 169, 22, 4, 57)
        .fill(RED);
      this.warningFrame.visible = false;
    }
    this.addChild(bg, this.bars, this.warningFrame);
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
    enemyTitle.accessible = this.compact || (!this.mobile && w <= 750);
    enemyTitle.accessibleTitle = '切換對手';
    enemyTitle.on('pointertap', () => this.press('battle-targets'));
    this.put('hp', contentX, 48, this.mobile ? 11 : 15);
    this.put('enemyHp', enemyX, 48, this.mobile ? 11 : 15);
    this.put('mp', contentX, 76, this.mobile ? 11 : 12, 0x9dcde3);
    if (!this.compact) {
      this.put(
        'ownStatus',
        contentX,
        101,
        this.mobile ? 10 : 13,
        TEAL,
        this.cardWidth - 78 * this.bodyScale - 20,
      );
      this.put(
        'enemyStatus',
        enemyX,
        101,
        this.mobile ? 10 : 13,
        RED,
        this.cardWidth - 78 * this.bodyScale - 20,
      );
      this.put('target', enemyX, 77, 11, GOLD);
    }
    if (w > 750 && !this.compact) {
      this.put('title', w / 2, 22, 20, GOLD, 0, true).style.fontFamily =
        '"Noto Serif TC", "PMingLiU", serif';
      this.put('phase', w / 2, 54, 14, TEAL, 0, true);
      this.put('lastHit', w / 2, 82, 14, 0xe2d9bf, w - this.cardWidth * 2 - 70, true);
      this.makeButton('battle-targets', '切換對手', w - this.cardWidth + 90, 136, 112, 28);
    }
    if (this.mobile) {
      const hasMultipleTargets = battle.enemies.length > 1;
      const commandWidth = hasMultipleTargets ? (this.cardWidth - 6) / 2 : this.cardWidth;
      const commandX = w - 12 - this.cardWidth;
      if (hasMultipleTargets) {
        this.makeButton('battle-targets', '切換對手', commandX, 153, commandWidth, 36);
      } else {
        enemyTitle.accessible = true;
      }
      this.makeButton(
        'battle-parts',
        '選攻擊部位',
        commandX + (hasMultipleTargets ? commandWidth + 6 : 0),
        153,
        commandWidth,
        36,
      );
    }
    if (this.compact && !this.mobile) {
      this.makeButton('battle-parts', '選部位', w - this.cardWidth + 160, 78, 70, 24);
    }
    const centerW = Math.min(1280, w - 24),
      start = (w - centerW) / 2;
    this.put(
      'advice',
      start,
      this.dockY + (this.compact ? 5 : 9),
      this.compact ? 13 : this.mobile ? 14 : 19,
      GOLD,
      centerW - 100,
    );
    this.makeButton('battle-help', '操作說明', start + centerW - 88, this.dockY + 6, 88, 28);
    this.put(
      'action',
      start,
      this.dockY + (this.compact ? 28 : this.mobile ? 56 : 39),
      this.mobile ? 12 : this.compact ? 11 : 14,
      TEAL,
      centerW,
    );
    const moveW = this.mobile ? centerW : this.compact ? centerW * 0.49 : centerW * 0.43 - 12;
    const moveY = this.dockY + (this.compact ? 44 : this.mobile ? 103 : 86);
    if (!this.compact) {
      this.put('moveHeading', start, moveY - 24, this.mobile ? 12 : 15, 0xb9c9bc).text = '走位';
      this.put(
        'skillHeading',
        this.mobile ? start : start + centerW * 0.43,
        this.mobile ? this.dockY + 167 : moveY - 24,
        this.mobile ? 12 : 15,
        GOLD,
      ).text = '武學 · 點選後於下次出手施放';
    }
    [
      ['貼近對手', 'distance:2'],
      ['保持射程', `distance:${battle.player.route === 'sword' ? 4.3 : 2.3}`],
      ['拉開距離', 'distance:8'],
      ['停步回氣', 'distance-hold'],
    ].forEach(([name, action], i) =>
      this.makeButton(
        action,
        name,
        start + (i * moveW) / 4,
        moveY,
        moveW / 4 - 5,
        this.compact ? 44 : 54,
      ),
    );
    const skillX = this.mobile ? start : start + centerW * (this.compact ? 0.51 : 0.43);
    const skillW = this.mobile ? centerW : centerW * (this.compact ? 0.49 : 0.57);
    const skillY = this.compact ? moveY : this.mobile ? this.dockY + 188 : moveY;
    const skills = SKILLS[battle.player.route];
    skills.forEach((skill, i) =>
      this.makeButton(
        `battle:skill:${skill.id}`,
        skill.name,
        skillX + (i * skillW) / skills.length,
        skillY,
        skillW / skills.length - 6,
        this.compact ? 44 : this.mobile ? 72 : 66,
      ),
    );
    const commands = [
      ['battle:pause', '開始交鋒'],
      ['battle:defend', '立即防禦'],
      ['battle:items', '使用藥品'],
      ['battle:escape', '撤退'],
    ];
    const commandY = this.dockY + (this.compact ? 94 : this.mobile ? 276 : 169);
    const commandW = this.mobile || this.compact ? centerW : Math.min(920, centerW);
    commands.forEach(([action, name], i) =>
      this.makeButton(
        action,
        name,
        start + (i * commandW) / commands.length,
        commandY,
        commandW / commands.length - 6,
        this.compact ? 40 : this.mobile ? 58 : 58,
      ),
    );
    if (!this.mobile && !this.compact) {
      this.put('keys', start + commandW + 18, commandY + 8, 12, 0x9aaca2).text =
        '空白鍵：暫停\n點敵方部位圖：選擇攻擊位置';
    }
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
    const skillId = action.startsWith('battle:skill:')
      ? action.slice('battle:skill:'.length)
      : null;
    const iconSize = this.compact ? 30 : this.mobile ? 40 : 50;
    const root = new Container(),
      bg = new Graphics(),
      t = label(title, {
        size: skillId
          ? this.compact
            ? 11
            : this.mobile
              ? 13
              : 17
          : this.mobile || this.compact
            ? 12
            : 17,
        width: width - (skillId ? iconSize + 24 : 12),
      });
    t.anchor.set(skillId ? 0 : 0.5, 0.5);
    t.position.set(skillId ? iconSize + 18 : width / 2, height / 2);
    root.position.set(x, y);
    root.addChild(bg, t);
    if (skillId) {
      const texture = Assets.get<Texture>(`skill-icon:${skillId}`);
      texture.source.scaleMode = 'nearest';
      const icon = new Sprite(texture);
      icon.width = iconSize;
      icon.height = iconSize;
      icon.position.set(8, (height - iconSize) / 2);
      root.addChild(icon);
    }
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.accessible = true;
    root.accessibleTitle = title;
    root.tabIndex = 0;
    const button: Button = { root, bg, text: t, width, height, enabled: true };
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
    if (this.outcome) {
      return;
    }
    this.battle = b;
    const enemy = b.enemies[b.target],
      range = b.attackRange(b.queuedAction?.type === 'skill' ? b.queuedAction.skill : undefined);
    const distance = b.distance(),
      inRange = b.inRange(b.target, range),
      waiting = b.playerProgress >= 1 && !inRange;
    const danger = battleThreat(b);
    this.ownBody.update(b.player.body);
    this.enemyBody.update(enemy.body, b.targetPart);
    this.set('ownName', `Lv.${b.player.level} · ${b.player.name}`);
    this.set(
      'enemyName',
      `${enemy.level ? `Lv.${enemy.level}` : '敵方'} · ${opponentName(b.enemies, b.target)}${b.enemies.length > 1 ? ' ▾' : ''}`,
    );
    this.set('hp', `${b.player.hp} / ${b.stats.maxHp}`);
    this.set('enemyHp', `${enemy.hp} / ${enemy.stats.maxHp}`);
    this.set('mp', `內力 ${b.player.mp} / ${b.stats.maxMp}`);
    this.set(
      'target',
      `${PART_NAMES[b.targetPart]} ${enemy.body[b.targetPart]}/${PART_CAPACITY[b.targetPart]}`,
    );
    const ownStatus = [
      `自動攻擊 ${Math.round(b.playerProgress * 100)}%`,
      b.defending
        ? '護體防守'
        : b.player.body.head === 0
          ? '頭部重傷 · 攻擊力下降'
          : b.exhausted
            ? '腳力耗盡'
            : b.holdingPosition
              ? '停步回氣'
              : `氣勢 ${'◆'.repeat(b.momentum)}${'◇'.repeat(3 - b.momentum)}${b.momentum === 3 ? ' 招式爆發' : ''}`,
    ]
      .filter(Boolean)
      .join('\n');
    this.set('ownStatus', ownStatus);
    this.set(
      'enemyStatus',
      enemy.strikeRange
        ? b.intent(b.target)
        : enemy.body.head === 0
          ? '頭部重傷 · 攻擊力下降'
          : enemy.broken
            ? '破甲 · 防禦降低'
            : enemy.opening
              ? '破綻 · 趁隙追擊'
              : b.intent(b.target),
    );
    const pausedThreat = b.paused && !!danger.warning && !b.result;
    this.warningFrame.visible = pausedThreat;
    this.set('title', pausedThreat ? '敵方起手 · 戰術暫停' : b.encounter.name);
    if (this.texts.has('title')) {
      this.texts.get('title')!.style.fill = pausedThreat ? RED : GOLD;
    }
    const lastHit = [...b.events]
      .reverse()
      .find(
        (e) =>
          e.kind === 'damage' ||
          e.kind === 'injury' ||
          e.kind === 'miss' ||
          e.kind === 'guard' ||
          e.kind === 'heal' ||
          e.kind === 'talent',
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
        lastHit.kind === 'injury' || lastHit.kind === 'talent'
          ? lastHit.text
          : lastHit.kind === 'damage'
            ? lastHit.blocked
              ? `防禦成功 · 擋下 ${lastHit.blocked} 傷害 · 受到 ${lastHit.amount}`
              : `${lastHit.opening ? '追擊破綻 · ' : ''}${name} · ${lastHit.source === 'player' ? '命中' : '我方'}${PART_NAMES[lastHit.part!]} −${lastHit.amount}`
            : lastHit.kind === 'miss'
              ? '攻擊落空 · 對手已離開射程'
              : lastHit.kind === 'guard'
                ? `${name || '防禦'} · 護體生效`
                : '使用藥品 · 已回復',
      );
    }
    const hasStarted = b.clock.elapsed > 0;
    this.set(
      'phase',
      b.result
        ? '交鋒結束'
        : b.paused
          ? danger.warning
            ? '先防禦，或拉開距離後再繼續'
            : hasStarted
              ? '已暫停'
              : '準備中'
          : '交鋒中',
    );
    let advice = danger.warning
      ? b.paused
        ? `${danger.warning.replace(/！拉開或防禦$/, '')}！點「立即防禦」減傷，或先「拉開距離」再繼續`
        : danger.warning
      : b.paused
        ? hasStarted
          ? '交鋒已暫停；按「繼續交鋒」或點招式恢復'
          : '選好站位後按「開始交鋒」；點招式也會繼續交鋒'
        : b.guarding
          ? '收勢防守中 · 擋下攻擊後恢復普攻'
          : b.strike
            ? '正在出招 · 命中時仍需在射程內'
            : b.exhausted
              ? '腳力耗盡 · 等待回氣'
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
    this.texts.get('advice')!.style.fill = danger.warning && !b.result ? RED : GOLD;
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
    const threat = danger.count > 0 ? `${danger.count} 名敵人打得到我` : '敵人皆在射程外';
    const move =
      b.playerPosition <= BATTLE_LEFT + 0.01 && b.desiredDistance > distance + 0.1
        ? '已到左側邊界'
        : b.holdingPosition
          ? '停步'
          : `走向 ${b.desiredDistance.toFixed(1)}`;
    const stage = b.strike ? '起招' : waiting ? '等待射程' : b.recovery ? '收招' : '下次';
    this.set(
      'action',
      this.mobile
        ? `${reach} · ${threat} · ${move}\n${stage}：${skillName}　腳力 ${Math.round(b.stamina)}`
        : `${reach}　｜　${threat}　｜　距離 ${distance.toFixed(1)} · ${move}　｜　${stage}：${skillName}　｜　腳力 ${Math.round(b.stamina)}`,
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
        .rect(x, 70, bw, 5)
        .fill(0x2e4540)
        .rect(x, 70, Math.max(0.1, (bw * value) / max), 5)
        .fill(color);
    }
    if (!this.compact) {
      // 出手進度條：滿了就出手，雙方並排才看得出誰先動。
      for (const [x, value, color] of [
        [cx, b.playerProgress, GOLD],
        [ex, enemy.progress, RED],
      ]) {
        this.bars
          .rect(x, 95, bw, 4)
          .fill(0x2e4540)
          .rect(x, 95, Math.max(0.1, bw * value), 4)
          .fill(color);
      }
    }
    for (const [action, button] of this.buttons) {
      let title = button.text.text,
        active = false,
        enabled = !b.result;
      if (action === 'battle:pause') {
        title = b.result
          ? '返回探索'
          : b.paused
            ? b.clock.elapsed > 0
              ? pausedThreat
                ? '繼續交鋒 · 敵方即將命中'
                : '繼續交鋒'
              : '開始交鋒'
            : '暫停交鋒';
        enabled = true;
        active = b.paused && !pausedThreat;
      }
      const skill = SKILLS[b.player.route].find((s) => action === `battle:skill:${s.id}`);
      if (skill) {
        const status = battleSkillStatus(b, skill);
        active = status.active;
        enabled = status.enabled;
        title = status.title;
      }
      if (action === 'battle:defend') {
        title = b.defending
          ? '防守中 · 減傷 60%'
          : this.mobile
            ? '立即防禦\n腳力 20'
            : '立即防禦\n腳力 20 · 減傷 60%';
        enabled = enabled && b.stamina >= 20 && b.guardCooldown === 0;
        active =
          b.defending || queued?.type === 'defend' || (b.paused && !!danger.warning && enabled);
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
      accessibleLabel(button.root, title);
      if (button.text.text !== title) {
        button.text.text = title;
      }
      const emergency = action === 'battle:pause' && pausedThreat;
      if (button.active !== active || button.emergency !== emergency) {
        button.active = active;
        button.emergency = emergency;
        button.bg.clear();
        drawGamePlate(button.bg, 0, 0, button.width, button.height, {
          primary: action === 'battle:pause' && !pausedThreat,
          active,
        });
        button.text.style.fill = action === 'battle:pause' && !pausedThreat ? 0x13221e : 0xe8e9db;
      }
    }
    if (b.result) {
      for (const child of this.children) {
        if (child.y >= this.dockY) {
          child.visible = false;
        }
      }
      const outcomeHeight = battleDockHeight(this.w, this.h, true);
      this.outcome = battleOutcomeSheet(b, this.w, outcomeHeight, this.press);
      this.outcome.y = this.h - outcomeHeight;
      this.addChild(this.outcome);
    }
  }
}
