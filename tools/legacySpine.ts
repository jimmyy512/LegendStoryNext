export interface Keyframe {
  time?: number;
  angle?: number;
  value?: number;
  x?: number;
  y?: number;
  curve?: number[] | 'stepped';
}

interface Bone {
  name: string;
  parent?: string;
  rotation?: number;
  [key: string]: unknown;
}

interface Slot {
  name: string;
  bone: string;
  attachment?: string;
  [key: string]: unknown;
}

interface Attachment {
  name?: string;
  path?: string;
  width: number;
  height: number;
  [key: string]: unknown;
}

interface Animation {
  bones?: Record<string, Record<string, Keyframe[]>>;
  [key: string]: unknown;
}

export interface ConvertedSkeleton {
  skeleton: { spine: string; fps: number; images?: string; [key: string]: unknown };
  bones: Bone[];
  slots: Slot[];
  skins: Record<string, Record<string, Record<string, Attachment>>>;
  animations: Record<string, Animation>;
}

export const LEGACY_ANIMATIONS = ['Idle', 'Run', 'NormalAttack1', 'NormalAttack2', 'NormalAttack3'];

/** 3.6 的曲線是 0..1 比例，4.3 要求每個通道各自的時間／數值座標。 */
export function convertBoneTimeline(type: string, source: Keyframe[]): Keyframe[] {
  if (!['rotate', 'translate', 'scale', 'shear'].includes(type)) {
    throw new Error(`尚未支援時間軸：${type}`);
  }
  const frames = structuredClone(source);
  if (type === 'rotate') {
    for (const frame of frames) {
      frame.value = frame.angle ?? 0;
      delete frame.angle;
    }
  }
  const channels: Array<'value' | 'x' | 'y'> = type === 'rotate' ? ['value'] : ['x', 'y'];
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    if (!Array.isArray(frame.curve)) {
      continue;
    }
    if (frame.curve.length !== 4 || !frame.curve.every(Number.isFinite)) {
      throw new Error('舊曲線必須包含四個有限數值');
    }
    const next = frames[index + 1];
    if (!next) {
      delete frame.curve;
      continue;
    }
    const [cx1, cy1, cx2, cy2] = frame.curve;
    const time = frame.time ?? 0;
    const duration = (next.time ?? 0) - time;
    if (duration <= 0) {
      throw new Error('曲線時間必須遞增');
    }
    const fallback = type === 'scale' ? 1 : 0;
    frame.curve = channels.flatMap((channel) => {
      const start = frame[channel] ?? fallback;
      const delta = (next[channel] ?? fallback) - start;
      return [
        time + cx1 * duration,
        start + cy1 * delta,
        time + cx2 * duration,
        start + cy2 * delta,
      ];
    });
  }
  return frames;
}

/** 此轉換器只承接本專案官方工具的 3.6 輸出，不是通用 DragonBones 轉換器。 */
export function migrateLegacyHero(input: ConvertedSkeleton, faceInput: ConvertedSkeleton) {
  if (input.skeleton.spine !== '3.6.0' || faceInput.skeleton.spine !== '3.6.0') {
    throw new Error('請先使用鎖定版本的 dragonbones-tools 產生 Spine 3.6 中間檔');
  }
  const data = structuredClone(input);
  const face = structuredClone(faceInput);
  const attachments = data.skins.default;
  // 第一批沒有技能特效。未驗證的龍身網格不混進可播放樣板，完整資料仍在 converted/。
  const deferredSlots = [
    '前龍爪',
    '後龍爪',
    '龍身',
    'skillEffect',
    'skillEffect1',
    'skillEffect11',
    'Effect_BlueWave',
    'Effect_fire1',
    'Effect_fire2',
    'Effect_fire3',
  ];
  data.slots = data.slots.filter((slot) => !deferredSlots.includes(slot.name));
  for (const slot of deferredSlots) {
    delete attachments[slot];
  }
  const facialIndex = data.slots.findIndex((slot) => slot.name === 'Facial');
  if (facialIndex < 0 || !data.bones.some((bone) => bone.name === 'Facial')) {
    throw new Error('找不到主角臉部插槽／骨頭');
  }
  for (const bone of face.bones) {
    const root = !bone.parent;
    bone.parent = root ? 'Facial' : `face/${bone.parent}`;
    bone.name = `face/${bone.name}`;
    if (root) {
      bone.rotation = (bone.rotation ?? 0) - 90;
    }
    data.bones.push(bone);
  }
  const faceSlots = face.slots.map((slot) => ({
    ...slot,
    name: `face/${slot.name}`,
    bone: `face/${slot.bone}`,
  }));
  data.slots.splice(facialIndex, 1, ...faceSlots);
  for (const [slot, images] of Object.entries(face.skins.default)) {
    attachments[`face/${slot}`] = images;
  }
  // 原稿預設穿血衣。預覽先用全真衣，原始資料仍完整保留在 source/converted。
  for (const slot of data.slots) {
    const options = attachments[slot.name];
    const clothing = Object.keys(options ?? {}).find((name) => name.startsWith('1'));
    if (clothing) {
      slot.attachment = clothing;
    }
    if (slot.name === 'Weapon') {
      slot.attachment = 'Sword';
    }
    if (slot.name === 'Hair') {
      slot.attachment = 'Hair1';
    }
  }
  const animations: Record<string, Animation> = {};
  for (const name of LEGACY_ANIMATIONS) {
    const animation = data.animations[name];
    if (!animation || Object.keys(animation).some((key) => key !== 'bones')) {
      throw new Error(`${name} 出現尚未處理的動畫區段`);
    }
    const bones: Record<string, Record<string, Keyframe[]>> = {};
    for (const [bone, timelines] of Object.entries(animation.bones ?? {})) {
      bones[bone] = Object.fromEntries(
        Object.entries(timelines).map(([type, frames]) => [
          type,
          convertBoneTimeline(type, frames),
        ]),
      );
    }
    animations[name] = { bones };
  }
  const blink = face.animations.newAnimation.slots as Record<string, unknown>;
  animations.Blink = {
    slots: Object.fromEntries(
      Object.entries(blink).map(([name, timeline]) => [`face/${name}`, timeline]),
    ),
  };
  return {
    skeleton: { ...data.skeleton, spine: '4.3.26', images: '../images/' },
    bones: data.bones,
    slots: data.slots,
    skins: [{ name: 'default', attachments }],
    animations,
  };
}
