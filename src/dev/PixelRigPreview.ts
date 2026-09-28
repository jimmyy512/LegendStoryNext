import { Application, Assets, Graphics } from 'pixi.js';
import { loadMartialArts, MartialEffect, type MartialArt } from '../render/MartialEffects';
import {
  DEFAULT_LOOK,
  GEAR_SLOTS,
  motionDuration,
  PIXEL_FPS,
  PixelHeroine,
  WEAPONS,
  type GearSlot,
  type PixelInjury,
  type PixelLook,
  type PixelMotion,
  type PixelWeapon,
} from '../render/PixelHeroine';
import './pixelRigPreview.css';

// 選項清單直接讀骨架裡的 Skin，這裡只負責顯示名稱；沒列到的新 Skin 以原名顯示。
const LABELS: Record<string, Record<string, string>> = {
  outfit: {
    ivory: '米白青襟',
    jade: '墨綠金襟',
    night: '夜行衣',
    robe: '玄紅劍袍',
    scholar: '白金儒衫',
    orchid: '紫蘭夜袍',
    hunter: '獵戶短褂',
  },
  pants: { ink: '墨黑褲', moon: '月白褲', indigo: '靛藍褲', umber: '赭褐褲' },
  boots: { brown: '棕皮靴', black: '烏皮靴', white: '白布靴', red: '赤皮靴' },
  hairColor: { brown: '栗棕', black: '烏黑', silver: '銀白', auburn: '赤褐', chestnut: '深棕挑白' },
  hairStyle: { ponytail: '高馬尾', bun: '盤髻' },
  weapon: {
    none: '空手',
    sword: '長劍',
    saber: '彎刀',
    spear: '長槍',
    fan: '摺扇',
    darts: '飛鏢',
    knuckles: '拳套',
  },
};
const GEAR_TITLES: Record<GearSlot, string> = {
  headwear: '頭飾',
  cape: '披風',
  shoulders: '護肩',
  armor: '胸甲',
  robe: '下擺',
  trinket: '佩物',
};
const NONE = { none: '無' };
Object.assign(LABELS, {
  headwear: { ...NONE, straw: '竹斗笠', crown: '束髮金冠' },
  cape: { ...NONE, crimson: '緋紅披風', midnight: '夜藍披風' },
  shoulders: { ...NONE, iron: '鐵護肩', hide: '皮護肩' },
  armor: { ...NONE, lamellar: '札甲' },
  robe: { ...NONE, teal: '墨青長擺', crimson: '緋紅長擺', tassets: '札甲腰裙', apron: '毛邊獵裙' },
  trinket: { ...NONE, gourd: '酒葫蘆', pendant: '玉佩' },
});
// 空手與拳套的招式名稱改由選定的掌法特效決定。
const ATTACK_NAMES: Record<PixelWeapon, string> = {
  none: '出掌',
  sword: '引劍斜劈',
  saber: '引刀斜劈',
  spear: '沉腰突刺',
  fan: '展扇橫掃',
  darts: '過肩擲鏢',
  knuckles: '刺拳直拳',
};
const LEFT_NOTES: Record<PixelWeapon, string> = {
  none: '右臂垂落 · 左掌蓄力出招',
  sword: '右臂垂落 · 左手持劍',
  saber: '右臂垂落 · 左手持刀',
  spear: '右臂垂落 · 左手單手持槍',
  fan: '右臂垂落 · 左手執扇',
  darts: '右臂垂落 · 左手擲鏢',
  knuckles: '右臂垂落 · 左拳連刺',
};

// 兵器特效（Codex 繪製的 w-<兵器>）從出招的哪一秒開始播；六格共 0.75 秒。
const WEAPON_EFFECT_START: Partial<Record<PixelWeapon, number>> = {
  sword: 0.4,
  saber: 0.4,
  spear: 0.25,
  fan: 0.3,
  darts: 0.3,
};
const EFFECT_SPAN = 0.75;

export class PixelRigPreview {
  private stages: {
    app: Application;
    hero: PixelHeroine;
    effect: Graphics;
    burst: MartialEffect;
  }[] = [];
  private arts: MartialArt[] = [];
  private art = 'xianglong';
  private lifetime = new AbortController();
  private frame = 0;
  private previous = 0;
  private time = 0;
  private playing = true;
  private motion: PixelMotion = 'idle';
  private look: PixelLook = { ...DEFAULT_LOOK };
  private injury: PixelInjury = 'disabled';
  private speed = 1;
  private disposed = false;

  async init(progress: (value: number) => void): Promise<void> {
    document.querySelector('#app')!.innerHTML = `
      <main class="pixel-lab">
        <header><a href="?preview=styles">← 風格比對</a><span>像素女俠 · 換裝與兵器試作</span><a href="?preview=combat">戰鬥演武 →</a></header>
        <h1>衣冠兵器，任意搭配。</h1>
        <p class="pixel-lead">同一副骨架，衣、褲、靴、髮、兵器各自一組 Skin，隨時替換。左右並排比較正常與右手傷勢。</p>
        <section class="pixel-toolbar" aria-label="角色設定" id="pixel-look"></section>
        <section class="pixel-toolbar" aria-label="疊加裝備" id="pixel-gear"></section>
        <section class="pixel-toolbar" aria-label="狀態">
          <label>右側傷勢 <select id="pixel-injury"><option value="disabled">右手失能</option><option value="hurt">右手受傷</option><option value="healthy">雙手正常</option></select></label>
          <label>掌法特效 <select id="pixel-art"></select></label>
          <label>速度 <select id="pixel-speed"><option value="1">正常</option><option value="0.5">半速</option><option value="0.25">四分之一速</option></select></label>
          <button id="pixel-random">隨機搭配</button>
        </section>
        <section class="pixel-pair">
          <article><h2><span class="pixel-dot healthy"></span>雙手正常</h2><div id="pixel-healthy" class="pixel-stage"></div><p id="pixel-normal-note"></p></article>
          <article><h2><span id="pixel-dot" class="pixel-dot disabled"></span><span id="pixel-injury-title">右手失能</span></h2><div id="pixel-injured" class="pixel-stage"></div><p id="pixel-injury-note"></p></article>
        </section>
        <section class="pixel-actions" aria-label="動作">
          <button data-motion="idle" aria-pressed="true">待機</button><button data-motion="walk" aria-pressed="false">走路</button><button data-motion="attack" aria-pressed="false" id="pixel-attack">出招</button><button data-motion="hurt" aria-pressed="false">受擊</button>
        </section>
        <section class="pixel-playback">
          <button id="pixel-pause">暫停</button><button id="pixel-replay">重播</button><button id="pixel-step">逐格 +1/${PIXEL_FPS} 秒</button>
          <label for="pixel-time">動作時間</label><input id="pixel-time" type="range" min="0" max="2" step="0.01" value="0"><output id="pixel-clock">0.00 / 2.00 秒</output>
        </section>
        <p id="pixel-status" role="status"></p>
        <footer>分層像素素材 × Spine 骨架。衣褲靴髮為換色衍生或 AI 產生的部件，長槍、摺扇、飛鏢由程式逐點繪製。<br>長槍前手以 IK 扶在槍桿上，右手失能時改左手單手持槍。空手與拳套的掌法特效為 Codex 繪製的六格像素動畫。</footer>
      </main>`;
    const base = `${import.meta.env.BASE_URL}assets/characters/pixelHeroine/`;
    await Assets.load([`${base}pixel-heroine.json`, `${base}pixel-heroine.atlas`], progress);
    this.arts = await loadMartialArts();
    if (this.disposed) {
      return;
    }
    for (const [i, id] of ['pixel-healthy', 'pixel-injured'].entries()) {
      const app = new Application();
      // 以接近實際顯示大小的解析度渲染：沒旋轉的部件不變，旋轉的部件邊緣以細格取樣，
      // 不再是 320×220 放大後的粗鋸齒。
      const shown = document.getElementById(id)!.clientWidth * window.devicePixelRatio;
      await app.init({
        width: 320,
        height: 220,
        resolution: Math.min(6, Math.max(1, Math.round(shown / 320))),
        antialias: false,
        autoStart: false,
        background: 0x122923,
      });
      if (this.disposed) {
        app.destroy(true, { children: true });
        return;
      }
      document.getElementById(id)!.appendChild(app.canvas);
      app.canvas.setAttribute('aria-label', i ? '右手傷勢像素女俠' : '正常像素女俠');
      const bg = new Graphics().rect(0, 0, 320, 220).fill(0x152c27);
      bg.rect(249, 28, 22, 22).fill(0xc3c49c);
      bg.poly([0, 115, 55, 53, 125, 112, 193, 45, 320, 112, 320, 190, 0, 190]).fill(0x25443a);
      bg.poly([0, 155, 75, 106, 125, 148, 240, 90, 320, 133, 320, 190, 0, 190]).fill(0x375649);
      bg.rect(0, 190, 320, 30).fill(0x4c5847).rect(0, 190, 320, 2).fill(0x92a181);
      for (let x = 0; x < 320; x += 40) {
        bg.rect(x, 201, 35, 1).fill(0x697a60);
      }
      // 角色站左側，前方留出特效的射程。
      bg.rect(47, 189, 48, 3).fill(0x233a30);
      const hero = new PixelHeroine(base);
      hero.position.set(72, 188);
      const effect = new Graphics();
      const burst = new MartialEffect();
      app.stage.addChild(bg, hero, effect, burst);
      this.stages.push({ app, hero, effect, burst });
    }
    this.buildLookControls(this.stages[0].hero);
    this.bind();
    this.refreshEquipment();
    this.frame = requestAnimationFrame(this.tick);
  }

  dispose(): void {
    this.disposed = true;
    this.lifetime.abort();
    cancelAnimationFrame(this.frame);
    for (const stage of this.stages) {
      stage.app.destroy(true, { children: true });
    }
  }

  private get duration(): number {
    return motionDuration(this.motion, this.look.weapon);
  }

  private tick = (now: number): void => {
    const dt = this.previous ? Math.min((now - this.previous) / 1000, 0.05) : 0;
    this.previous = now;
    if (this.playing && !document.hidden) {
      this.time += dt * this.speed;
      if (this.time >= this.duration) {
        if (this.motion === 'idle' || this.motion === 'walk') {
          this.time %= this.duration;
        } else {
          this.time = this.duration;
          this.playing = false;
        }
      }
    }
    this.render();
    this.frame = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const t = Math.floor(this.time * PIXEL_FPS) / PIXEL_FPS;
    for (const { app, hero, effect, burst } of this.stages) {
      hero.pose(this.motion, this.time);
      effect.clear();
      burst.visible = false;
      if (this.motion === 'attack') {
        this.drawEffect(effect, burst, hero.actionOrigin(), t);
      }
      app.renderer.render(app.stage);
    }
    const range = document.querySelector<HTMLInputElement>('#pixel-time')!;
    range.max = String(this.duration);
    range.value = String(this.time);
    document.querySelector('#pixel-clock')!.textContent =
      `${this.time.toFixed(2)} / ${this.duration.toFixed(2)} 秒`;
    document.querySelector('#pixel-pause')!.textContent = this.playing ? '暫停' : '繼續';
  }

  /** 出招特效：兵器播各自的 Codex 特效，空手與拳套播選定的掌法。 */
  private drawEffect(
    effect: Graphics,
    burst: MartialEffect,
    origin: { x: number; y: number },
    t: number,
  ): void {
    const ox = Math.round(origin.x),
      oy = Math.round(origin.y);
    const weapon = this.look.weapon;
    const weaponArt = this.arts.find((item) => item.id === `w-${weapon}`);
    const start = WEAPON_EFFECT_START[weapon];
    if (weaponArt && start !== undefined) {
      burst.use(weaponArt);
      burst.show(origin, (t - start) / EFFECT_SPAN);
      return;
    }
    const art = this.arts.find((item) => item.id === this.art);
    if (art) {
      burst.use(art);
    }
    // 空手與拳套播選定的掌法特效；拳套第一拳另有命中的十字衝擊。
    switch (weapon) {
      case 'none':
        // 六格各 0.125 秒：蓄勁一格後在 0.62 秒出掌時爆發。
        burst.show(origin, (t - 0.4) / EFFECT_SPAN);
        break;
      case 'knuckles':
        // 第二拳直拳才發勁；第一拳只有命中的十字衝擊。
        burst.show(origin, (t - 0.3) / EFFECT_SPAN);
        if (t >= 0.12 && t < 0.24) {
          const s = Math.round((t - 0.12) * 60);
          effect
            .rect(ox + 4 - s, oy, s * 2 + 1, 1)
            .rect(ox + 4, oy - s, 1, s * 2 + 1)
            .fill(0xf9d776);
        }
        break;
    }
  }

  /** 依骨架內的 Skin 動態產生下拉選單，AI 新增的部件不用改這裡就會出現。 */
  private buildLookControls(hero: PixelHeroine): void {
    const rows: [string, string, string[]][] = [
      ['outfit', '衣裝', hero.skinOptions('outfit')],
      ['pants', '褲子', hero.skinOptions('pants')],
      ['boots', '鞋子', hero.skinOptions('boots')],
      ['hairColor', '髮色', hero.skinOptions('hair')],
      ['hairStyle', '髮型', hero.hairStyles(DEFAULT_LOOK.hairColor)],
      ['weapon', '兵器', Object.keys(WEAPONS)],
      ...GEAR_SLOTS.map((slot): [string, string, string[]] => [
        slot,
        GEAR_TITLES[slot],
        ['none', ...hero.skinOptions(`gear/${slot}`)],
      ]),
    ];
    const html = ([key, title, values]: [string, string, string[]]) =>
      `<label>${title} <select data-look="${key}">${values
        .map((id) => `<option value="${id}">${LABELS[key]?.[id] ?? id}</option>`)
        .join('')}</select></label>`;
    document.getElementById('pixel-look')!.innerHTML = rows.slice(0, 6).map(html).join('');
    document.getElementById('pixel-gear')!.innerHTML = rows.slice(6).map(html).join('');
    document.querySelectorAll<HTMLSelectElement>('[data-look]').forEach((select) =>
      select.addEventListener(
        'change',
        () => {
          const key = select.dataset.look!;
          this.setLook(key, select.value);
          if (key === 'weapon' && this.motion === 'attack') {
            this.time = 0;
            this.playing = true;
          }
          this.refreshEquipment();
        },
        { signal: this.lifetime.signal },
      ),
    );
  }

  private getLook(key: string): string {
    return (GEAR_SLOTS as readonly string[]).includes(key)
      ? this.look.gear[key as GearSlot]
      : (this.look as unknown as Record<string, string>)[key];
  }

  private setLook(key: string, value: string): void {
    this.look = (GEAR_SLOTS as readonly string[]).includes(key)
      ? { ...this.look, gear: { ...this.look.gear, [key]: value } }
      : { ...this.look, [key]: value };
  }

  private refreshEquipment(): void {
    this.stages.forEach(({ hero }, index) =>
      hero.equip(this.look, index ? this.injury : 'healthy'),
    );
    document.querySelectorAll<HTMLSelectElement>('[data-look]').forEach((select) => {
      select.value = this.getLook(select.dataset.look!);
    });
    const names = { healthy: '雙手正常', hurt: '右手受傷', disabled: '右手失能' };
    const weapon = this.look.weapon;
    const style = `${LABELS.weapon[weapon]} · ${this.attackName()}`;
    document.querySelector('#pixel-normal-note')!.textContent = style;
    document.querySelector('#pixel-injury-title')!.textContent = names[this.injury];
    document.querySelector('#pixel-dot')!.className = `pixel-dot ${this.injury}`;
    document.querySelector('#pixel-injury-note')!.textContent =
      this.injury === 'disabled'
        ? LEFT_NOTES[weapon]
        : this.injury === 'hurt'
          ? '右臂泛紅 · 仍可出招與持兵器'
          : style;
    document.querySelector('#pixel-attack')!.textContent = this.attackName();
    document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.motion === this.motion));
    });
    const motionLabel = {
      idle: '護身待機',
      walk: '走路',
      attack: this.attackName(),
      hurt: '受擊',
    }[this.motion];
    document.querySelector('#pixel-status')!.textContent =
      `${LABELS.weapon[weapon]} · ${motionLabel} · ${PIXEL_FPS} 格姿勢／秒`;
  }

  private attackName(): string {
    const weapon = this.look.weapon;
    const art = this.arts.find((item) => item.id === this.art)?.name;
    return (weapon === 'none' || weapon === 'knuckles') && art ? art : ATTACK_NAMES[weapon];
  }

  private bind(): void {
    const signal = this.lifetime.signal;
    const artSelect = document.getElementById('pixel-art') as HTMLSelectElement;
    artSelect.innerHTML = this.arts
      .filter((art) => !art.id.startsWith('w-'))
      .map((art) => `<option value="${art.id}">${art.name}</option>`)
      .join('');
    artSelect.value = this.art;
    const select = (id: string, handler: (value: string) => void) =>
      document.getElementById(id)!.addEventListener(
        'change',
        (e) => {
          handler((e.target as HTMLSelectElement).value);
          this.refreshEquipment();
        },
        { signal },
      );
    select('pixel-injury', (v) => {
      this.injury = v as PixelInjury;
    });
    select('pixel-art', (v) => {
      this.art = v;
      // 換掌法時若手上有兵刃，改回空手才看得到特效，並直接重播出招。
      if (this.look.weapon !== 'none' && this.look.weapon !== 'knuckles') {
        this.setLook('weapon', 'none');
      }
      this.motion = 'attack';
      this.time = 0;
      this.playing = true;
    });
    select('pixel-speed', (v) => {
      this.speed = Number(v);
    });
    document.getElementById('pixel-random')!.addEventListener(
      'click',
      () => {
        // 每一個選單隨機挑一項；裝備有一半機率不穿，免得每次都全副武裝。
        document.querySelectorAll<HTMLSelectElement>('[data-look]').forEach((select) => {
          const key = select.dataset.look!;
          const values = [...select.options].map((option) => option.value);
          const gear = (GEAR_SLOTS as readonly string[]).includes(key);
          this.setLook(
            key,
            gear && Math.random() < 0.5
              ? 'none'
              : values[Math.floor(Math.random() * values.length)],
          );
        });
        this.time = 0;
        this.playing = true;
        this.refreshEquipment();
      },
      { signal },
    );
    document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach((button) =>
      button.addEventListener(
        'click',
        () => {
          this.motion = button.dataset.motion as PixelMotion;
          this.time = 0;
          this.playing = true;
          this.refreshEquipment();
        },
        { signal },
      ),
    );
    document.querySelector('#pixel-pause')!.addEventListener(
      'click',
      () => {
        this.playing = !this.playing;
        if (this.time >= this.duration) {
          this.time = 0;
        }
      },
      { signal },
    );
    document.querySelector('#pixel-replay')!.addEventListener(
      'click',
      () => {
        this.time = 0;
        this.playing = true;
      },
      { signal },
    );
    document.querySelector('#pixel-step')!.addEventListener(
      'click',
      () => {
        this.playing = false;
        this.time = Math.min(
          this.duration,
          (Math.floor(this.time * PIXEL_FPS + 1e-6) + 1) / PIXEL_FPS,
        );
      },
      { signal },
    );
    document.querySelector('#pixel-time')!.addEventListener(
      'input',
      (e) => {
        this.playing = false;
        this.time = Number((e.target as HTMLInputElement).value);
      },
      { signal },
    );
  }
}
