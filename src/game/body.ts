export const BODY_PARTS = [
  'head',
  'chest',
  'abdomen',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];
export type BodyState = Record<BodyPart, number>;
export type Mobility = 'standing' | 'limping' | 'crawling' | 'seated';
export interface LimbRequirement {
  hands: 0 | 1 | 2;
  legs: 0 | 1 | 2;
}

export const PART_NAMES: Record<BodyPart, string> = {
  head: '頭部',
  chest: '胸部',
  abdomen: '腹部',
  leftArm: '左手',
  rightArm: '右手',
  leftLeg: '左腿',
  rightLeg: '右腿',
};
export const PART_CAPACITY: BodyState = {
  head: 45,
  chest: 100,
  abdomen: 75,
  leftArm: 32,
  rightArm: 32,
  leftLeg: 40,
  rightLeg: 40,
};

export function createBody(): BodyState {
  return { ...PART_CAPACITY };
}

export function workingHands(body: BodyState): number {
  return Number(body.leftArm > 0) + Number(body.rightArm > 0);
}

export function workingLegs(body: BodyState): number {
  return Number(body.leftLeg > 0) + Number(body.rightLeg > 0);
}

/** 單手招式可換到另一隻手，不因慣用手受傷額外減傷。 */
export function limbPower(body: BodyState, requirement: LimbRequirement): number {
  const hands = requirement.hands ? Math.min(1, workingHands(body) / requirement.hands) : 1;
  const legs = requirement.legs ? Math.min(1, workingLegs(body) / requirement.legs) : 1;
  return hands * legs;
}

export function mobility(body: BodyState, moving = false): Mobility {
  const legs = workingLegs(body);
  if (legs === 2) {
    return 'standing';
  }
  if (legs === 1) {
    return 'limping';
  }
  return moving && workingHands(body) > 0 ? 'crawling' : 'seated';
}

export function movementRate(body: BodyState): number {
  const legs = workingLegs(body);
  return legs === 2 ? 1 : legs === 1 ? 0.55 : workingHands(body) > 0 ? 0.2 : 0;
}

/** 部位耐久獨立於總生命。生命藥不會令已失能的肢體重新活動。 */
export function damagePart(body: BodyState, part: BodyPart, damage: number): boolean {
  const before = body[part];
  body[part] = Math.max(0, before - Math.max(0, Math.round(damage)));
  return before > 0 && body[part] === 0;
}

export function bodyCondition(body: BodyState, part: BodyPart): string {
  if (body[part] === 0) {
    return part === 'head' || part === 'chest' || part === 'abdomen' ? '重傷' : '失能';
  }
  return body[part] < PART_CAPACITY[part] ? '受傷' : '完好';
}
