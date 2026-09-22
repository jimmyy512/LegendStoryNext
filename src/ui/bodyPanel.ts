import {
  BODY_PARTS,
  PART_CAPACITY,
  PART_NAMES,
  bodyCondition,
  type BodyPart,
  type BodyState,
} from '../game/body';

export function bodyPanel(body: BodyState, selected?: BodyPart): string {
  return `<div class="body-parts" aria-label="${selected ? '攻擊部位' : '我的傷勢'}">${BODY_PARTS.map(
    (part) => {
      const content = `<span>${PART_NAMES[part]}</span><small>${bodyCondition(body, part)} ${body[part]}/${PART_CAPACITY[part]}</small>`;
      const className = `body-part ${body[part] === 0 ? 'disabled-limb' : ''} ${part === selected ? 'selected' : ''}`;
      return selected
        ? `<button class="${className}" data-action="body:${part}" aria-pressed="${part === selected}">${content}</button>`
        : `<div class="${className}">${content}</div>`;
    },
  ).join('')}</div>`;
}
