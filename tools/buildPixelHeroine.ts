import { readFileSync, writeFileSync } from 'node:fs';

// 部件由 tools/pixelHeroineParts.py 縮成 1:1 像素並量好關節點，這裡只組骨架與動作。
// 附件以關節點對齊骨頭原點，子骨頭放在下一個關節點，接縫位置因此不靠人工微調。
const root = 'art/characters/pixelHeroine';
const out = 'public/assets/characters/pixelHeroine';
type Point = [number, number];
type Part = { width: number; height: number; points: Record<string, Point> };
const parts = JSON.parse(readFileSync(`${root}/source/rig-points.json`, 'utf8')) as Record<
  string,
  Part
>;
const part = (name: string) => parts[name] ?? fail(`缺少部件 ${name}`);
function fail(message: string): never {
  throw new Error(message);
}
const pt = (name: string, joint: string) => part(name).points[joint] ?? fail(`${name}.${joint}`);
const round = (value: number) => Math.round(value * 100) / 100;
/** 圖片座標（y 向下）的兩個關節點，換成骨頭座標（y 向上）的位移。 */
const offset = (name: string, from: string, to: string): Point => {
  const [ax, ay] = pt(name, from);
  const [bx, by] = pt(name, to);
  return [round(bx - ax), round(ay - by)];
};
const angle = ([x, y]: Point) => (Math.atan2(y, x) * 180) / Math.PI;
const attach = (region: string, joint: string) => {
  const { width, height } = part(region);
  const [x, y] = pt(region, joint);
  return { path: region, x: round(width / 2 - x), y: round(y - height / 2), width, height };
};

const torso = 'ivory';
const hipMid: Point = [
  (pt(torso, 'hipF')[0] + pt(torso, 'hipB')[0]) / 2,
  (pt(torso, 'hipF')[1] + pt(torso, 'hipB')[1]) / 2,
];
parts[torso].points.hipMid = hipMid;
parts.jade.points.hipMid = hipMid;
const leg = offset('thighR', 'hip', 'knee');
const shin = offset('shinR', 'knee', 'ankle');
const sole = pt('bootR', 'heel')[1] - pt('bootR', 'ankle')[1];

const bone = (name: string, parent: string, [x, y]: Point) => ({ name, parent, x, y });
// 近側為右手右腳，面向右方時畫在軀幹前；遠側為左手左腳，畫在軀幹後。
const bones = [
  { name: 'root' },
  { name: 'hip', parent: 'root', y: round(sole + Math.hypot(...leg) + Math.hypot(...shin) - 1.5) },
  bone('torso', 'hip', offset(torso, 'hipMid', 'waist')),
  bone('head', 'torso', offset(torso, 'waist', 'neck')),
  bone('hair', 'head', offset('head', 'neck', 'bun')),
  // 披風掛在後頸，執行期再加一點飄動。
  bone('cape', 'torso', offset(torso, 'waist', 'neck')),
  ...(['L', 'R'] as const).flatMap((side) => [
    bone(`upper${side}`, 'torso', offset(torso, 'waist', side === 'L' ? 'shoulderF' : 'shoulderB')),
    bone(`fore${side}`, `upper${side}`, offset('upperR', 'shoulder', 'elbow')),
    bone(`hand${side}`, `fore${side}`, offset('foreR', 'elbow', 'wrist')),
    bone(`palm${side}`, `hand${side}`, offset('palmR', 'wrist', 'center')),
    bone(`weapon${side}`, `hand${side}`, offset('gripR', 'wrist', 'center')),
    // 槍尖與長槍前手握點，依槍的量測點放在兵刃骨頭上（刃尖朝上為 +y）。
    bone(`tip${side}`, `weapon${side}`, offset('spear', 'grip', 'tip')),
    bone(`support${side}`, `weapon${side}`, offset('spear', 'grip', 'grip2')),
    bone(`thigh${side}`, 'hip', offset(torso, 'hipMid', side === 'L' ? 'hipF' : 'hipB')),
    bone(`calf${side}`, `thigh${side}`, leg),
    bone(`foot${side}`, `calf${side}`, shin),
  ]),
];
const slotBones: [string, string][] = [
  ['cape', 'cape'],
  ['hair', 'hair'],
  ['weaponL', 'weaponL'],
  ['handL', 'handL'],
  ['foreL', 'foreL'],
  ['upperL', 'upperL'],
  ['shoulderL', 'upperL'],
  ['bootL', 'footL'],
  ['shinL', 'calfL'],
  ['thighL', 'thighL'],
  ['bootR', 'footR'],
  ['shinR', 'calfR'],
  ['thighR', 'thighR'],
  ['robe', 'hip'],
  ['torso', 'torso'],
  // 腰裙、獵裙繫在上衣外面，畫在軀幹之上；長擺則在軀幹底下當衣襬。
  ['belt', 'hip'],
  ['armor', 'torso'],
  ['trinket', 'torso'],
  ['head', 'head'],
  ['headwear', 'head'],
  ['weaponR', 'weaponR'],
  ['handR', 'handR'],
  ['foreR', 'foreR'],
  ['upperR', 'upperR'],
  ['shoulderR', 'upperR'],
];

type Attachments = Record<string, Record<string, ReturnType<typeof attach>>>;
const sides = ['L', 'R'] as const;
/** 素材名稱加上變體後綴；基本款沒有後綴。 */
const variant = (name: string, id: string, plain: string) =>
  id === plain ? name : `${name}_${id}`;
const skin = (name: string, attachments: Attachments) => ({ name, attachments });
const perSide = (make: (side: 'L' | 'R') => Attachments): Attachments =>
  Object.assign({}, ...sides.map(make));

// 衣櫃：每一類各自一組 Skin，執行期自由組合。
const OUTFITS = ['ivory', 'jade', 'night', 'robe', 'scholar', 'orchid', 'hunter'];
const PANTS = ['ink', 'moon', 'indigo', 'umber'];
const BOOTS = ['brown', 'black', 'white', 'red'];
const HAIR_COLORS = ['brown', 'black', 'silver', 'auburn', 'chestnut'];
const HAIR_STYLES = ['ponytail', 'bun'];
/** 裝備附件：零件的 regionJoint 對齊到 base 部件上的 at 點，骨頭原點在 base 的 origin 點。 */
const attachOn = (
  region: string,
  regionJoint: string,
  base: string,
  origin: string,
  at: string,
) => {
  const a = attach(region, regionJoint);
  const [dx, dy] = offset(base, origin, at);
  return { ...a, x: round(a.x + dx), y: round(a.y + dy) };
};
// 疊加裝備：每類一個插槽，選「無」就是不加這組 Skin。
const GEAR: Record<string, Record<string, Attachments>> = {
  headwear: {
    straw: { headwear: { headwear: attachOn('hatStraw', 'neck', 'head', 'neck', 'neck') } },
    crown: { headwear: { headwear: attachOn('hatCrown', 'seat', 'head', 'neck', 'bun') } },
  },
  cape: {
    crimson: { cape: { cape: attach('capeCrimson', 'top') } },
    midnight: { cape: { cape: attach('capeMidnight', 'top') } },
  },
  shoulders: Object.fromEntries(
    ['Iron', 'Hide'].map((kind) => [
      kind.toLowerCase(),
      perSide((side) => ({
        [`shoulder${side}`]: { [`shoulder${side}`]: attach(`pauldron${kind}${side}`, 'shoulder') },
      })),
    ]),
  ),
  armor: {
    lamellar: { armor: { armor: attachOn('lamellar', 'waist', torso, 'waist', 'waist') } },
  },
  robe: {
    // 長擺與腰裙都自帶腰帶，對齊軀幹的腰帶高度。
    teal: { robe: { robe: attachOn('hemTeal', 'top', torso, 'hipMid', 'waist') } },
    crimson: { robe: { robe: attachOn('hemCrimson', 'top', torso, 'hipMid', 'waist') } },
    tassets: { belt: { belt: attachOn('tassets', 'top', torso, 'hipMid', 'waist') } },
    apron: { belt: { belt: attachOn('apron', 'top', torso, 'hipMid', 'waist') } },
  },
  trinket: {
    gourd: { trinket: { trinket: attachOn('gourd', 'hook', torso, 'waist', 'belt') } },
    pendant: { trinket: { trinket: attachOn('pendant', 'hook', torso, 'waist', 'beltFront') } },
  },
};

const skins = [
  ...Object.entries(GEAR).flatMap(([category, items]) =>
    Object.entries(items).map(([id, attachments]) => skin(`gear/${category}/${id}`, attachments)),
  ),
  ...OUTFITS.map((id) =>
    skin(`outfit/${id}`, {
      torso: { torso: attach(id, 'waist') },
      ...perSide((side) => ({
        [`upper${side}`]: {
          [`upper${side}`]: attach(variant(`upper${side}`, id, 'ivory'), 'shoulder'),
        },
        [`fore${side}`]: { [`fore${side}`]: attach(variant(`fore${side}`, id, 'ivory'), 'elbow') },
      })),
    }),
  ),
  ...PANTS.map((id) =>
    skin(
      `pants/${id}`,
      perSide((side) => ({
        [`thigh${side}`]: { [`thigh${side}`]: attach(variant(`thigh${side}`, id, 'ink'), 'hip') },
        [`shin${side}`]: { [`shin${side}`]: attach(variant(`shin${side}`, id, 'ink'), 'knee') },
      })),
    ),
  ),
  ...BOOTS.map((id) =>
    skin(
      `boots/${id}`,
      perSide((side) => ({
        [`boot${side}`]: { [`boot${side}`]: attach(variant(`boot${side}`, id, 'brown'), 'ankle') },
      })),
    ),
  ),
  ...HAIR_COLORS.flatMap((color) =>
    HAIR_STYLES.map((style) =>
      skin(`hair/${color}/${style}`, {
        head: { head: attach(variant('head', color, 'brown'), 'neck') },
        // 盤髻只留頭上的髮髻，不掛馬尾。
        ...(style === 'ponytail'
          ? { hair: { hair: attach(variant('hair', color, 'brown'), 'root') } }
          : {}),
      }),
    ),
  ),
  ...['palm', 'grip', 'knuckle'].map((name) =>
    skin(
      `hands/${name}`,
      perSide((side) => ({
        [`hand${side}`]: { [`hand${side}`]: attach(`${name}${side}`, 'wrist') },
      })),
    ),
  ),
  ...['sword', 'saber', 'spear', 'fan', 'dart'].flatMap((name) =>
    sides.map((side) =>
      skin(`weapon/${name}/${side}`, {
        [`weapon${side}`]: {
          [`weapon${side}`]: attach(name, 'grip'),
          // 扇子另有展開的附件，由動作的附件軌道切換。
          ...(name === 'fan' ? { [`weapon${side}Open`]: attach('fanOpen', 'grip') } : {}),
        },
      }),
    ),
  ),
];

// 動作以「世界角度」撰寫：0 指向前方，90 朝上，-90 下垂。換算成各骨頭的相對旋轉。
const base = {
  upper: angle(offset('upperR', 'shoulder', 'elbow')),
  fore: angle(offset('foreR', 'elbow', 'wrist')),
  hand: angle(offset('palmR', 'wrist', 'center')),
  weapon: 90,
};
/** 上臂、前臂、手掌、兵刃的世界角度。 */
type Arm = [number, number, number, number?];
type Pose = {
  hip?: Point;
  torso?: number;
  head?: number;
  hair?: number;
  L?: Arm;
  R?: Arm;
  /** 骨頭的整數像素上下位移（y 向上），待機用來做不旋轉的呼吸層次。 */
  lift?: Record<string, number>;
};
// step：停在這格直到下一格，像素待機用，避免小角度連續旋轉讓像素閃爍。
type Ease = 'io' | 'snap' | 'in' | 'linear' | 'step';
type Key = { time: number; pose: Pose; ease?: Ease };
const EASE: Record<Exclude<Ease, 'step'>, [number, number, number, number]> = {
  io: [0.42, 0, 0.58, 1],
  snap: [0.1, 0.55, 0.3, 1],
  in: [0.5, 0, 0.9, 0.6],
  linear: [0.33, 0.33, 0.67, 0.67],
};
function locals(pose: Pose): Record<string, number> {
  const torsoRot = pose.torso ?? 0;
  const values: Record<string, number> = {};
  if (pose.torso !== undefined) values.torso = torsoRot;
  // 頭相對軀幹、馬尾相對頭，前傾時自然跟著走。
  if (pose.head !== undefined) values.head = pose.head;
  if (pose.hair !== undefined) values.hair = pose.hair;
  for (const side of ['L', 'R'] as const) {
    const arm = pose[side];
    if (!arm) continue;
    const [u, f, h, w] = arm;
    values[`upper${side}`] = u - base.upper - torsoRot;
    values[`fore${side}`] = f - base.fore - (u - base.upper);
    values[`hand${side}`] = h - base.hand - (f - base.fore);
    if (w !== undefined) values[`weapon${side}`] = w - base.weapon - (h - base.hand);
  }
  return values;
}
function curve(ease: Ease, t0: number, t1: number, v0: number, v1: number) {
  if (ease === 'step') return 'stepped';
  const [a, b, c, d] = EASE[ease];
  const dt = t1 - t0,
    dv = v1 - v0;
  return [t0 + dt * a, v0 + dv * b, t0 + dt * c, v0 + dv * d].map(round);
}
type SlotTimeline = Record<string, { attachment: { time: number; name: string | null }[] }>;
function animation(keys: Key[], slots?: SlotTimeline) {
  const rotations = keys.map((key) => locals(key.pose));
  const boneNames = new Set(rotations.flatMap((r) => Object.keys(r)));
  const bonesOut: Record<string, object> = {};
  for (const name of boneNames) {
    if (rotations.some((r) => r[name] === undefined)) {
      throw new Error(`動作關鍵格缺少 ${name}`);
    }
    bonesOut[name] = {
      rotate: keys.map((key, i) => ({
        time: round(key.time),
        value: round(rotations[i][name]),
        ...(i < keys.length - 1
          ? {
              curve: curve(
                key.ease ?? 'io',
                key.time,
                keys[i + 1].time,
                rotations[i][name],
                rotations[i + 1][name],
              ),
            }
          : {}),
      })),
    };
  }
  const shift = (name: string, pose: Pose): Point =>
    name === 'hip' ? (pose.hip ?? [0, 0]) : [0, pose.lift?.[name] ?? 0];
  const moved = new Set(keys.flatMap((key) => Object.keys(key.pose.lift ?? {})));
  if (keys.some((key) => key.pose.hip)) moved.add('hip');
  for (const name of moved) {
    bonesOut[name] = {
      ...(bonesOut[name] ?? {}),
      translate: keys.map((key, i) => {
        const [x, y] = shift(name, key.pose);
        const next = keys[i + 1];
        const [nx, ny] = next ? shift(name, next.pose) : [0, 0];
        const ease = key.ease ?? 'io';
        return {
          time: round(key.time),
          x,
          y,
          ...(next
            ? {
                curve:
                  ease === 'step'
                    ? 'stepped'
                    : [
                        ...curve(ease, key.time, next.time, x, nx),
                        ...curve(ease, key.time, next.time, y, ny),
                      ],
              }
            : {}),
        };
      }),
    };
  }
  return slots ? { bones: bonesOut, slots } : { bones: bonesOut };
}
const merge = (pose: Pose, change: Pose): Pose => ({ ...pose, ...change });

// 空手護身：遠側掌在前，近側手收在腰間。
const guard: Pose = {
  hip: [0, 0],
  torso: -3,
  head: 2,
  hair: -2,
  L: [-35, 15, 72],
  R: [-118, -8, 10],
};
// 像素待機：軀幹與手臂不轉，只做整數像素位移並逐格切換，
// 否則最近鄰取樣下每格都會重新排列像素，看起來像身上有波紋。
// 八格一循環：身體先沉，頭與雙肩慢一格才跟上（回升時同理），馬尾再慢半拍擺動，
// 各部位錯開時間，讓 1px 的起伏也有連貫的呼吸感。
const IDLE_STEP = 0.125; // 與 src/render/PixelHeroine.ts 的 IDLE_STEP 相同
const IDLE_FRAMES: { hip: number; follow: number; hair: number }[] = [
  { hip: 0, follow: 0, hair: 0 },
  { hip: -1, follow: 1, hair: 0 },
  { hip: -1, follow: 0, hair: -2 },
  { hip: -1, follow: 0, hair: -4 },
  { hip: -1, follow: 0, hair: -5 },
  { hip: 0, follow: -1, hair: -5 },
  { hip: 0, follow: 0, hair: -3 },
  { hip: 0, follow: 0, hair: -1 },
];
const breathing = (pose: Pose) => {
  const hair = pose.hair ?? 0;
  return animation([
    ...IDLE_FRAMES.map((frame, i) => ({
      time: i * IDLE_STEP,
      pose: merge(pose, {
        hip: [0, frame.hip],
        hair: hair + frame.hair,
        // follow 抵銷身體剛發生的位移，頭與肩膀因此晚一格才到位。
        lift: { head: frame.follow, upperL: frame.follow, upperR: frame.follow },
      }),
      ease: 'step' as Ease,
    })),
    {
      time: IDLE_FRAMES.length * IDLE_STEP,
      pose: merge(pose, { lift: { head: 0, upperL: 0, upperR: 0 } }),
    },
  ]);
};
const idle = breathing(guard);

const pushed = (palms: Array<'L' | 'R'>): Key[] => {
  const coil: Pose = { hip: [-4, -2], torso: 6, head: -2, hair: -8 };
  const deep: Pose = { hip: [-5, -3], torso: 8, head: -3, hair: -12 };
  const strike: Pose = { hip: [8, -5], torso: -10, head: 0, hair: 8 };
  const hold: Pose = { hip: [7, -5], torso: -9, head: 0, hair: 22 };
  const settle: Pose = { hip: [3, -2], torso: -5, head: 1, hair: 10 };
  const arms = (a: Arm, b: Arm) =>
    Object.fromEntries(palms.map((side) => [side, side === 'L' ? a : b]));
  return [
    { time: 0, pose: palms.length === 2 ? guard : { ...guard, R: undefined } },
    { time: 0.25, pose: { ...coil, ...arms([-112, -2, 55], [-120, -4, 50]) } },
    // 蓄力到出掌這段用快速曲線，力道集中在前幾格。
    { time: 0.5, pose: { ...deep, ...arms([-122, -6, 62], [-128, -8, 58]) }, ease: 'snap' },
    { time: 0.62, pose: { ...strike, ...arms([-6, 0, 90], [-12, -4, 88]) } },
    { time: 0.88, pose: { ...hold, ...arms([-4, 2, 92], [-10, -2, 90]) } },
    { time: 1.2, pose: { ...settle, ...arms([-20, 8, 82], [-60, -6, 40]) } },
    { time: 1.6, pose: palms.length === 2 ? guard : { ...guard, R: undefined } },
  ];
};

// 持刃護身：持刀手在前、刃尖斜上，另一手捏劍指。
const armedGuard = (side: 'L' | 'R'): Pose =>
  side === 'R'
    ? { hip: [0, 0], torso: -3, head: 2, hair: -2, R: [-68, 5, 5, 38], L: [-42, 28, 78] }
    : { hip: [0, 0], torso: -3, head: 2, hair: -2, L: [-52, 8, 8, 42] };
const armedIdle = (side: 'L' | 'R') => breathing(armedGuard(side));
const slash = (side: 'L' | 'R') => {
  const other = side === 'R' ? 'L' : undefined;
  const g = armedGuard(side);
  const k = (hip: Point, torsoRot: number, hair: number, arm: Arm, off?: Arm): Pose => ({
    hip,
    torso: torsoRot,
    head: -torsoRot / 3,
    hair,
    [side]: arm,
    ...(other && off ? { [other]: off } : {}),
  });
  const offGuard = g.L && side === 'R' ? g.L : undefined;
  // 引刃過肩、由腰帶動斜劈、收回護身。
  return animation([
    { time: 0, pose: g },
    { time: 0.22, pose: k([-3, -1], 6, -6, [55, 115, 115, 150], [-25, 40, 80]) },
    { time: 0.45, pose: k([-5, -3], 10, -12, [92, 150, 150, 178], [-20, 45, 85]), ease: 'snap' },
    { time: 0.56, pose: k([9, -5], -10, 6, [18, -2, -2, -8], [-105, -70, -60]) },
    { time: 0.72, pose: k([10, -5], -12, 20, [-42, -58, -58, -72], [-108, -75, -65]) },
    { time: 1.04, pose: k([4, -2], -5, 10, [-62, -8, -8, 18], [-70, 0, 40]) },
    { time: 1.6, pose: { ...g, ...(offGuard ? { L: offGuard } : {}) } },
  ]);
};

const walkTimes = [0, 0.2, 0.4, 0.6, 0.8];
const swing = (a: number) => [a, 0, -a, 0, a];
const walk = (
  armed?: 'L' | 'R',
  hold: (s: number) => Arm = (s) => [-72 + s / 6, -20, -20, 28 + s / 4],
) =>
  animation(
    walkTimes.map((time, i) => {
      const s = swing(18)[i];
      const pose: Pose = { torso: -4, head: 2, hair: [-4, 6, -4, 6, -4][i] };
      // 左腳在 0 秒最前，手臂與腳交錯擺動。
      if (armed !== 'L') pose.L = [-85 - s, -60 - s, -60 - s];
      if (!armed) pose.R = [-85 + s, -60 + s, -60 + s];
      if (armed) {
        pose[armed] = hold(s);
      }
      return { time, pose, ease: 'linear' as Ease };
    }),
  );

// ---- 其他兵器：每種各有待機、步行與攻擊，失能時改用左手版本 ----

/** 持物手的節拍：另一隻手若是健全的左手，跟著配合。 */
type Beat = {
  time: number;
  hip: Point;
  torso: number;
  hair: number;
  arm: Arm;
  off?: Arm;
  ease?: Ease;
};
const sequence = (side: 'L' | 'R', guardPose: Pose, beats: Beat[]): Key[] => [
  { time: 0, pose: guardPose, ease: beats[0]?.time === 0 ? beats[0].ease : undefined },
  ...beats
    .filter((beat) => beat.time > 0)
    .map(({ time, hip, torso: t, hair, arm, off, ease }) => ({
      time,
      ease,
      pose: {
        hip,
        torso: t,
        head: -t / 3,
        hair,
        [side]: arm,
        ...(side === 'R' && (off ?? guardPose.L) ? { L: off ?? guardPose.L } : {}),
      } as Pose,
    })),
];
const closing = (pose: Pose, time: number): Key => ({ time, pose });
const stance = (side: 'L' | 'R', arm: Arm, off: Arm = [-45, 20, 70]): Pose => ({
  hip: [0, 0],
  torso: -4,
  head: 2,
  hair: -2,
  [side]: arm,
  ...(side === 'R' ? { L: off } : {}),
});
const swap = (side: 'L' | 'R', times: [number, string | null][]): SlotTimeline => ({
  [`weapon${side}`]: {
    attachment: times.map(([time, name]) => ({
      time,
      name: name === null ? null : `weapon${side}${name}`,
    })),
  },
});

// 長槍：雙手持握，後手（近側右手）推送，前手由 IK 扶在槍桿上。
const spearGuard = (side: 'L' | 'R') =>
  stance(side, side === 'R' ? [-112, -12, -12, 14] : [-62, 8, 8, 20], [-40, 5, 5]);
const thrust = (side: 'L' | 'R') => {
  const g = spearGuard(side);
  return animation([
    ...sequence(side, g, [
      { time: 0.2, hip: [-4, -1], torso: 5, hair: -6, arm: [-128, -35, -35, 10], ease: 'snap' },
      { time: 0.38, hip: [11, -5], torso: -12, hair: 8, arm: [-55, 2, 2, 2] },
      { time: 0.6, hip: [11, -5], torso: -11, hair: 20, arm: [-52, 4, 4, 4] },
      { time: 0.9, hip: [4, -2], torso: -6, hair: 10, arm: [-95, -8, -8, 10] },
    ]),
    closing(g, 1.3),
  ]);
};

// 摺扇：收扇護身，揚手時展開，橫掃後收回。
const fanGuard = (side: 'L' | 'R') => stance(side, [-75, 35, 55, 75], [-55, 0, 35]);
const fanSweep = (side: 'L' | 'R') => {
  const g = fanGuard(side);
  return animation(
    [
      ...sequence(side, g, [
        {
          time: 0.22,
          hip: [-3, -1],
          torso: 6,
          hair: -6,
          arm: [70, 140, 140, 150],
          off: [-60, 10, 40],
          ease: 'snap',
        },
        {
          time: 0.45,
          hip: [8, -4],
          torso: -10,
          hair: 10,
          arm: [5, -10, -10, -5],
          off: [-95, -40, -30],
        },
        {
          time: 0.7,
          hip: [9, -4],
          torso: -12,
          hair: 22,
          arm: [-40, -50, -50, -60],
          off: [-95, -40, -30],
        },
        { time: 1.0, hip: [3, -1], torso: -5, hair: 8, arm: [-70, 20, 40, 60], off: [-60, 0, 30] },
      ]),
      closing(g, 1.4),
    ],
    swap(side, [
      [0, ''],
      [0.3, 'Open'],
      [0.95, ''],
    ]),
  );
};

// 飛鏢：過肩引手，甩臂出手後手中的鏢消失，收勢時再補一支。
const dartGuard = (side: 'L' | 'R') => stance(side, [-100, -35, -35, 70]);
const dartThrow = (side: 'L' | 'R') => {
  const g = dartGuard(side);
  return animation(
    [
      ...sequence(side, g, [
        {
          time: 0.22,
          hip: [-4, -2],
          torso: 8,
          hair: -8,
          arm: [110, 165, 165, 175],
          off: [-20, 30, 60],
          ease: 'snap',
        },
        {
          time: 0.4,
          hip: [8, -4],
          torso: -10,
          hair: 8,
          arm: [5, -5, -5, 0],
          off: [-100, -60, -60],
        },
        {
          time: 0.6,
          hip: [8, -4],
          torso: -11,
          hair: 18,
          arm: [-40, -45, -45, -45],
          off: [-100, -60, -60],
        },
      ]),
      closing(g, 1.2),
    ],
    swap(side, [
      [0, ''],
      [0.4, null],
      [0.95, ''],
    ]),
  );
};

// 拳套：雙拳護頭，前手刺拳、後手直拳。右手失能時改左手連續刺拳。
const fistGuard: Pose = {
  hip: [0, -1],
  torso: -5,
  head: 2,
  hair: -2,
  L: [-30, 60, 60],
  R: [-115, 55, 55],
};
const punches = (both: boolean) => {
  const g = both ? fistGuard : { ...fistGuard, R: undefined };
  const rear = (arm: Arm) => (both ? { R: arm } : {});
  return animation([
    { time: 0, pose: g, ease: 'snap' },
    {
      time: 0.12,
      pose: { hip: [4, -2], torso: -7, head: 2, hair: 4, L: [-5, 0, 0], ...rear([-115, 55, 55]) },
    },
    {
      time: 0.28,
      pose: {
        hip: [2, -1],
        torso: -4,
        head: 2,
        hair: 8,
        L: [-30, 60, 60],
        ...rear([-115, 55, 55]),
      },
      ease: 'snap',
    },
    both
      ? {
          time: 0.45,
          pose: { hip: [15, -6], torso: -18, head: 4, hair: 12, L: [-60, 70, 70], R: [-4, -2, -2] },
        }
      : { time: 0.45, pose: { hip: [7, -4], torso: -9, head: 3, hair: 12, L: [-3, 2, 2] } },
    both
      ? {
          time: 0.7,
          pose: { hip: [15, -6], torso: -17, head: 4, hair: 20, L: [-60, 70, 70], R: [-6, 0, 0] },
        }
      : { time: 0.7, pose: { hip: [7, -4], torso: -9, head: 3, hair: 20, L: [-5, 4, 4] } },
    { time: 1.3, pose: g },
  ]);
};

const perHand = <T>(make: (side: 'L' | 'R') => T, prefix: string) =>
  Object.fromEntries(sides.map((side) => [`${prefix}${side}`, make(side)]));

const animations = {
  ...perHand((side) => breathing(spearGuard(side)), 'idleSpear'),
  ...perHand(
    (side) =>
      walk(side, (s) => (side === 'R' ? [-108 + s / 8, -12, -12, 22] : [-62 + s / 8, 8, 8, 24])),
    'walkSpear',
  ),
  ...perHand(thrust, 'thrust'),
  ...perHand((side) => breathing(fanGuard(side)), 'idleFan'),
  ...perHand((side) => walk(side, (s) => [-78 + s / 6, 30, 50, 70]), 'walkFan'),
  ...perHand(fanSweep, 'fan'),
  ...perHand((side) => breathing(dartGuard(side)), 'idleDart'),
  ...perHand((side) => walk(side, (s) => [-100 + s / 6, -35, -35, 70]), 'walkDart'),
  ...perHand(dartThrow, 'throw'),
  idleFist: breathing(fistGuard),
  punchBoth: punches(true),
  punchL: punches(false),
  idle,
  walk: walk(),
  palmBoth: animation(pushed(['L', 'R'])),
  palmL: animation(pushed(['L'])),
  idleArmedR: armedIdle('R'),
  idleArmedL: armedIdle('L'),
  walkArmedR: walk('R'),
  walkArmedL: walk('L'),
  slashR: slash('R'),
  slashL: slash('L'),
  // 傷手覆蓋軌道：右臂自然下垂，只鍵右臂，疊在任何動作上。
  injuredR: animation([{ time: 0, pose: { R: [-96, -98, -98] } }]),
  hurt: animation([
    { time: 0, pose: { hip: [0, 0], torso: 0, head: 0, hair: 0 } },
    { time: 0.1, pose: { hip: [-4, 0], torso: 12, head: 6, hair: -10 }, ease: 'snap' },
    { time: 0.3, pose: { hip: [-3, 0], torso: 6, head: 3, hair: 8 } },
    { time: 0.5, pose: { hip: [0, 0], torso: 0, head: 0, hair: 0 } },
  ]),
};

const skeleton = {
  skeleton: { spine: '4.3.26', fps: 24, images: '../images/' },
  bones,
  slots: slotBones.map(([name, boneName]) => ({ name, bone: boneName, attachment: name })),
  skins,
  animations,
};
const json = JSON.stringify(skeleton, null, 2) + '\n';
writeFileSync(`${root}/spine/pixel-heroine-source.json`, json);
writeFileSync(`${out}/pixel-heroine.json`, json);
console.log('Built pixel heroine skeleton from measured rig points.');
