import { Physics, Spine, Skin, Vector2, type Bone } from '@esotericsoftware/spine-pixi-v8';
import { Container } from 'pixi.js';

export type PixelMotion = 'idle' | 'walk' | 'run' | 'jump' | 'down' | 'attack' | 'hurt';
export type PixelWeapon = 'none' | 'sword' | 'saber' | 'spear' | 'fan' | 'darts' | 'knuckles';
export type PixelInjury = 'healthy' | 'hurt' | 'disabled';

/** 外觀組合。每一類對應骨架裡的一組 Skin，可任意搭配。 */
export interface PixelLook {
  outfit: string;
  pants: string;
  boots: string;
  hairColor: string;
  hairStyle: string;
  /** 臉型，依髮色各有一顆頭。 */
  face: string;
  weapon: PixelWeapon;
  /** 疊加裝備，每類一件，'none' 表示不穿。 */
  gear: Record<GearSlot, string>;
}
export const GEAR_SLOTS = ['headwear', 'cape', 'shoulders', 'armor', 'robe', 'trinket'] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];
export const DEFAULT_LOOK: PixelLook = {
  outfit: 'ivory',
  pants: 'ink',
  boots: 'brown',
  hairColor: 'brown',
  hairStyle: 'ponytail',
  face: 'classic',
  weapon: 'none',
  gear: {
    headwear: 'none',
    cape: 'none',
    shoulders: 'none',
    armor: 'none',
    robe: 'none',
    trinket: 'none',
  },
};

interface WeaponProfile {
  /** 手的附件：張掌、握持或拳套。 */
  hands: 'palm' | 'grip' | 'knuckle';
  /** 手中兵刃的素材名稱，沒有就不掛。 */
  item?: string;
  idle: string;
  walk: string;
  attack: string;
  /** 動作名稱是否依持物手加上 R／L。 */
  sided: boolean;
  duration: number;
  /** 右手失能時的攻擊，未指定則為 attack + L。 */
  leftAttack?: string;
  /** 長槍：左手以 IK 扶在槍桿上。 */
  twoHanded?: boolean;
}
// 每種兵器明列自己的動作，新增兵器不能默認沿用刀劍。
export const WEAPONS: Record<PixelWeapon, WeaponProfile> = {
  none: {
    hands: 'palm',
    idle: 'idle',
    walk: 'walk',
    attack: 'palmBoth',
    leftAttack: 'palmL',
    sided: false,
    duration: 1.6,
  },
  sword: {
    hands: 'grip',
    item: 'sword',
    idle: 'idleArmed',
    walk: 'walkArmed',
    attack: 'slash',
    sided: true,
    duration: 1.6,
  },
  saber: {
    hands: 'grip',
    item: 'saber',
    idle: 'idleArmed',
    walk: 'walkArmed',
    attack: 'slash',
    sided: true,
    duration: 1.6,
  },
  spear: {
    hands: 'grip',
    item: 'spear',
    idle: 'idleSpear',
    walk: 'walkSpear',
    attack: 'thrust',
    sided: true,
    duration: 1.3,
    twoHanded: true,
  },
  fan: {
    hands: 'grip',
    item: 'fan',
    idle: 'idleFan',
    walk: 'walkFan',
    attack: 'fan',
    sided: true,
    duration: 1.4,
  },
  darts: {
    hands: 'grip',
    item: 'dart',
    idle: 'idleDart',
    walk: 'walkDart',
    attack: 'throw',
    sided: true,
    duration: 1.2,
  },
  knuckles: {
    hands: 'knuckle',
    idle: 'idleFist',
    walk: 'walk',
    attack: 'punchBoth',
    leftAttack: 'punchL',
    sided: false,
    duration: 1.3,
  },
};

export const motionDuration = (motion: PixelMotion, weapon: PixelWeapon): number =>
  motion === 'attack'
    ? WEAPONS[weapon].duration
    : { idle: IDLE_STEP * 8, walk: 0.8, run: 0.5, jump: 0.9, down: 1.4, hurt: 0.5, attack: 0 }[
        motion
      ];

/** 待機每格秒數，需與 tools/buildPixelHeroine.ts 的 IDLE_STEP 相同。 */
const IDLE_STEP = 0.125;

/** 姿勢採樣格率。維持逐格的像素手感，又不至於卡頓。 */
export const PIXEL_FPS = 24;

// 腳踝落點（相對角色原點，y 向上）。左腳是遠側前導腳。
// 骨架設定為接近直立，護身與出招時整體再沉腰 CROUCH 像素。
const STANCE = { L: 12, R: -11 };
const CROUCH = 4;
// 戴斗笠時馬尾改從帽簷下的後腦垂出（頭部骨頭座標，y 向上），否則髮根會穿出帽頂。
const UNDER_HAT = { x: -2, y: -12 };
type Gait = { home: Record<'L' | 'R', number>; stride: number; lift: number; contact: number };
const WALK: Gait = { home: { L: 3, R: -3 }, stride: 10, lift: 5, contact: 0.55 };
// 跑步每隻腳著地不到一半的時間，兩腳交替之間有騰空期。
// 雙腳的中心落在身體後方，整個人像從腳踝往前傾。
const RUN: Gait = { home: { L: 1, R: -5 }, stride: 18, lift: 13, contact: 0.34 };
// 跳躍：蹲低到 JUMP.takeoff 起跳，JUMP.land 落地，最高 JUMP.height 像素；空中雙腳往上收 JUMP.tuck 像素。
const JUMP = { takeoff: 0.18, land: 0.72, height: 38, tuck: 12, settle: 0.18 };
// 倒地：向後轉倒躺平，身體往右挪讓整個人留在原位附近，並抬高到背貼地。
const DOWN = { start: 0.12, fall: 0.45, angle: 90, shift: 55, lift: 22 };

/** 雙骨鏈：上段、下段與末端骨，以及兩段在設定姿勢下的長度與方向。 */
type Chain = {
  thigh: Bone;
  calf: Bone;
  foot: Bone;
  upper: number;
  lower: number;
  a1: number;
  a2: number;
};

/** 分層素材、Skin 換裝、腳掌反解與獨立傷手覆蓋，不修改戰鬥規則。 */
export class PixelHeroine extends Container {
  readonly actor: Spine;
  private currentAnimation = '';
  private injury: PixelInjury = 'healthy';
  private look: PixelLook = { ...DEFAULT_LOOK };
  private motion: PixelMotion = 'idle';
  private poseTime = 0;
  private readonly legs: Record<'L' | 'R', Chain>;
  private readonly ankleHeight: number;
  private readonly braceArm: Chain;

  constructor(base: string) {
    super();
    this.actor = Spine.from({
      skeleton: `${base}pixel-heroine.json`,
      atlas: `${base}pixel-heroine.atlas`,
      autoUpdate: false,
    });
    this.addChild(this.actor);
    const skeleton = this.actor.skeleton;
    const find = (name: string) => skeleton.findBone(name) ?? missing(name);
    const chain = (top: string, middle: string, end: string): Chain => {
      const thigh = find(top);
      const calf = find(middle);
      const foot = find(end);
      return {
        thigh,
        calf,
        foot,
        upper: Math.hypot(calf.data.setupPose.x, calf.data.setupPose.y),
        lower: Math.hypot(foot.data.setupPose.x, foot.data.setupPose.y),
        a1: Math.atan2(calf.data.setupPose.y, calf.data.setupPose.x),
        a2: Math.atan2(foot.data.setupPose.y, foot.data.setupPose.x),
      };
    };
    this.legs = {
      L: chain('thighL', 'calfL', 'footL'),
      R: chain('thighR', 'calfR', 'footR'),
    };
    this.braceArm = chain('upperL', 'foreL', 'handL');

    // 靴底與腳踝的高度差：從靴子附件的底邊算出，讓鞋底剛好貼在原點。
    const boot = skeleton.data
      .findSkin('boots/brown')
      ?.getAttachment(skeleton.findSlot('bootR')!.data.index, 'bootR') as {
      y: number;
      height: number;
    } | null;
    this.ankleHeight = boot ? boot.height / 2 - boot.y : 13;
    this.actor.beforeUpdateWorldTransforms = () => this.plantLegs();
    this.equip(DEFAULT_LOOK, 'healthy');
  }

  /** 骨架裡某一類 Skin 的所有選項，例如 skinOptions('pants')。 */
  skinOptions(category: string): string[] {
    const prefix = `${category}/`;
    return [
      ...new Set(
        this.actor.skeleton.data.skins
          .map((skin) => skin.name)
          .filter((name) => name.startsWith(prefix))
          .map((name) => name.slice(prefix.length).split('/')[0]),
      ),
    ];
  }

  /** 某個髮色底下可選的臉型。 */
  faces(color: string): string[] {
    const prefix = `head/${color}/`;
    return this.actor.skeleton.data.skins
      .map((skin) => skin.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length));
  }

  /** 某個髮色底下可選的髮型。 */
  hairStyles(color: string): string[] {
    const prefix = `hair/${color}/`;
    return this.actor.skeleton.data.skins
      .map((skin) => skin.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length));
  }

  equip(look: PixelLook, injury: PixelInjury): void {
    this.look = { ...look, gear: { ...look.gear } };
    this.injury = injury;
    const profile = WEAPONS[look.weapon];
    const hand = injury === 'disabled' ? 'L' : 'R';
    const names = [
      `outfit/${look.outfit}`,
      `pants/${look.pants}`,
      `boots/${look.boots}`,
      `hair/${look.hairColor}/${look.hairStyle}`,
      `head/${look.hairColor}/${look.face}`,
      `hands/${profile.hands}`,
    ];
    if (profile.item) {
      names.push(`weapon/${profile.item}/${hand}`);
    }
    for (const slot of GEAR_SLOTS) {
      if (look.gear[slot] !== 'none') {
        names.push(`gear/${slot}/${look.gear[slot]}`);
      }
    }
    const skin = new Skin('equipped');
    for (const name of names) {
      const source = this.actor.skeleton.data.findSkin(name);
      if (!source) {
        throw new Error(`缺少像素角色 Skin：${name}`);
      }
      skin.addSkin(source);
    }
    this.actor.skeleton.setSkin(skin);
    this.actor.skeleton.setupPoseSlots();
    this.currentAnimation = '';
  }

  pose(motion: PixelMotion, time: number): void {
    this.motion = motion;
    const disabled = this.injury === 'disabled';
    const profile = WEAPONS[this.look.weapon];
    const hand = disabled ? 'L' : 'R';
    const named = (name: string) => (profile.sided ? `${name}${hand}` : name);
    // 跑、跳、倒地與走路共用持物方式：walkSpear → runSpear、jumpSpear、downSpear。
    const moving = motion === 'walk' || motion === 'run' || motion === 'jump' || motion === 'down';
    const animation =
      motion === 'attack'
        ? disabled && profile.leftAttack
          ? profile.leftAttack
          : named(profile.attack)
        : moving
          ? named(profile.walk.replace(/^walk/, motion))
          : named(profile.idle);
    // 受擊只帶動軀幹，疊在護身姿勢上，手中兵刃維持架勢。
    const key = motion === 'hurt' ? `${animation}+hurt` : animation;
    if (key !== this.currentAnimation) {
      this.actor.state.clearTracks();
      // 換動作時先還原插槽，扇子展開、飛鏢出手這類附件切換才不會殘留。
      this.actor.skeleton.setupPoseSlots();
      this.actor.state.setAnimation(0, animation, false);
      if (motion === 'hurt') {
        this.actor.state.setAnimation(1, 'hurt', false);
      }
      if (disabled) {
        this.actor.state.setAnimation(2, 'injuredR', false);
      }
      this.currentAnimation = key;
    }
    this.actor.skeleton.setupPoseBones();
    // 固定格率取樣，保留像素逐格感；腳由反解貼地，鞋底永遠落在原點高度。
    this.poseTime = Math.floor(time * PIXEL_FPS + 1e-6) / PIXEL_FPS;
    this.actor.state.getTrack(0)!.trackTime = motion === 'hurt' ? 0 : this.poseTime;
    const hurt = this.actor.state.getTrack(1);
    if (hurt) {
      hurt.trackTime = this.poseTime;
    }
    this.actor.update(0);
    // 雙手持槍時左手扶在槍桿上；右手失能則單手持槍，不扶。
    if (profile.twoHanded && !disabled) {
      this.brace();
      this.actor.skeleton.updateWorldTransform(Physics.none);
    }
    this.actor.y = 0;
    for (const name of ['upperR', 'foreR', 'handR']) {
      const slot = this.actor.skeleton.findSlot(name)!;
      if (this.injury === 'hurt') {
        slot.pose.color.set(1, 0.55, 0.5, 1);
      } else if (disabled) {
        slot.pose.color.set(0.55, 0.57, 0.62, 1);
      } else {
        slot.pose.color.set(1, 1, 1, 1);
      }
    }
  }

  /** 出招特效起點：長槍取槍尖，其餘取持物手或出掌的掌心。 */
  actionOrigin(): { x: number; y: number } {
    const weapon = this.look.weapon;
    const side =
      this.injury === 'disabled' || (this.motion === 'attack' && !WEAPONS[weapon].sided)
        ? 'L'
        : 'R';
    const bone = weapon === 'spear' ? `tip${side}` : `palm${side}`;
    const point = this.actor.skeleton.findBone(bone)!.appliedPose;
    return { x: this.x + this.actor.x + point.worldX, y: this.y + this.actor.y + point.worldY };
  }

  private plantLegs(): void {
    const hair = this.actor.skeleton.findBone('hair')!;
    const { x, y } = hair.data.setupPose;
    const hat = this.look.gear.headwear === 'straw';
    hair.pose.x = hat ? x + UNDER_HAT.x : x;
    hair.pose.y = hat ? y + UNDER_HAT.y : y;
    const hip = this.actor.skeleton.findBone('hip')!.pose;
    const t = this.poseTime;
    const gait = this.motion === 'walk' ? WALK : this.motion === 'run' ? RUN : null;
    let phase = 0;
    let height = 0;
    let air = 0;
    let fall = 0;
    if (gait) {
      phase = (t / motionDuration(this.motion, this.look.weapon)) % 1;
      // 每步落地後重心最低，換腳中段最高；跑步起伏更大並微蹲。
      const bob = 0.5 + 0.5 * Math.cos(phase * Math.PI * 4);
      hip.y += this.motion === 'run' ? -2 - 3 * bob : -1.5 * bob;
    } else if (this.motion === 'jump') {
      if (t < JUMP.takeoff) {
        hip.y -= CROUCH + 6 * Math.sin(((t / JUMP.takeoff) * Math.PI) / 2);
      } else if (t < JUMP.land) {
        const s = (t - JUMP.takeoff) / (JUMP.land - JUMP.takeoff);
        air = 4 * s * (1 - s);
        height = JUMP.height * air;
        hip.y += height - 2;
      } else {
        const s = Math.min(1, (t - JUMP.land) / JUMP.settle);
        hip.y -= CROUCH + 7 * (1 - s);
      }
    } else if (this.motion === 'down') {
      const s = Math.min(1, Math.max(0, (t - DOWN.start) / DOWN.fall));
      fall = s * s * (3 - 2 * s);
      // 中招先往後退半步，倒下後在地上彈一下。
      hip.x -= 3 * Math.min(1, t / DOWN.start);
      hip.y -= CROUCH * (1 - fall);
      const land = DOWN.start + DOWN.fall;
      const bounce = t > land && t < land + 0.2 ? Math.sin(((t - land) / 0.2) * Math.PI) * 4 : 0;
      const root = this.actor.skeleton.getRootBone()!.pose;
      root.rotation = DOWN.angle * fall - bounce;
      root.x = DOWN.shift * fall;
      root.y = DOWN.lift * fall;
    } else {
      hip.y -= CROUCH;
    }
    // 披風隨步伐與呼吸輕擺，往後飄。
    const cape = this.actor.skeleton.findBone('cape')!.pose;
    cape.rotation =
      this.motion === 'walk'
        ? -10 + Math.sin(phase * Math.PI * 4) * 3
        : this.motion === 'run'
          ? -24 + Math.sin(phase * Math.PI * 4) * 4
          : this.motion === 'jump'
            ? -6 - height * 0.6
            : this.motion === 'down'
              ? -4 - 16 * fall
              : this.motion === 'attack'
                ? -12
                : // 待機跟著八格呼吸逐格切換，比馬尾再慢一點，連續微轉會讓像素閃爍。
                  [-3, -3, -3, -4, -4, -5, -5, -4][Math.floor(t / IDLE_STEP + 1e-6) % 8];
    for (const side of ['L', 'R'] as const) {
      let x: number = STANCE[side];
      let y = this.ankleHeight;
      if (gait) {
        const p = (phase + (side === 'L' ? 0 : 0.5)) % 1;
        if (p < gait.contact) {
          // 支撐期：腳掌貼地，相對身體等速後移。
          x = gait.home[side] + gait.stride * (1 - (2 * p) / gait.contact);
        } else {
          const s = (p - gait.contact) / (1 - gait.contact);
          const eased = s * s * (3 - 2 * s);
          x = gait.home[side] - gait.stride + 2 * gait.stride * eased;
          y += Math.sin(s * Math.PI) * gait.lift;
        }
      } else if (height > 0) {
        // 空中收腿：雙腳跟著身體升起後再往上收，腳離髖部變近，膝蓋因此彎起。
        x = STANCE[side] * 0.5 + (side === 'L' ? 3 : -1);
        y += height + JUMP.tuck * air;
      }
      const leg = this.legs[side];
      this.reach(leg, hip.x, hip.y, x, y);
      if (fall > 0) {
        // 倒地後雙腿不再貼地，逐漸彎成仰躺時膝蓋朝上的姿勢，靴子跟著身體方向。
        const thigh = lerp(leg.thigh.pose.rotation, side === 'L' ? 38 : 22, fall);
        const calf = lerp(leg.calf.pose.rotation, side === 'L' ? -70 : -40, fall);
        leg.thigh.pose.rotation = thigh;
        leg.calf.pose.rotation = calf;
        leg.foot.pose.rotation = -thigh - calf;
      }
    }
  }

  /** 左臂反解到槍桿上的前手握點，手肘朝下。座標取軀幹的區域座標。 */
  private brace(): void {
    const skeleton = this.actor.skeleton;
    const grip = skeleton.findBone('weaponR')!.appliedPose;
    const front = skeleton.findBone('supportR')!.appliedPose;
    const shoulder = skeleton.findBone('upperL')!.appliedPose;
    const reach = this.braceArm.upper + this.braceArm.lower - 0.5;
    // 突刺時槍桿從前手中滑出：前手扶點搆不到就沿槍桿往後手方向找最遠搆得到的一點。
    let u = 1;
    const at = (k: number) => ({
      x: grip.worldX + (front.worldX - grip.worldX) * k,
      y: grip.worldY + (front.worldY - grip.worldY) * k,
    });
    while (u > 0 && Math.hypot(at(u).x - shoulder.worldX, at(u).y - shoulder.worldY) > reach) {
      u -= 0.02;
    }
    const point = at(Math.max(0, u));
    const target = skeleton
      .findBone('torso')!
      .appliedPose.worldToLocal(new Vector2(point.x, point.y));
    const { thigh: upper, calf: fore } = this.braceArm;
    const [t1, t2] = solve(this.braceArm, upper.pose.x, upper.pose.y, target.x, target.y, 'down');
    const deg = 180 / Math.PI;
    upper.pose.rotation = (t1 - this.braceArm.a1) * deg;
    fore.pose.rotation = (t2 - this.braceArm.a2) * deg - upper.pose.rotation;
  }

  /** 雙骨反解：膝蓋朝前，靴子保持水平。 */
  private reach(leg: Chain, hipX: number, hipY: number, x: number, y: number): void {
    const { thigh, calf, foot } = leg;
    const [t1, t2] = solve(leg, hipX + thigh.pose.x, hipY + thigh.pose.y, x, y, 'forward');
    const deg = 180 / Math.PI;
    thigh.pose.rotation = (t1 - leg.a1) * deg;
    calf.pose.rotation = (t2 - leg.a2) * deg - thigh.pose.rotation;
    foot.pose.rotation = -thigh.pose.rotation - calf.pose.rotation;
  }
}

/** 從 (ox, oy) 伸到 (x, y) 的雙骨解，回傳兩段的世界角（弧度）。bend 決定中間關節偏向。 */
function solve(
  chain: Chain,
  ox: number,
  oy: number,
  x: number,
  y: number,
  bend: 'forward' | 'down',
): [number, number] {
  const { upper, lower } = chain;
  const dx = x - ox;
  const dy = y - oy;
  const span = Math.max(
    Math.abs(upper - lower) + 0.01,
    Math.min(upper + lower - 0.01, Math.hypot(dx, dy)),
  );
  const toward = Math.atan2(dy, dx);
  const angle = Math.acos(
    Math.max(-1, Math.min(1, (upper * upper + span * span - lower * lower) / (2 * upper * span))),
  );
  // 兩個解中取關節較靠前（膝）或較低（肘）的一個。
  const a = toward + angle;
  const b = toward - angle;
  const pick = bend === 'forward' ? Math.cos(a) > Math.cos(b) : Math.sin(a) < Math.sin(b);
  const t1 = pick ? a : b;
  const jx = ox + Math.cos(t1) * upper;
  const jy = oy + Math.sin(t1) * upper;
  return [t1, Math.atan2(y - jy, x - jx)];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function missing(name: string): never {
  throw new Error(`缺少像素角色骨頭或約束：${name}`);
}
