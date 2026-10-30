/*
 * Canvas 2D Mahjong renderer using the I.Mahjong-HK font for every tile face.
 * Font: I.Font Project / SyaoranHinata, M+ Fonts License.
 * Color layers are rendered independently with Canvas clipping regions.
 */

import { LAYER_COLORS, getTileSegmentation } from './tile-segmentation.js';

export const TILE_GROUPS = [
  { name: '风牌 · 三元', code: 'HONORS', tiles: [
    ['wind-east', '东风'], ['wind-south', '南风'], ['wind-west', '西风'], ['wind-north', '北风'],
    ['dragon-red', '红中'], ['dragon-green', '发财'], ['dragon-white', '白板'],
  ]},
  { name: '花牌', code: 'FLOWERS', tiles: [
    ['flower-spring', '春 · 1'], ['flower-summer', '夏 · 2'], ['flower-autumn', '秋 · 3'], ['flower-winter', '冬 · 4'],
    ['flower-plum', '梅 · 1'], ['flower-orchid', '兰 · 2'], ['flower-bamboo', '竹 · 4'], ['flower-chrysanthemum', '菊 · 3'],
  ]},
  { name: '条子', code: 'BAMBOO', tiles: Array.from({ length: 9 }, (_, i) => [`bamboo-${i + 1}`, `${i + 1}条`]) },
  { name: '筒子', code: 'DOTS', tiles: Array.from({ length: 9 }, (_, i) => [`dot-${i + 1}`, `${i + 1}筒`]) },
  { name: '万子', code: 'CHARACTERS', tiles: Array.from({ length: 9 }, (_, i) => [`wan-${i + 1}`, `${i + 1}万`]) },
];

export const TILE_LABELS = Object.fromEntries(TILE_GROUPS.flatMap(group => group.tiles));

const DESIGN_W = 120;
const DESIGN_H = 160;

const FACE_ALIGNMENT = {
  'dragon-white': { x: -.2, y: .2 },
};

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function seedFrom(text) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawTileBody(ctx, id, shadow) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(9, 24, 18, .32)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;
  }
  roundedRect(ctx, 5, 7, 110, 147, 10);
  const side = ctx.createLinearGradient(0, 10, 0, 154);
  side.addColorStop(0, '#e4d8b7');
  side.addColorStop(1, '#cbbb94');
  ctx.fillStyle = side;
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, 4, 2, 110, 146, 10);
  const face = ctx.createLinearGradient(12, 0, 105, 150);
  face.addColorStop(0, '#fffef2');
  face.addColorStop(.46, '#faf6e4');
  face.addColorStop(1, '#eee3c4');
  ctx.fillStyle = face;
  ctx.fill();
  ctx.strokeStyle = 'rgba(133, 115, 77, .34)';
  ctx.lineWidth = .9;
  ctx.stroke();

  ctx.save();
  roundedRect(ctx, 5, 3, 108, 144, 9);
  ctx.clip();
  const glow = ctx.createRadialGradient(28, 20, 0, 28, 20, 105);
  glow.addColorStop(0, 'rgba(255,255,255,.48)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(4, 2, 110, 146);
  const random = seedFrom(id);
  for (let i = 0; i < 74; i++) {
    const x = 8 + random() * 102;
    const y = 7 + random() * 135;
    const r = .12 + random() * .38;
    ctx.fillStyle = `rgba(104, 85, 48, ${.018 + random() * .025})`;
    ctx.beginPath();ctx.arc(x, y, r, 0, Math.PI * 2);ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();ctx.moveTo(15, 5);ctx.quadraticCurveTo(58, 1, 103, 5);
  ctx.strokeStyle = 'rgba(255,255,255,.72)';ctx.lineWidth = 1.2;ctx.stroke();
}

function drawSegmentedFace(ctx, id) {
  const { layers } = getTileSegmentation(id);
  const alignment = FACE_ALIGNMENT[id];
  ctx.save();
  if (alignment) ctx.translate(alignment.x, alignment.y);
  layers.forEach(layer => {
    if (layer.canvas) {
      ctx.drawImage(layer.canvas, 0, 0, DESIGN_W, DESIGN_H);
      return;
    }
    const color = LAYER_COLORS[layer.color];
    const paint = (path, fillRule) => {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // A dark groove edge behind the fill, then a slightly dilated colored
      // fill. This survives the downscale to a 40–50px tile much better than
      // the raw hairline contours.
      ctx.strokeStyle = 'rgba(5, 8, 7, .72)';
      ctx.lineWidth = 2.6;
      ctx.stroke(path);
      ctx.fillStyle = color;
      ctx.fill(path, fillRule);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.15;
      ctx.stroke(path);
      ctx.restore();
    };
    layer.paths.forEach(({ path, clip, fillRule = 'nonzero' }) => {
      if (!clip) {
        paint(path, fillRule);
        return;
      }
      ctx.save();
      ctx.beginPath();
      if (clip.path) {
        ctx.clip(clip.path);
      } else if (clip.axis === 'y') {
        ctx.rect(0, clip.min * DESIGN_H, DESIGN_W, (clip.max - clip.min) * DESIGN_H);
      } else {
        ctx.rect(clip.min * DESIGN_W, 0, (clip.max - clip.min) * DESIGN_W, DESIGN_H);
      }
      if (!clip.path) ctx.clip();
      paint(path, fillRule);
      ctx.restore();
    });
  });
  ctx.restore();
}

/** Draw only the colored face artwork in 120×160 design coordinates. */
export function drawMahjongFace(ctx, id) {
  if (!TILE_LABELS[id]) throw new Error(`Unknown Mahjong tile: ${id}`);
  drawSegmentedFace(ctx, id);
}

/** Draw only the ivory tile body in 120×160 design coordinates. */
export function drawMahjongTileBody(ctx, id, options = {}) {
  if (!TILE_LABELS[id]) throw new Error(`Unknown Mahjong tile: ${id}`);
  drawTileBody(ctx, id, options.shadow !== false);
}

/**
 * Draw one complete tile using I.Mahjong-HK plus independent color layers.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id A tile id from TILE_GROUPS, e.g. "wan-5" or "wind-east".
 * @param {number} x Left position in canvas pixels.
 * @param {number} y Top position in canvas pixels.
 * @param {number} width Tile width in canvas pixels.
 * @param {number} height Tile height in canvas pixels.
 * @param {{shadow?: boolean}} options
 */
export function drawMahjongTile(ctx, id, x, y, width, height, options = {}) {
  if (!TILE_LABELS[id]) throw new Error(`Unknown Mahjong tile: ${id}`);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / DESIGN_W, height / DESIGN_H);
  drawTileBody(ctx, id, options.shadow !== false);
  drawSegmentedFace(ctx, id);
  ctx.restore();
}
