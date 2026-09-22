import { writeFileSync } from 'node:fs';

const root = 'art/styleComparison/';
const parts = [
  { name: 'head', bounds: [0, 0, 420, 440], size: [112, 118] },
  { name: 'torso', bounds: [466, 0, 360, 440], size: [78, 96] },
  { name: 'hair', bounds: [843, 0, 411, 443], size: [108, 116] },
  { name: 'upperBack', bounds: [126, 447, 186, 351], size: [32, 60] },
  { name: 'upperFront', bounds: [550, 447, 204, 351], size: [35, 60] },
  { name: 'palmBack', bounds: [937, 439, 217, 365], size: [35, 60] },
  { name: 'palmFront', bounds: [94, 809, 198, 439], size: [34, 75] },
  { name: 'legBack', bounds: [497, 800, 280, 454], size: [51, 84] },
  { name: 'legFront', bounds: [928, 800, 326, 454], size: [60, 84] },
];
writeFileSync(
  `${root}source/parts.atlas`,
  [
    'heroine-parts-v1.png',
    'size: 1254,1254',
    'format: RGBA8888',
    'filter: Linear,Linear',
    'repeat: none',
    ...parts.flatMap(({ name, bounds: [x, y, width, height] }) => [
      name,
      '  rotate: false',
      `  xy: ${x}, ${y}`,
      `  size: ${width}, ${height}`,
      `  orig: ${width}, ${height}`,
      '  offset: 0, 0',
      '  index: -1',
    ]),
    '',
  ].join('\n'),
);

const bones = [
  { name: 'root' },
  { name: 'hip', parent: 'root', y: 83 },
  { name: 'legBack', parent: 'hip', x: -14, rotation: -12 },
  { name: 'legFront', parent: 'hip', x: 15, rotation: 12 },
  { name: 'torso', parent: 'hip', y: -4 },
  { name: 'head', parent: 'torso', x: 0, y: 91 },
  { name: 'hair', parent: 'head', x: -28, y: 72, rotation: -18 },
  { name: 'upperBack', parent: 'torso', x: 19, y: 73, rotation: 20 },
  { name: 'palmBack', parent: 'upperBack', y: -47, rotation: 35 },
  { name: 'upperFront', parent: 'torso', x: -22, y: 73, rotation: 5 },
  { name: 'palmFront', parent: 'upperFront', y: -47, rotation: 25 },
];
const order = [
  'hair',
  'upperBack',
  'palmBack',
  'legBack',
  'legFront',
  'torso',
  'head',
  'upperFront',
  'palmFront',
];
const attachments = Object.fromEntries(
  parts.map(({ name, bounds, size: [width, height] }) => [
    name,
    {
      [name]: {
        width: bounds[2],
        height: bounds[3],
        scaleX: width / bounds[2],
        scaleY: height / bounds[3],
        x: 0,
        y: name === 'head' ? height * 0.42 : name === 'torso' ? height * 0.42 : -height * 0.42,
      },
    },
  ]),
);
const rotate = (values: number[]) =>
  [0, 0.4, 0.78, 0.96, 1.32, 1.65, 2.1, 2.8].map((time, index) => ({ time, value: values[index] }));
const skeleton = {
  skeleton: { spine: '4.3.26', fps: 30, images: '../images/' },
  bones,
  slots: order.map((name) => ({ name, bone: name, attachment: name })),
  skins: [{ name: 'default', attachments }],
  animations: {
    dragonPalm: {
      bones: {
        hip: {
          translate: [
            { x: 0, y: 0 },
            { time: 0.4, y: -3 },
            { time: 0.78, y: -9 },
            { time: 0.96, y: -4 },
            { time: 1.65, y: -4 },
            { time: 2.1, y: 0 },
            { time: 2.8, y: 0 },
          ],
        },
        torso: { rotate: rotate([0, -5, -11, 8, 6, 5, 0, 0]) },
        head: { rotate: rotate([0, 3, 7, -7, -5, -4, 0, 0]) },
        hair: { rotate: rotate([0, -3, -8, 28, 34, 22, -4, 0]) },
        upperBack: { rotate: rotate([0, -40, -55, 67, 62, 65, 0, 0]) },
        palmBack: { rotate: rotate([0, 50, 45, -32, -35, -35, 0, 0]) },
        upperFront: { rotate: rotate([0, -30, -48, 78, 73, 76, 0, 0]) },
        palmFront: { rotate: rotate([0, 50, 50, -18, -23, -23, 0, 0]) },
        legBack: { rotate: rotate([0, 2, 6, -3, -3, -3, 0, 0]) },
        legFront: { rotate: rotate([0, -2, -5, 3, 3, 3, 0, 0]) },
      },
    },
  },
};
writeFileSync(`${root}spine/heroine-source.json`, `${JSON.stringify(skeleton, null, 2)}\n`);
console.log('Prepared heroine cutout atlas and Spine animation.');
