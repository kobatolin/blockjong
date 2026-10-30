/*
 * Automatic color-region pipeline for I.Mahjong-HK.
 * Suits, honors and flowers use vector contour groups extracted from the font,
 * so every pip, bamboo stick, character stroke and closed flower shape is
 * colored as a complete sub-shape. Raster component masks remain as a fallback
 * only if a flower glyph has no extracted contours.
 */

import { HK_CONTOURS } from './hk-contours.js';

export const LAYER_COLORS = {
  ink: '#0d1411',
  red: '#b0121a',
  green: '#0a4a31',
};

const MASK_RGB = {
  ink: [13, 20, 17],
  red: [176, 18, 26],
  green: [10, 74, 49],
};
const SCALE = 3;
const WIDTH = 120;
const HEIGHT = 160;
const cache = new Map();

const FLOWERS = {
  'flower-spring': 0x1F026, 'flower-summer': 0x1F027,
  'flower-autumn': 0x1F028, 'flower-winter': 0x1F029,
  'flower-plum': 0x1F022, 'flower-orchid': 0x1F023,
  'flower-bamboo': 0x1F024, 'flower-chrysanthemum': 0x1F025,
};

function tileCodePoint(id) {
  return FLOWERS[id];
}

const band = (axis, min, max, extra = {}) => ({ type: 'band', axis, min, max, ...extra });
const box = (x, y, w, h, extra = {}) => ({ type: 'box', x, y, w, h, ...extra });
const circle = (x, y, r, extra = {}) => ({ type: 'circle', x, y, r, ...extra });
const contour = (index, extra = {}) => box(0, 0, 1, 1, { index, ...extra });
const clipRectPath = (x, y, w, h) => {
  const left = x * WIDTH;
  const top = y * HEIGHT;
  const right = (x + w) * WIDTH;
  const bottom = (y + h) * HEIGHT;
  return `M${left} ${top}H${right}V${bottom}H${left}Z`;
};

function dotSevenTangentClip() {
  const green = { x: .7055 * WIDTH, y: .3848 * HEIGHT };
  const red = { x: .619 * WIDTH, y: .5631 * HEIGHT };
  const mid = { x: (green.x + red.x) / 2, y: (green.y + red.y) / 2 };
  const slope = -(red.x - green.x) / (red.y - green.y);
  const lowerBand = .45 * HEIGHT;
  const minX = .48 * WIDTH;
  const maxX = .87 * WIDTH;
  const yAt = x => mid.y + slope * (x - mid.x);
  return `M0 ${lowerBand}L${minX} ${lowerBand}L${minX} ${yAt(minX)}L${maxX} ${yAt(maxX)}L${WIDTH} ${yAt(maxX)}L${WIDTH} ${HEIGHT}L0 ${HEIGHT}Z`;
}

function matches(part, rule) {
  if (rule.index !== undefined && part.index !== rule.index) return false;
  if (rule.maxWidth && part.width > rule.maxWidth) return false;
  if (rule.maxHeight && part.height > rule.maxHeight) return false;
  const x = part.cx, y = part.cy;
  if (rule.type === 'band') {
    const value = rule.axis === 'x' ? x : y;
    return value >= rule.min && value < rule.max;
  }
  if (rule.type === 'box') return x >= rule.x && x <= rule.x + rule.w && y >= rule.y && y <= rule.y + rule.h;
  if (rule.type === 'circle') {
    const dx = x - rule.x, dy = y - rule.y;
    return dx * dx + dy * dy <= rule.r * rule.r;
  }
  return false;
}

function colorRecipe(id) {
  if (id === 'dragon-red') return { base: 'red', rules: [] };
  if (id === 'dragon-green') return { base: 'green', rules: [] };
  if (id === 'dragon-white') return { base: 'ink', rules: [], mergeBase: true };
  if (id.startsWith('wind-')) return { base: 'ink', rules: [] };

  if (id.startsWith('wan-')) {
    return { base: 'ink', rules: [{ color: 'red', select: band('y', .45, 1) }] };
  }

  if (id.startsWith('bamboo-')) {
    const n = Number(id.split('-')[1]);
    const rules = [];
    if (n === 1) rules.push({ color: 'red', select: circle(.548, .262, .08, { maxWidth: .12 }) });
    if (n === 5) rules.push({ color: 'red', select: circle(.491, .467, .1) });
    if (n === 7) rules.push({ color: 'red', select: band('y', 0, .36) });
    if (n === 9) rules.push({ color: 'red', select: band('x', .38, .63) });
    return { base: 'green', rules };
  }

  if (id.startsWith('dot-')) {
    const n = Number(id.split('-')[1]);
    const rules = [];
    if (n === 1) rules.push({ color: 'red', select: circle(.492, .468, .2, { index: 3, subpath: 'last' }) });
    if (n === 3) rules.push(
      { color: 'ink', select: circle(.301, .2, .13) },
      { color: 'red', select: circle(.492, .468, .13) },
    );
    if (n === 5) rules.push({ color: 'red', select: circle(.492, .468, .13) });
    if (n === 6) rules.push({ color: 'red', select: band('y', .4, 1) });
    // Split the joined outline along the tangent between the last green and first red pip.
    if (n === 7) rules.push({ color: 'red', select: band('y', .45, 1, { clipWhenTallerThan: .5, clipPath: dotSevenTangentClip() }) });
    if (n === 9) rules.push(
      { color: 'red', select: band('y', .34, .64) },
      { color: 'ink', select: band('y', .64, 1) },
    );
    return {
      base: [2, 4, 8].includes(n) ? 'ink' : 'green',
      rules,
      // One-dot relies on winding across all contours; keep its silhouette whole.
      mergeBase: n === 1,
    };
  }

  const redContours = indexes => indexes.map(index => ({ color: 'red', select: contour(index) }));
  const inkContours = indexes => indexes.map(index => ({ color: 'ink', select: contour(index) }));
  const redSubpaths = (index, subpaths) => subpaths.map(subpath => ({
    color: 'red',
    select: contour(index, { subpath, overlay: true }),
  }));
  const redClippedContour = (index, clipPath) => ({
    color: 'red',
    select: contour(index, { overlay: true, clipPath }),
  });

  const flowerRecipes = {
    'flower-spring': { red: [1, 7, 8], ink: [] },
    'flower-summer': { red: [0, 5, 6, 7], ink: [] },
    'flower-autumn': {
      red: [...Array.from({ length: 24 }, (_, index) => index + 10), 34, 35, 36],
      ink: [],
    },
    'flower-winter': {
      red: [0, 1, 2, 8, 9, 10],
      ink: [],
      overlays: [
        redClippedContour(3, clipRectPath(.08, .45, .3, .22)),
        redClippedContour(6, clipRectPath(.08, .22, .39, .28)),
        redClippedContour(7, clipRectPath(.56, .39, .36, .27)),
      ],
    },
    'flower-plum': {
      // Only the central blossom is red; surrounding dots, rings and leaves stay green.
      red: [6, 7],
      ink: [12, 13, 14, 15, 16],
    },
    'flower-orchid': {
      red: [0, 1, 2, 3],
      ink: [5, 6, 7, 8, 9, 10, 11],
      overlays: [...redSubpaths(4, [1, 2])],
    },
    'flower-bamboo': { red: [], ink: [5, 6, 7] },
    'flower-chrysanthemum': { red: [6, 7], ink: [17, 18, 19, 20] },
  };
  const flower = flowerRecipes[id];
  return {
    base: 'green',
    rules: [
      ...redContours(flower.red),
      ...inkContours(flower.ink),
      ...(flower.overlays || []),
    ],
  };
}

function vectorResult(entries, componentCount, recipe) {
  const assigned = entries.filter(entry => entry.color !== 'none');
  const names = [...new Set([
    recipe.base,
    ...recipe.rules.map(rule => rule.color),
    ...assigned.map(group => group.color),
  ])];
  const layers = names.map(color => ({
    color,
    paths: assigned
      .filter(group => group.color === color)
      .map(({ path, clip, fillRule }) => ({ path, clip, fillRule })),
  }));
  const selectedCounts = {};
  assigned.forEach(group => {
    selectedCounts[group.color] = (selectedCounts[group.color] || 0) + 1;
  });
  const parts = assigned.map(({ cx, cy, width, height, color, clip, fillRule }) => ({ cx, cy, width, height, color, clip, fillRule }));
  return { layers, parts, componentCount, selectedCounts, recipe };
}

function selectedSubpath(group, rule) {
  if (rule.select.subpath === undefined || !group.subpaths.length) return group.path;
  const subpath = rule.select.subpath === 'last'
    ? group.subpaths.at(-1)
    : group.subpaths[rule.select.subpath];
  return subpath || group.path;
}

function overlayClip(group, rule) {
  const select = rule.select;
  if (select.clipPath) return { path: new Path2D(select.clipPath) };
  if (
    select.clipWhenTallerThan &&
    group.height > select.clipWhenTallerThan &&
    select.type === 'band'
  ) {
    return {
      axis: select.axis,
      min: select.min,
      max: select.max,
    };
  }
  return null;
}

function buildVectorLayers(id, recipe) {
  const groups = HK_CONTOURS[id].map((group, index) => ({
    ...group,
    index,
    path: new Path2D(group.d),
    subpaths: (group.sub || []).map(d => new Path2D(d)),
  }));

  if (recipe.mergeBase) {
    const mergedPath = new Path2D(groups.map(group => group.d).join(' '));
    const entries = [{
      ...groups[0],
      color: recipe.base,
      path: mergedPath,
      fillRule: 'nonzero',
      clip: null,
    }];
    groups.forEach(group => {
      recipe.rules.forEach(rule => {
        if (!matches(group, rule.select)) return;
        entries.push({
          ...group,
          color: rule.color,
          path: selectedSubpath(group, rule),
          fillRule: rule.select.fillRule || 'nonzero',
          clip: overlayClip(group, rule),
        });
      });
    });
    return vectorResult(entries, groups.length, recipe);
  }

  const assigned = groups.flatMap(group => {
    let color = recipe.base;
    let path = group.path;
    let fillRule = 'nonzero';
    const overlays = [];
    recipe.rules.forEach(rule => {
      if (!matches(group, rule.select)) return;
      const clip = overlayClip(group, rule);
      if (rule.select.overlay || clip) {
        overlays.push({
          ...group,
          color: rule.color,
          path: selectedSubpath(group, rule),
          fillRule: rule.select.fillRule || 'nonzero',
          clip,
        });
        return;
      }
      color = rule.color;
      fillRule = rule.select.fillRule || 'nonzero';
      path = selectedSubpath(group, rule);
    });
    return [{ ...group, color, path, fillRule, clip: null }, ...overlays];
  });
  return vectorResult(assigned, groups.length, recipe);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();ctx.moveTo(x + r, y);ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);ctx.closePath();
}

function rasterizeGlyph(id) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(SCALE, SCALE);roundedRect(ctx, 9, 7, 100, 135, 5);ctx.clip();
  ctx.font = '164.9px IMahjongHK';ctx.textAlign = 'left';ctx.textBaseline = 'alphabetic';ctx.fillStyle = '#000';
  ctx.fillText(String.fromCodePoint(tileCodePoint(id)), 4, 137.8);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function extractComponents(image) {
  const { width, height, data } = image;
  const size = width * height;
  const labels = new Int32Array(size);const queue = new Int32Array(size);const components = [null];let count = 0;
  for (let start = 0; start < size; start++) {
    if (labels[start] || data[start * 4 + 3] <= 12) continue;
    const id = ++count;let head = 0, tail = 0;queue[tail++] = start;labels[start] = id;
    let minX = width, minY = height, maxX = 0, maxY = 0, area = 0, sumX = 0, sumY = 0;
    while (head < tail) {
      const index = queue[head++];const x = index % width;const y = (index / width) | 0;
      area++;sumX += x;sumY += y;minX = Math.min(minX, x);minY = Math.min(minY, y);maxX = Math.max(maxX, x);maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!labels[next] && data[next * 4 + 3] > 12) { labels[next] = id;queue[tail++] = next; }
      }
    }
    components.push({ id, area, minX, minY, maxX, maxY, cx: sumX / area / width, cy: sumY / area / height, width: (maxX - minX + 1) / width, height: (maxY - minY + 1) / height });
  }
  return { labels, components };
}

function relation(component, rule, width, height) {
  const b = { minX: component.minX / width, maxX: component.maxX / width, minY: component.minY / height, maxY: component.maxY / height };
  if (rule.type === 'band') {
    const min = rule.axis === 'x' ? b.minX : b.minY, max = rule.axis === 'x' ? b.maxX : b.maxY;
    if (min >= rule.min && max < rule.max) return 'inside';if (max < rule.min || min >= rule.max) return 'outside';return 'partial';
  }
  if (rule.type === 'box') {
    if (b.minX >= rule.x && b.maxX <= rule.x + rule.w && b.minY >= rule.y && b.maxY <= rule.y + rule.h) return 'inside';
    if (b.maxX < rule.x || b.minX > rule.x + rule.w || b.maxY < rule.y || b.minY > rule.y + rule.h) return 'outside';return 'partial';
  }
  const corners = [[b.minX,b.minY],[b.minX,b.maxY],[b.maxX,b.minY],[b.maxX,b.maxY]];
  if (corners.every(([x,y]) => (x-rule.x)**2 + (y-rule.y)**2 <= rule.r**2)) return 'inside';
  const nearX = Math.max(b.minX, Math.min(rule.x, b.maxX)), nearY = Math.max(b.minY, Math.min(rule.y, b.maxY));
  return (nearX-rule.x)**2 + (nearY-rule.y)**2 > rule.r**2 ? 'outside' : 'partial';
}

function buildFlowerLayers(id, recipe) {
  const image = rasterizeGlyph(id);
  const { labels, components } = extractComponents(image);
  const { width, height, data } = image;const modes = new Array(components.length);const selectedCounts = {};
  components.slice(1).forEach(component => {
    modes[component.id] = recipe.rules.map(rule => relation(component, rule.select, width, height));
    recipe.rules.forEach((rule, index) => { if (modes[component.id][index] !== 'outside') selectedCounts[rule.color] = (selectedCounts[rule.color] || 0) + 1; });
  });
  const names = [...new Set([recipe.base, ...recipe.rules.map(rule => rule.color)])];
  const images = Object.fromEntries(names.map(name => [name, new ImageData(width, height)]));
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];if (!label) continue;
    const x = (i % width) / width, y = ((i / width) | 0) / height;let name = recipe.base;
    recipe.rules.forEach((rule, index) => {
      const mode = modes[label][index];
      if (mode === 'inside' || (mode === 'partial' && matches({ cx: x, cy: y }, rule.select))) name = rule.color;
    });
    const target = images[name].data, offset = i * 4, [r, g, b] = MASK_RGB[name];
    target[offset] = r;target[offset + 1] = g;target[offset + 2] = b;target[offset + 3] = data[offset + 3];
  }
  const layers = names.map(name => {
    const canvas = document.createElement('canvas');canvas.width = width;canvas.height = height;
    canvas.getContext('2d').putImageData(images[name], 0, 0);return { color: name, canvas };
  });
  return { layers, componentCount: components.length - 1, selectedCounts, recipe };
}

export function getTileSegmentation(id) {
  if (cache.has(id)) return cache.get(id);
  const recipe = colorRecipe(id);
  const useRasterFallback = id.startsWith('flower-') && !HK_CONTOURS[id];
  const result = useRasterFallback ? buildFlowerLayers(id, recipe) : buildVectorLayers(id, recipe);
  cache.set(id, result);
  return result;
}
