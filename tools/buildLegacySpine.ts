import { readFileSync, writeFileSync } from 'node:fs';
import { migrateLegacyHero, type ConvertedSkeleton } from './legacySpine.ts';

const directory = 'art/characters/legacyHero/';
const read = (name: string) =>
  JSON.parse(readFileSync(`${directory}converted/${name}`, 'utf8')) as ConvertedSkeleton;
const result = migrateLegacyHero(
  read('character_MainCharacter.json'),
  read('character_普通扎眼.json'),
);
writeFileSync(`${directory}spine/legacy-source.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `Prepared ${result.bones.length} bones, ${result.slots.length} slots and ${Object.keys(result.animations).length} animations. Original files unchanged.`,
);
