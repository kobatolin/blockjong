# 3D 渲染与视觉方案

> 版本：v0.1 ｜ 日期：2026-10-29
> 技术：Three.js `^0.186.1`（WebGL2）+ 程序化 Canvas 纹理
> 本文描述“怎么好看、怎么不卡”，规则与数值以 `GAME_RULES.md` 为准。

---

## 1. 视觉目标

一句话：**深夜棋牌室里的一张墨绿毛毡桌，象牙白的麻将牌被顶光照亮，牌面像刻上去的。**

- 牌必须**清晰可读**：3D 是氛围，不是障碍。相机接近俯视，所有牌面始终可见。
- 材质要有“物性”：象牙白的微暖、边缘圆润、牌面轻微凹陷、桌面绒感。
- 动效要“克制”：抬升、轻转、金色粒子；不做夸张爆炸。
- 低端设备可降级到“无阴影、少粒子、低 DPR”，但牌面与可读性不降。

参考气质：中式茶室的墨绿 + 黄铜 + 暖白；避免赛博霓虹、避免高饱和卡通。

---

## 2. 世界坐标与尺寸

### 2.1 单位

- 1 世界单位 ≈ 1 个棋格的宽度。
- 棋盘平面为 **XZ 平面**，Y 轴向上；桌面 `y = 0`。
- 列沿 X 轴，行沿 Z 轴。`r = 0` 在远端（z 为负），`r = rows-1` 在近端。

### 2.2 格与牌

| 参数 | 值 | 说明 |
| --- | --- | --- |
| `CELL_W` | 1.00 | 格宽（X） |
| `CELL_D` | 1.25 | 格深（Z）；麻将牌面为竖长比例 |
| `TILE_W` | 0.92 | 牌宽 |
| `TILE_D` | 1.15 | 牌长 |
| `TILE_H` | 0.34 | 牌厚 |
| `CORNER_R` | 0.055 | 圆角半径 |
| 间隙 | 0.08 / 0.10 | 牌与格边留白，形成缝 |

牌的落位：

```ts
x = (c - (cols - 1) / 2) * CELL_W;
z = (r - (rows - 1) / 2) * CELL_D;
y = TILE_H / 2;          // 牌体中心；底面贴桌
```

棋盘尺寸：`W = cols * CELL_W`，`D = rows * CELL_D`。
12×12 时为 12 × 15；8×9 时为 9 × 10；9×12 时为 12 × 11.25。

> 说明：格深大于格宽，是为了让竖长牌面在俯视时仍有足够的视觉面积，同时保持行列整齐。牌与牌之间的横向缝隙略小于纵向缝隙，观感更接近真实牌桌。

### 2.3 牌的姿态

- **平躺**，牌面朝上；不做竖立。
- 理由：12×12 共 144 张，竖立会让近处牌遮挡远处牌面，破坏“全盘可读”。
- 每张牌加入极小的随机偏转（`±0.004 rad`）与位置抖动（`±0.006`），避免“复制粘贴感”；不影响拾取与格坐标。

---

## 3. 场景图

```
Scene
├── background (Color / FogExp2)
├── environment (PMREM from RoomEnvironment)
├── tableGroup
│   ├── tablePlane        大平面，深色绒面
│   ├── boardMat          棋盘垫（毛毡，圆角矩形）
│   ├── boardRim          木质围边（挤出圆角矩形）
│   └── inlayLine         黄铜细线（可选）
├── tileLayer
│   ├── TileView[0]       Group
│   │   ├── body          RoundedBoxGeometry + 象牙白材质
│   │   └── face          PlaneGeometry + 牌面纹理
│   └── ...
├── fxLayer
│   ├── selectionHalo     选中光环（加法混合）
│   ├── partnerMarkers    可配对标记池
│   ├── ghostCells        拖动目标格
│   ├── dragArrow         方向箭头
│   ├── particles         Points（池化）
│   └── shockwave         消除冲击环
└── lights
    ├── hemi
    ├── key (shadow)
    └── fill
```

`TileView` 是渲染层对象，持有 `tileId`、`group`、`body`、`face`、基准位置；**不持有游戏规则**。

---

## 4. 相机

### 4.1 参数

| 参数 | 值 |
| --- | --- |
| 类型 | `PerspectiveCamera` |
| `fov` | 34°（竖直） |
| 俯仰角 | 约 60°（从水平面算） |
| 朝向 | 沿 +Z 看向原点，无侧倾 |
| 近/远裁剪 | 0.1 / 200 |
| 目标点 | 棋盘中心，略向近端偏移（+0.3 Z） |

### 4.2 自动适配

用棋盘包围球估算距离：

```ts
const W = cols * CELL_W;
const D = rows * CELL_D;
const radius = 0.5 * Math.hypot(W, D) + TILE_H;
const fovY = (camera.fov * Math.PI) / 180;
const fovX = 2 * Math.atan(Math.tan(fovY / 2) * camera.aspect);
const fitFov = Math.min(fovY, fovX);
const dist = (radius / Math.sin(fitFov / 2)) * MARGIN;
```

- `MARGIN = 1.12`（桌面）/ `1.20`（移动端，给 HUD 留白）。
- 相机位置：

```ts
const pitch = THREE.MathUtils.degToRad(60);
camera.position.set(0, dist * Math.sin(pitch), dist * Math.cos(pitch));
camera.lookAt(0, 0.4, 0.6);
```

- 包围球是保守估计；首版用它可以避免边角出画。若画面偏小，再将 `MARGIN` 调到 1.05–1.08。
- 窗口尺寸变化用 `ResizeObserver` 监听，重建尺寸并重新适配（`400ms` 缓动过渡）。
- 竖屏时按 `fovX` 受限，距离会自动变远；不要旋转棋盘。

### 4.3 轻微视差

- 指针位置映射到 `yaw ±1.2°`、`pitch ±0.8°`，用阻尼跟随（`lerp 0.06`）。
- 拖动、结算、低画质、`prefers-reduced-motion` 时关闭。
- 视差只改相机，不改棋盘坐标；拾取仍用当前相机矩阵。

### 4.4 相机避让 HUD

- HUD 为半透明覆盖层，不改变 canvas 尺寸。
- 用 `MARGIN` 预留上下空间；移动端额外乘 1.08。
- 若实测顶部 HUD 压住远端牌，优先增大 `MARGIN`，而不是缩小棋盘。

---

## 5. 灯光与阴影

### 5.1 渲染器

```ts
renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

### 5.2 灯光

| 灯 | 参数 | 作用 |
| --- | --- | --- |
| HemisphereLight | 天 `#fff3dd` / 地 `#0a241e`，强度 0.55 | 基础环境光，避免死黑 |
| DirectionalLight（主） | `#ffe9c9`，强度 2.1，位置 `(-8, 16, 10)` | 暖色主光，投射阴影 |
| DirectionalLight（补） | `#8fc7ff`，强度 0.35，位置 `(9, 8, -8)` | 冷色补光，拉开层次 |
| Environment（PMREM） | RoomEnvironment，强度 0.35 | 牌体高光与边缘反射 |

主光阴影：

```ts
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 60;
key.shadow.camera.left = -W / 2 - 2;
key.shadow.camera.right = W / 2 + 2;
key.shadow.camera.top = D / 2 + 2;
key.shadow.camera.bottom = -D / 2 - 2;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.02;
```

- 只让主光投影；补光不投影，减少一次 shadow pass。
- 牌体 `castShadow = true`、`receiveShadow = true`；桌面/棋盘垫 `receiveShadow = true`。
- 牌面 Plane 不投影（`castShadow = false`），避免薄面伪影。

### 5.3 色调

- 整体偏暖，但毛毡保持冷绿，形成冷暖对比。
- 牌面象牙白不要纯白（`#f1e6cf`），否则高光过曝。
- 金色只用于选中/提示/粒子，不铺大面积。

---

## 6. 牌体与材质

### 6.1 几何

```ts
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const bodyGeo = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 4, CORNER_R);
```

- 所有牌共享同一份 `bodyGeo` 与 `faceGeo`。
- 圆角分段 4 足够；再高只会增加顶点数。
- 牌体不需要背面细节（不可见）。

### 6.2 材质

```ts
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0xf1e6cf,
  roughness: 0.38,
  metalness: 0.0,
  clearcoat: 0.35,
  clearcoatRoughness: 0.35,
  envMapIntensity: 0.6,
});
```

- 清漆层模拟象牙/树脂的温润反光；不要做成塑料高光。
- 牌面材质：

```ts
const faceMat = new THREE.MeshStandardMaterial({
  map: texture,
  roughness: 0.55,
  metalness: 0.0,
  envMapIntensity: 0.4,
});
```

### 6.3 牌面贴合

- `PlaneGeometry(TILE_W * 0.96, TILE_D * 0.96)`，`rotateX(-Math.PI / 2)`。
- 放在牌体顶面上方 `0.002`，避免 z-fighting。
- 纹理 UV 方向：平面局部 `+Y` 旋转后指向 `-Z`（远端），保证文字从近端看是正的。
- 若出现上下颠倒，优先检查 `flipY` 与这里的旋转，而不是改 UV。

### 6.4 拾取

- `Raycaster` 与 `body` 求交（圆角盒比平面更贴合视觉）。
- `body.userData.tileId = id`；命中后向上找到 `TileView`。
- 每帧复用 `raycaster` 与 `Vector2`，不新建对象。

---

## 7. 牌面纹理（程序化）

### 7.1 规格

| 项 | 值 |
| --- | --- |
| 画布 | 256 × 320（宽高比 0.8，与牌面一致） |
| 格式 | `CanvasTexture`，`SRGBColorSpace` |
| 过滤 | 线性 + mipmap；`anisotropy = min(4, maxAnisotropy)` |
| 数量 | 42 张（每种牌一张，所有副本共享） |
| 显存 | 约 14MB（含 mipmap 约 19MB） |

> 不把所有牌面塞进一张大图集：42 张独立纹理实现简单、绑定开销可接受，且便于按需生成。若后续 draw call 成为瓶颈，再考虑图集或 InstancedMesh。

### 7.2 绘制流程

```ts
function paintFace(kind: TileKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const ctx = c.getContext('2d')!;
  paintBackground(ctx);
  switch (kind.suit) {
    case 'pin':   paintPin(ctx, kind.rank!); break;
    case 'sou':   paintSou(ctx, kind.rank!); break;
    case 'man':   paintMan(ctx, kind.rank!); break;
    case 'honor': paintHonor(ctx, kind.id); break;
    case 'flower':paintFlower(ctx, kind.id); break;
  }
  paintInnerBorder(ctx);
  return c;
}
```

### 7.3 底色与“雕刻感”

1. **底色**：中心 `#fbf4e4` → 边缘 `#e8d9bd` 的径向渐变。
2. **纸纹**：绘制约 2500 个 1px 的半透明噪点（`alpha 0.02–0.05`），避免纯色塑料感。
3. **内框**：距边 8px 的圆角矩形描边，`rgba(120, 90, 50, 0.16)`，宽 2px。
4. **雕刻**：
   - 每个图形先画一层向下偏移 1.5px 的暖白高光 `rgba(255, 250, 235, 0.85)`；
   - 再画主色；
   - 主色带 `shadowColor rgba(0,0,0,.25)`、`blur 1`、偏移 `(0,1)`；
   - 形成“凹刻 + 边缘受光”的错觉。
5. **边缘暗角**：牌面四边加 6–10px 的内阴影，模拟牌面微凹。

> 关键：高光在下方、阴影在上方，才会像“刻进去”；反过来会像贴纸。实现后用 `?faces=1` 画廊逐张检查。

### 7.4 筒（Dots）

- 圆环 + 中心圆点；环宽约为半径的 0.28。
- 1 筒为大圆（半径约牌宽的 0.30），2–9 按传统点位排列：

| 点数 | 排布 |
| --- | --- |
| 1 | 中心 1 个大圆 |
| 2 | 上、下各 1 |
| 3 | 左上、中、右下 斜线 |
| 4 | 2 × 2 |
| 5 | 2 × 2 + 中心 |
| 6 | 2 列 × 3 行 |
| 7 | 上 3 + 下 4（或 3 + 2 + 2） |
| 8 | 2 列 × 4 行 |
| 9 | 3 × 3 |

- 配色：蓝 `#1f5fa8`、绿 `#1f7a4d`、红 `#a8322a` 交替；1 筒用红/蓝双环。
- 圆环内部留白，中心一个小实心点，增加层次。

### 7.5 索（Bamboo）

- 竹节短棒：圆角矩形 + 2 条横向刻线 + 两端小帽；绿 `#1f7a4d` 为主，少量红 `#a8322a`。
- 1 索：传统鸟形。用椭圆身体 + 三角尾羽 + 小圆头 + 喙 + 爪，绿/红两色；不做写实，保持符号化。
- 2–9 索排布：

| 点数 | 排布 |
| --- | --- |
| 2 | 2 根竖排 |
| 3 | 上 1 下 2（三角形） |
| 4 | 2 × 2 |
| 5 | 2 × 2 + 中心 |
| 6 | 3 列 × 2 行 |
| 7 | 上 1 + 中 3 + 下 3 |
| 8 | 4 列 × 2 行 |
| 9 | 3 × 3 |

- 每根竹节略微错位 1–2px，避免机械感。

### 7.6 万（Characters）

- 上部：汉字数字“一”–“九”，占约 38% 高度，黑色/深蓝 `#20303a`。
- 下部：“萬”，占约 46% 高度，朱红 `#a8322a`。
- 中间一条极细的金色分隔线（`rgba(180,140,70,.35)`），增加仪式感。
- 字体：楷体优先；数字可用稍粗的衬线。

### 7.7 字牌（Honors）

- 单字居中，占牌面 60%：
  - 东/南/西/北：墨黑 `#1d1d1b`；
  - 中：朱红 `#b3261e`；
  - 发：墨绿 `#1c6b3c`；
  - 白：传统为蓝色空心框——画一个圆角矩形蓝框（`#2f5fa0`），内部留白，四角加小装饰；不写“白”字。
- 字牌笔画粗，缩小后仍可辨；可在字外加一圈极淡的同色描边。

### 7.8 花牌（Flowers）

- 单字 + 角落装饰：
  - 季节组（春夏秋冬）：青绿 `#2b7a5a`，角落画一片叶子/波纹；
  - 花组（梅兰竹菊）：绛红 `#b23a48`，角落画一枚小印章方块或花瓣。
- 装饰只占右下角 18% 区域，不能干扰主字。
- 花牌底部可加一行 3px 的组色细线，帮助玩家识别“同组可配”。

### 7.9 字体与降级

```ts
const FONT_SERIF = '"KaiTi","STKaiti","Kaiti SC","Noto Serif SC","SimSun",serif';
const FONT_SANS  = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
```

- 汉字统一用 `FONT_SERIF`；数字/装饰可用 `FONT_SANS`。
- 字体缺失时系统 serif 兜底；不阻塞纹理生成。
- 绘制前用 `ctx.measureText` 校验宽度，超宽则缩小字号（`fitText`）。
- 后续可选：内置一份子集化宋体/楷体 woff2，保证跨平台一致。

### 7.10 调试画廊

- 路由 `?faces=1`：以 7×6 网格展示 42 张牌面（2D canvas 直接 `toDataURL` 或绘制到页面）。
- 支持按牌种筛选、放大单张、显示尺寸/耗时。
- M3 验收时逐张检查：无溢出、无遮挡、字正、颜色不脏。

---

## 8. 桌面与环境

### 8.1 毛毡

- 512×512 程序化纹理：深墨绿底 `#0e3a30`，叠加细噪点、短纤维线、极淡的明暗斑块。
- `RepeatWrapping`，`repeat 6×6`，`SRGBColorSpace`。
- 棋盘垫（`W+2.0 × D+2.0`）用更深的绿 `#0b2f27`，圆角 0.4。
- 木质围边：圆角矩形挤出 0.35 高，深胡桃木 `#2a1a10`，粗糙度 0.65；顶面加一条 1px 黄铜线（`#8a6a3a`，金属度 0.8）作为镶嵌。

### 8.2 背景

- 场景背景色 `#07120f`，`FogExp2(0x08130f, 0.008)`。
- 桌面外的大平面用更深的绿黑，边缘自然融入背景。
- 屏幕四角加 CSS 径向渐变暗角（`pointer-events: none`），比后处理便宜。

### 8.3 阴影与接触感

- 牌底与桌面之间需要“接触阴影”。主光 PCFSoft 已能提供；若发虚，可在每张牌下加一个极淡的 blob 阴影平面（径向渐变，`opacity 0.18`），但 144 张会增加 draw call——优先调主光阴影参数。
- 阴影相机紧贴棋盘，避免 2048 贴图被浪费在大范围。

---

## 9. 交互视觉

### 9.1 悬停

- 牌体抬升 `+0.06`，`120ms`；牌面轻微提亮（通过叠加一个半透明白色平面或调整材质？材质共享，不能按牌改）。
- 方案：悬停时在牌面上方加一个 `opacity 0.06` 的白色圆角平面，或用 `selectionHalo` 的弱化版。避免克隆材质。
- 指针样式：`cursor: pointer`。

### 9.2 选中（锚牌）

- 抬升 `+0.18`，`160ms`，轻微放大 `1.02`。
- 牌下金色光环：加法混合的径向渐变平面（1.5×1.8），透明度脉冲 `0.55–0.85`。
- 所有可配对且可见的牌：牌角出现金色菱形标记，上下浮动 `±0.03`，周期 1.6s。
- 若没有候选，只显示选中光环，不显示标记。

### 9.3 拖动

- 整个牌串抬升 `+0.12`，`100ms`。
- 牌串跟随指针，但**吸附到整数格**；用弹簧阻尼（`lerp 0.35`）减少抖动。
- 目标格显示半透明金色轮廓（`0.12` 填充 + `0.5` 描边），最多显示 `kMax+1` 个候选格。
- 轴向箭头：桌面上的细长三角形 + 线段，颜色 `#d9b36c`，透明度 0.5。
- 若当前有锚牌且将成为配对对象：锚牌光环变亮，并画一条虚线连接（可选）。
- 拖动时关闭相机视差，避免“手在动、世界也在动”。

### 9.4 成功消除

时间线（总 420ms）：

| 时间 | 事件 |
| --- | --- |
| 0ms | 牌串落位；两牌停 40ms |
| 40ms | 两牌抬升 +0.5、缩小到 0.2、绕 Y 轴旋转 ±0.35rad |
| 120ms | 金色粒子爆发（24 个/牌），冲击环扩散 |
| 300ms | 两牌 scale → 0，移除 |
| 420ms | 冲击环淡出；HUD 数字滚动 |

- 粒子：`Points`，加法混合，金色 `#ffd27a`，寿命 0.7s，初速度向上锥形，重力 -3。
- 冲击环：平面圆环纹理，scale 0.4→2.2，opacity 0.9→0。
- 若同时触发胜利，延后 600ms 再拉远相机。

### 9.5 失败回弹

- 整串以 `expoOut` 回到起点，`280ms`，带 4% 过冲。
- 牌面边缘闪一次红光（叠加红色描边平面，`opacity 0.5→0`，200ms）。
- 轻微相机震动（`±0.03`，120ms），可在低画质/减少动效时关闭。
- Toast：“落点无法配对”。

### 9.6 洗牌

- 剩余牌抬升 `+0.4`，随机旋转 `±π`，`250ms`；
- 交换到新位置，错峰落下（按 `(r+c)` 延迟 8ms）；
- 总时长约 600ms；期间输入锁定。
- 落定后做一次金色微光扫过棋盘（可选）。

### 9.7 胜利

- 相机后拉 8%，`600ms`；
- 金色粒子从上方缓缓落下（60–100 个）；
- 桌面亮度略升；
- 800ms 后弹出结算面板（HTML）。

### 9.8 死局

- canvas 加 CSS `filter: saturate(0.55) brightness(0.85)`，`300ms` 过渡；
- 弹出死局面板；关闭后恢复。

---

## 10. 动画系统

### 10.1 轻量 Tween

不引入 GSAP。一个数组 + 每帧更新即可：

```ts
interface Tween {
  target: any;
  props: Record<string, { from: number; to: number }>;
  duration: number;
  delay: number;
  elapsed: number;
  easing: (t: number) => number;
  onUpdate?: () => void;
  onComplete?: () => void;
  done: boolean;
}
```

- `update(dt)`：累加 `elapsed`，计算 `t`，写入目标属性；完成后回调并移除。
- 支持 `killByTarget(target)`，用于重开/洗牌时取消旧动画。
- 同一 target 的同一属性后加入的 tween 覆盖先前的（先 kill）。

### 10.2 缓动

- `linear`
- `cubicOut`：抬升/落位
- `backOut`：回弹/洗牌落位
- `expoOut`：相机/面板
- `elasticOut`：仅胜利等特殊时刻，慎用

### 10.3 时长表

| 动作 | 时长 | 缓动 |
| --- | --- | --- |
| 悬停 | 120ms | cubicOut |
| 选中 | 160ms | backOut |
| 拖动抬升 | 100ms | cubicOut |
| 落点吸附 | 120ms | cubicOut |
| 失败回弹 | 280ms | expoOut |
| 消除 | 420ms | cubicOut |
| 洗牌 | 600ms | backOut |
| 相机适配 | 400ms | expoOut |
| 结算 | 800ms | expoOut |

### 10.4 弹簧

拖动跟随不用 tween，用逐帧阻尼：

```ts
current += (target - current) * Math.min(1, dt * 18);
```

- `dt` 需 clamp 到 0.05，避免切后台回来“瞬移”。

---

## 11. 输入与拾取

- 指针事件统一走 `pointerdown / pointermove / pointerup / pointercancel`，配合 `setPointerCapture`。
- 只用第一个 `pointerId`；多指忽略。
- `pointerdown` 时 Raycaster 命中牌；未命中则记录“点空白”。
- `pointermove`：
  - 未进入拖动且位移 > 6px → 锁定轴与方向；
  - 进入拖动后用射线与牌顶平面（`y = TILE_H + 0.01`）求交，换算为格坐标，计算 `k`；
  - `k = clamp(round(deltaCells * sign), 0, kMax)`。
- `pointerup`：拖动 → 提交；未拖动 → 点选。
- `pointercancel` / 窗口失焦 → 回弹，不判定。
- 悬停：指针静止或移动时做一次 Raycaster（可每帧一次，144 个对象足够）；拖动时不做悬停。
- 禁用浏览器手势：canvas `touch-action: none`；阻止 `contextmenu`。
- 高 DPI 下的 NDC：

```ts
const rect = canvas.getBoundingClientRect();
const ndc = new THREE.Vector2(
  ((e.clientX - rect.left) / rect.width) * 2 - 1,
  -((e.clientY - rect.top) / rect.height) * 2 + 1,
);
```

### 11.1 命中优先级

- 牌体（body）优先；牌面 Plane 不参与拾取，避免重复命中。
- 若两张牌在屏幕上重叠（透视导致），取 `intersect[0]`，即最近的牌；平躺布局下重叠很少。

---

## 12. 性能预算与降级

### 12.1 预算（12×12，144 张）

| 项 | 目标 |
| --- | --- |
| 帧率 | 60fps（桌面核显/中端独显） |
| 平均帧时间 | < 16.7ms |
| Draw call | < 320（初始实现）；优化后 < 80 |
| 三角形 | < 150k |
| 纹理显存 | < 80MB |
| 阴影贴图 | 2048²（高）/ 1024²（中）/ 关闭（低） |
| 粒子 | 池化 256 |

牌体 `RoundedBoxGeometry` 分段 4 时约 1.5k 三角形/张 × 144 ≈ 216k，略超预算；可把分段降到 3 或在 M5 用 InstancedMesh。首版以观感优先，实测再调。

### 12.2 降级策略

| 档位 | DPR | 阴影 | 粒子 | 环境反射 | 视差 |
| --- | --- | --- | --- | --- | --- |
| 高 | min(dpr, 2) | 2048 | 32/次 | 开 | 开 |
| 中 | 1.75 | 1024 | 16/次 | 开 | 开 |
| 低 | 1.25 | 关 | 0 | 关 | 关 |

- 自动：连续 2s 平均帧时间 > 22ms → 降一档；只降不升，避免抖动。
- 用户可在设置中手动选“高/中/低/自动”。
- 切后台暂停 RAF；恢复时重置 `clock`，避免大 `dt`。

### 12.3 可选优化（M5）

1. **InstancedMesh**：牌体共享材质，可合成 1 个 InstancedMesh；牌面按 42 种各建一个 InstancedMesh（每种 1–4 个实例）。draw call 从 ~288 降到 ~45。
   - 代价：每个实例的矩阵更新、拾取用 `instanceId`、动画需写矩阵；复杂度上升。
2. **纹理图集**：42 张 256×320 合成为 2048×2048 图集，减少绑定切换。
3. **静态阴影**：牌不动时冻结 `shadow.autoUpdate`，仅在动画时开启。
4. **合并桌面几何**：桌面/围边/镶嵌合并为一个 Mesh。

首版不做，先保证正确与好看。

---

## 13. 响应式与移动端

- canvas 填满容器；`ResizeObserver` 触发 `resize()` + 重新适配相机。
- 移动端 `MARGIN` 1.20；HUD 顶部/底部使用 `env(safe-area-inset-*)`。
- 竖屏时棋盘可能显得小：允许双指缩放？本期不做，保持固定视角，避免与拖动手势冲突。
- 触屏拖动阈值 8px；按住 120ms 内移动不超过阈值视为点选。
- 手机 GPU：DPR 上限 1.75，阴影 1024，粒子减半。
- 低电量/省电模式：监听 `navigator.getBattery`（可选），降档。

---

## 14. 调试与验收

### 14.1 调试参数

| 参数 | 作用 |
| --- | --- |
| `?mode=easy\|medium\|full` | 直接开局 |
| `?seed=12345` | 固定随机种子 |
| `?faces=1` | 42 张牌面画廊 |
| `?debug=1` | 显示 FPS、draw call、三角形数、牌数、相机距离 |
| `?quality=low` | 强制画质档 |

### 14.2 验收清单

- [ ] 42 张牌面无溢出、无错字、无上下颠倒；缩到 64px 仍可辨。
- [ ] 12×12 棋盘完整入画；横竖屏、16:9/16:10/21:9 均不被 HUD 遮挡。
- [ ] 牌与牌之间无 z-fighting；牌面无摩尔纹。
- [ ] 阴影无 acne、无 peter-panning；牌底有接触感。
- [ ] 选中/悬停/拖动/消除/回弹/洗牌动效时长正确，无卡顿。
- [ ] 144 张牌场景 draw call、帧时间在预算内。
- [ ] 切换页面/重开无 WebGL context 泄漏（`renderer.info` 归零）。
- [ ] 低画质档可运行；`prefers-reduced-motion` 下动效收敛。

### 14.3 常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 牌面发灰/过曝 | 纹理未设 `SRGBColorSpace` | 设置 `texture.colorSpace = THREE.SRGBColorSpace` |
| 牌面文字上下颠倒 | Plane 旋转/UV 方向 | 检查 `rotateX(-π/2)` 与纹理 `flipY` |
| 牌面闪烁 | 与牌体顶面 z-fighting | 抬高 0.002；必要时 `polygonOffset` |
| 阴影条纹 | 阴影 bias/normalBias | 调 `normalBias 0.02`、`bias -0.0005` |
| 拾取偏移 | 用了 window 尺寸而非 canvas rect | 用 `getBoundingClientRect()` |
| 重开后越来越卡 | 未 dispose 几何/材质/纹理 | `GameRenderer.dispose()` 遍历释放 |
| HMR 多个 canvas | 组件卸载未清理 | `onBeforeUnmount` 调用 dispose |
| 牌面模糊 | DPR 低/纹理小 | 提高 DPR 或纹理到 384×480（按需） |

---

## 15. 实现顺序建议

1. 空场景 + 桌面 + 相机适配 + 一张牌（验证坐标、朝向、光照）。
2. 42 张牌面 2D 画廊（先不管 3D），逐张调美观。
3. 铺满 12×12 牌，验证 draw call、阴影、拾取。
4. 选中/悬停/拖动/消除/回弹动效。
5. 洗牌/胜利/死局/低画质。
6. 性能优化（如需）。

先做“一张牌好看”，再做“一盘牌不卡”。
