import type { MapEntity } from '../game/types';
import { escapeHtml, portrait } from './html';

const OBJECT_ART = {
  chest:
    '<path d="M34 94h112v66H34Z" fill="#795d3c"/><path d="M34 94q0-30 28-30h56q28 0 28 30Z" fill="#96764a"/><path d="M34 105h112M53 70v90m74-90v90" stroke="#c9b783" stroke-width="6"/><rect x="82" y="98" width="16" height="24" rx="3" fill="#d4c495"/><circle cx="90" cy="108" r="3" fill="#354b40"/>',
  journal:
    '<path d="m49 49 87 9-10 117-87-9Z" fill="#d9cfaa" stroke="#a99362" stroke-width="3"/><path d="m59 66 61 6m-63 11 57 6m-59 11 53 5m-55 12 59 6m-61 11 43 4" stroke="#7c795d" stroke-width="3"/><path d="m121 155 6 20-23-2" fill="#a99362"/>',
  flower:
    '<path d="M91 164q-9-37 1-74m-1 54q-35-2-43-28 34-3 43 28m0-14q34-9 42-32-34 1-42 32" fill="#729b78" stroke="#a4b795" stroke-width="3"/><path d="M93 95q-31-9-22-30 18-9 23 19-3-35 18-29 19 17-9 34 28-15 32 5-6 23-32 4-3 29-21 19-10-18 11-22Z" fill="#a7c7ce"/><circle cx="96" cy="92" r="7" fill="#e2cf91"/>',
  wine: '<path d="M75 56h30v33q27 15 25 50-2 32-40 32t-40-32q-2-35 25-50Z" fill="#9e7650" stroke="#cbb78b" stroke-width="3"/><path d="M72 57h36v14H72Z" fill="#c9b28a"/><path d="m73 79 34 2-3 17-35-3Z" fill="#904c3d"/><path d="m72 104 38 3-3 41-38-3Z" fill="#ded1a9"/><text x="88" y="135" text-anchor="middle" font-size="25" fill="#66553c">酒</text>',
  clue: '<path d="M44 65h92v95H44Z" fill="#d9cfaa"/><path d="M60 83h60m-60 18h48m-48 18h57m-57 18h32" stroke="#7c795d" stroke-width="3"/>',
};

export function dialoguePortrait(entity: MapEntity): string {
  if (entity.kind === 'npc' || entity.kind === 'enemy') {
    return portrait('#91a593', 'npc');
  }
  let art = OBJECT_ART.clue;
  if (entity.kind === 'chest') {
    art = OBJECT_ART.chest;
  } else if (entity.id === 'wine') {
    art = OBJECT_ART.wine;
  } else if (entity.kind === 'herb') {
    art = OBJECT_ART.flower;
  } else if (entity.id === 'journal') {
    art = OBJECT_ART.journal;
  }
  return `<svg viewBox="0 0 180 220" role="img" aria-label="${escapeHtml(entity.name)}" class="portrait-art object-portrait"><rect width="180" height="220" fill="#294239"/><circle cx="90" cy="110" r="71" fill="#344d41" stroke="#b5a272" stroke-opacity=".4"/><ellipse cx="90" cy="178" rx="53" ry="8" fill="#172d26" opacity=".4"/>${art}</svg>`;
}
