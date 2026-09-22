import { INNER_ARTS, QUESTS, SKILLS } from '../data/content';
import { MAPS } from '../data/maps';
import type { Battle } from '../game/battle';
import { PART_NAMES, workingLegs } from '../game/body';
import { getStats } from '../game/state';
import { isEntityVisible } from '../game/story';
import type { GameState } from '../game/types';
import { bodyPanel } from './bodyPanel';
import { button, escapeHtml as esc, meter, portrait } from './html';

/** 只顯示傳入狀態，以 data-action 將操作交回應用層。 */
export class GameView {
  constructor(
    private readonly hud: HTMLElement,
    private readonly side: HTMLElement,
    private readonly footer: HTMLElement,
    private readonly overlay: HTMLElement,
  ) {}
  renderHome(): void {
    document.querySelector('#map-heading')!.innerHTML =
      '<div><span class="eyebrow">PROLOGUE</span><h1>江湖，從這裡開始。</h1></div><span class="map-weather">松風初起</span>';
    this.hud.innerHTML = `<div class="side-title">江湖手札<span>序</span></div><div class="intro-poem">一身行囊<br/>半卷心法<br/>山門之外<br/>便是江湖</div><div class="side-note">探索門派往事<br/>選擇你的武學之路</div>`;
    this.side.innerHTML = `<div class="side-title">初入全真<span>壹</span></div><p class="intro-copy">你循著一封舊信來到山腳。<br/><br/>松林深處，鐘聲正響。<br/>有人等你拜師，<br/>有人等你問起往事。</p><div class="note-card">回合之間，見招拆招。<br/>一念之差，江湖不同。</div>`;
    this.overlay.innerHTML = `<div class="title-screen"><div class="title-emblem">江湖</div><p class="eyebrow">A JOURNEY OF YOUR OWN</p><h2>口袋江湖</h2><p class="title-sub">初入全真 · 第一回</p><div class="title-actions">${button('踏入江湖 <span>→</span>', 'new', 'primary')}${button('繼續旅程', 'continue')}${button('讀取存檔', 'load-menu')}</div><small>場景與人物為原型示意美術</small></div>`;
    this.footer.innerHTML =
      '<div class="explore-footer"><span>探索 · 選擇 · 成長</span><span>電腦瀏覽器優先</span></div>';
  }

  renderExploration(state: GameState, notice: string): void {
    const map = MAPS[state.map];
    document.querySelector('#map-heading')!.innerHTML =
      `<div><span class="eyebrow">${esc(map.subtitle)}</span><h1>${map.name}</h1></div><span class="map-weather"><span class="weather-symbol">☼</span> ${state.map === 'cave' ? '洞中微明' : '辰時 · 晴'} <span class="region-tag">探索中</span></span>`;
    const quest = QUESTS[state.quest];
    const entities = map.entities.filter((entity) => isEntityVisible(state, entity));
    this.side.innerHTML = `<div class="side-title">當前行程<span>卷</span></div><section class="quest-summary"><span class="tiny-label">主線 · ${state.quest === 'complete' ? '已完成' : '進行中'}</span><h2>${quest.title}</h2><p>${quest.detail}</p><span class="location-pin">◇ ${quest.region}</span>${button('查看任務紀錄 <span>↗</span>', 'panel:journal', 'text-button')}</section><div class="side-title nearby-title">附近地點<span>${entities.length.toString().padStart(2, '0')}</span></div><nav class="entity-list" aria-label="附近人物與地點">${entities.map((entity) => `<button data-action="entity:${entity.id}" class="entity-row"><span class="entity-icon ${entity.kind}">${{ npc: '人', enemy: '武', portal: '行', chest: '物', herb: '採', clue: '察' }[entity.kind]}</span><span>${esc(entity.name)}<small>${{ npc: '交談', enemy: '切磋 / 戰鬥', portal: '前往地區', chest: state.opened.includes(entity.id) ? '已開啟' : '查看物資', herb: '採集物品', clue: '調查線索' }[entity.kind]}</small></span><span class="entity-arrow">›</span></button>`).join('')}</nav>`;
    this.footer.innerHTML = `<div class="explore-footer"><span><i class="status-light"></i>${esc(notice)}</span><span class="key-hint"><kbd>Esc</kbd> 關閉面板</span></div><div class="quickbar">${button('<span>人</span>角色武學', 'panel:character')}${button('<span>囊</span>行囊', 'panel:bag')}${button('<span>卷</span>任務', 'panel:journal')}${button('<span>存</span>存讀檔', 'panel:save')}${button('<span>設</span>設定', 'panel:settings')}</div>`;
  }

  renderHud(source: GameState): void {
    const stats = getStats(source);
    this.hud.innerHTML = `<div class="side-title">俠客小傳<span>人</span></div><div class="hero-portrait">${portrait()}<span class="portrait-seal">${source.route === 'sword' ? '劍' : '掌'}</span></div><div class="hero-name"><h2>${esc(source.name)}</h2><span>第 ${source.level} 重</span></div><p class="hero-school">${source.quest === 'arrival' || source.quest === 'trial' || source.quest === 'report' ? '初入江湖' : '全真門下'} · ${source.route === 'sword' ? '劍法' : '拳掌'}</p>${meter('生命', source.hp, stats.maxHp)}${bodyPanel(source.body)}${meter('內力', source.mp, stats.maxMp, 'mp')}<div class="xp-row"><span>修為</span><span>${source.xp} / ${source.level * 60}</span></div><div class="stat-grid"><div><span>攻擊</span><strong>${stats.attack}</strong></div><div><span>防禦</span><strong>${stats.defense}</strong></div><div><span>身法</span><strong>${stats.speed}</strong></div></div><div class="silver"><span>◈ 隨身銀兩</span><strong>${source.gold}<small> 兩</small></strong></div><div class="inner-art"><span class="tiny-label">所修內功</span><h3>${INNER_ARTS[source.route].name}</h3><p>${INNER_ARTS[source.route].description}</p></div>`;
  }

  renderBattle(battle: Battle, selectedTarget: number): void {
    document.querySelector('#map-heading')!.innerHTML =
      `<div><span class="eyebrow">半即時交鋒 · 部位傷勢</span><h1>${battle.encounter.name}</h1></div><span class="round-badge" id="battle-time">${battle.clock.elapsed.toFixed(1)} 秒</span>`;
    this.overlay.innerHTML = `<div class="battle-banner"><span>${battle.result ? { victory: '勝負已分', defeat: '暫退一步', escaped: '抽身而退' }[battle.result] : battle.paused ? '戰術暫停' : '自動交鋒'}</span><small>${battle.result ? '點選下方按鈕返回江湖' : '蓄勢完成自動普攻 · 空白鍵暫停'}</small></div><div class="turn-order"><span>出手蓄勢</span><progress id="charge-player" max="1" value="${battle.playerProgress}" aria-label="我方出手蓄勢"></progress><span>${esc(battle.player.name)}</span></div>`;
    this.side.innerHTML = `<div class="side-title">敵情<span>武</span></div><div class="enemy-cards">${battle.enemies.map((enemy, index) => `<button class="enemy-card ${selectedTarget === index ? 'selected' : ''}" data-action="target:${index}" ${enemy.hp <= 0 ? 'disabled' : ''}><div><strong>${enemy.name}</strong><span>${enemy.hp <= 0 ? '敗退' : selectedTarget === index ? '目前目標' : '選為目標'}</span></div>${meter('生命', enemy.hp, enemy.stats.maxHp)}<progress id="charge-enemy-${index}" max="1" value="${enemy.progress}" aria-label="${enemy.name}出手蓄勢"></progress><p class="intent ${battle.intent(index).includes('重擊') ? 'danger' : ''}">${enemy.hp <= 0 ? '已失去戰鬥能力' : battle.intent(index)}</p></button>`).join('')}</div>
      <div class="side-title">攻擊部位<span>傷</span></div>${bodyPanel(battle.enemies[selectedTarget].body, battle.targetPart)}
      <div class="battle-log" role="log">${battle.events
        .slice(-4)
        .map((event) => `<p>${esc(event.text)}</p>`)
        .join('')}</div>`;
    if (battle.result) {
      this.footer.innerHTML = `<div class="battle-result"><div><span class="tiny-label">${battle.result === 'victory' ? 'VICTORY' : '江湖路長'}</span><h3>${battle.result === 'victory' ? `銀兩 +${battle.reward.gold} · 修為 +${battle.reward.xp}` : battle.result === 'defeat' ? '返回安全處治療，再戰不遲。' : '傷勢與消耗會保留。'}</h3></div>${button('返回探索 →', 'battle-end', 'primary')}</div>`;
      return;
    }
    const queued = battle.queuedAction;
    const queuedName =
      queued?.type === 'skill'
        ? SKILLS[battle.player.route].find((skill) => skill.id === queued.skill)!.name
        : queued
          ? { attack: '普通攻擊', item: '使用藥品', defend: '防禦', escape: '撤退' }[
              queued.type as 'attack' | 'item' | 'defend' | 'escape'
            ]
          : '自動普攻';
    this.footer.innerHTML = `<div class="battle-hint">下次出手：${queuedName} · 目標：${PART_NAMES[battle.targetPart]} ${queued ? button('取消預約', 'battle:cancel', 'small-button') : ''}</div><div class="battle-commands">${button(`<strong>${battle.paused ? '戰' : '停'}</strong><span>${battle.paused ? '開始交鋒' : '戰術暫停'}<small>空白鍵</small></span>`, 'battle:pause')}${SKILLS[battle.player.route].map((skill) => button(`<strong>技</strong><span>${skill.name}<small>需${skill.limbs.hands === 2 ? '雙手' : '單手'} · 威力 ${Math.round(battle.skillPower(skill.id) * 100)}% · 氣 ${skill.cost}</small></span>`, `battle:skill:${skill.id}`, '', battle.player.mp < skill.cost || battle.skillPower(skill.id) === 0)).join('')}${button('<strong>禦</strong><span>防禦<small>下次出手時生效</small></span>', 'battle:defend')}${button('<strong>藥</strong><span>道具<small>開啟時暫停</small></span>', 'battle:items')}${button('<strong>退</strong><span>撤退<small>傷腿降低成功率</small></span>', 'battle:escape', '', !battle.encounter.escapable || workingLegs(battle.player.body) === 0)}</div>`;
  }

  updateBattleClock(battle: Battle): void {
    const timer = document.querySelector('#battle-time');
    if (timer) {
      timer.textContent = `${battle.clock.elapsed.toFixed(1)} 秒`;
    }
    const player = document.querySelector<HTMLProgressElement>('#charge-player');
    if (player) {
      player.value = battle.playerProgress;
    }
    for (const [index, enemy] of battle.enemies.entries()) {
      const bar = document.querySelector<HTMLProgressElement>(`#charge-enemy-${index}`);
      if (bar) {
        bar.value = enemy.progress;
      }
    }
  }
}
