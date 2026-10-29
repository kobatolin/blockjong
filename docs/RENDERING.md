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
│   ├── selectionHalo     选中金色圆角描边（牌面上方）
│   ├── partnerMarkers    可配对标记 + 淡金描边
│   ├── ghostCells        拖动目标格
│   ├── dragArrow         方向箭头（后续）
│   ├── particles         Points（金色火花池）
│   └── shockwave         消除冲击环（后续）
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
| 目标点 | `(0, 0.25, 0.35)`，略向近端偏移 |

### 4.2 自动适配

不按包围球估算，而是**投影棋盘 8 个角点并二分搜索相机距离**，这样对透视和俯仰更准确：

```ts
const corners = [x = ±W/2, z = ±D/2, y = 0 或 TILE_H]; // 8 个点
let low = 4, high = 200;
for (let i = 0; i < 28; i++) {
  const dist = (low + high) / 2;
  camera.position.set(0, dist * sin(60°), dist * cos(60°));
  camera.lookAt(0, 0.25, 0.35);
  camera.updateMatrixWorld(true);
  const maxNdc = max(|corner.project(camera).x|, |corner.project(camera).y|);
  if (maxNdc > 0.78) low = dist; else high = dist;
}
```

- **`FIT_NDC = 0.78`**：棋盘最长边占屏幕约 78%，给顶部 HUD 与底部操作坞留白。
- 12×12 的 144 张牌、9×12、8×9 共用同一套适配；竖屏时按宽度受限，棋盘自动缩小。
- 实测 1440×900 下 8×9 棋盘约 780×700 px，12×12 棋盘约 720×680 px。
- 相机位置：

```ts
const pitch = THREE.MathUtils.degToRad(60);
camera.position.set(0, dist * Math.sin(pitch), dist * Math.cos(pitch));
camera.lookAt(0, 0.25, 0.35);
```

- 窗口尺寸变化用 `ResizeObserver` 监听，立即重新适配（不做 400ms 缓动，避免旋转屏幕时棋盘短暂出画）。
- 竖屏时按宽度受限，距离会自动变远；不要旋转棋盘。
- 实测截图见 `docs/` 或 `.tmp` 下的验收截图；相机参数以 `GameRenderer.fitCamera()` 为准。

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
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

### 5.2 灯光

| 灯 | 参数 | 作用 |
| --- | --- | --- |
| HemisphereLight | 天 `#fff3dd` / 地 `#0a241e`，强度 0.34 | 基础环境光，避免死黑 |
| DirectionalLight（主） | `#ffe9c9`，强度 1.55，位置 `(-8, 16, 10)` | 暖色主光，投射阴影 |
| DirectionalLight（补） | `#8fc7ff`，强度 0.24，位置 `(9, 8, -8)` | 冷色补光，拉开层次 |
| Environment（PMREM） | RoomEnvironment；牌体 envMapIntensity 0.34 | 牌体边缘反射 |

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
- 牌体暖象牙 `#d2c1a5`，牌面纸色 `#f1e1c6`；**不要纯白**，否则在 ACES + 主光下会冲掉墨色。
- 牌面墨色整体加深（蓝 `#1b4f8f`、绿 `#196544`、红 `#94261f`、墨 `#1b2932`），保证缩小后仍可辨。
- 高辨识度构图：字牌用 154px 大字；万子数字与“萬”都用红色；筒一为花瓣轮盘，筒二至九用大号同心点；索二至九用带竹节/红色中段的竹签；花牌同时画数字、字与植物图标。
- 金色只用于选中/提示/粒子，不铺大面积。

---

## 6. 牌体与材质

### 6.1 几何

```ts
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const bodyGeo = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 3, CORNER_R);
```

- 所有牌共享同一份 `bodyGeo` 与 `faceGeo`。
- 圆角分段 3 足够；再高只会增加顶点数。
- 牌体不需要背面细节（不可见）。

### 6.2 材质

```ts
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0xd2c1a5,
  roughness: 0.56,
  metalness: 0.0,
  clearcoat: 0.12,
  clearcoatRoughness: 0.6,
  envMapIntensity: 0.34,
});
```

- 清漆层只保留很轻的一层，避免把牌体打成白色塑料高光。
- 牌面是**不受光照的印刷面**，用 `MeshBasicMaterial` 直接显示已烘焙的纸色与墨色：

```ts
const faceMat = new THREE.MeshBasicMaterial({ map: texture });
```

这样主光只会塑造牌体边缘和阴影，不会再把牌面纸色二次提亮；牌面也不再接收阴影。纸色/墨色的对比由 `facePainter` 直接控制。

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

1. **底色**：中心 `#f1e1c6` → 边缘 `#ddc8a5` 的径向渐变。
2. **纸纹**：约 1400 个 1px 的半透明噪点（`alpha 0.015–0.045`），避免纯色塑料感。
3. **内框**：距边 9px 的圆角矩形描边，`rgba(120, 90, 50, 0.18)`，宽 2px。
4. **雕刻**：
   - 每个图形先画一层向下偏移 1.5px 的暖白高光 `rgba(255, 250, 235, 0.8)`；
   - 再画主色；
   - 主色带 `shadowColor rgba(0,0,0,.28)`、`blur 1.4`、偏移 `(0,1)`；
   - 形成“凹刻 + 边缘受光”的错觉。
5. **边缘暗角**：上下边缘叠一层很淡的暖褐 shade，模拟牌面微凹。

> 关键：高光在下方、阴影在上方，才会像“刻进去”；反过来会像贴纸。当前用真实浏览器完整棋盘截图检查；`?faces=1` 画廊为后续开发工具。

### 7.4 筒（Dots）

- 1 筒是**花瓣轮盘**：蓝色外环 + 8 片红/绿花瓣 + 红色花心 + 金色圆心，和 2–9 的圆点明显区分。
- 2–9 为同心圆点：外环 + 实心圆心 + 左上高光；圆环宽度约为半径的 0.3。
- 圆点半径按密度取 20 / 18 / 16px，避免 9 筒挤在一起：

| 点数 | 排布 |
| --- | --- |
| 1 | 中心花瓣轮盘 |
| 2 | 上、下各 1 |
| 3 | 左上、中、右下 斜线 |
| 4 | 2 × 2 |
| 5 | 2 × 2 + 中心 |
| 6 | 2 列 × 3 行 |
| 7 | 上 3 + 中 1 + 下 3 |
| 8 | 2 列 × 4 行 |
| 9 | 3 × 3 |

- 配色：蓝 `#1b4f8f`、绿 `#196544`、红 `#94261f` 交替；1 筒用红/绿花瓣 + 蓝环。

### 7.5 索（Bamboo）

- 竹签：圆角矩形 + 3 条横向竹节 + 深色描边 + 浅色高光；绿 `#196544` 为主。
- 5 / 7 / 9 索的中间一根用红色 `#94261f` 作强调，其余保持绿色，避免和万子混淆。
- 1 索：传统鸟形。椭圆身体 + 三角尾羽 + 小圆头 + 红喙 + 爪，整体放大 6%，绿/蓝/红三色。
- 2–9 索排布与筒一致，但用竹签而非圆点：

| 点数 | 排布 |
| --- | --- |
| 2 | 2 根竖排 |
| 3 | 左上、中、右下 斜线 |
| 4 | 2 × 2 |
| 5 | 2 × 2 + 中心红签 |
| 6 | 2 列 × 3 行 |
| 7 | 上 3 + 中 1 + 下 3 |
| 8 | 2 列 × 4 行 |
| 9 | 3 × 3 |

### 7.6 万（Characters）

- 上部：汉字数字“一”–“九”，约 90px，朱红。
- 下部：“萬”，约 104px，同朱红。
- 不再画中间分隔线，保持两行大字满版构图，提高小尺寸识别。
- 字体：楷体优先，字重 700。

### 7.7 字牌（Honors）

- 单字居中，约 154px，字重 700：
  - 东/南/西/北：墨黑 `#1b2932`；
  - 中：朱红 `#a8261e`；
  - 发：墨绿 `#1c6b3c`；
  - 白：蓝色圆角空心框（156×188），双线框，内部留白；不写“白”字。
- 字牌笔画粗，缩小后仍可辨。

### 7.8 花牌（Flowers）

- **数字 + 大字 + 植物图标**三层构图：
  - 左上角红色数字 1–4（季节组与花组各自编号）；
  - 中部大字：季节组青绿 `#2b7a5a`，花组绛红 `#9e2937`；
  - 底部植物图标：春/夏/秋/冬/梅为花瓣，蘭为兰叶+小花，竹为竹竿+叶，菊为放射花瓣。
- 数字和图标只做装饰与识别，不改变“季节 4 张互通、花组 4 张互通”的配对规则。
- 图标高度约 50px，位于大字下方，不能压住主字。

### 7.9 字体与降级

```ts
const FONT_SERIF = '"KaiTi","STKaiti","Kaiti SC","Noto Serif SC","SimSun",serif';
const FONT_SANS  = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
```

- 汉字统一用 `FONT_SERIF`；数字/装饰可用 `FONT_SANS`。
- 字体缺失时系统 serif 兜底；不阻塞纹理生成。
- 绘制前用 `ctx.measureText` 校验宽度，超宽则缩小字号（`fitText`）。
- 后续可选：内置一份子集化宋体/楷体 woff2，保证跨平台一致。

### 7.10 调试画廊（后续开发工具）

- 路由 `?faces=1`：以 7×6 网格展示 42 张牌面（2D canvas 直接 `toDataURL` 或绘制到页面）。
- 支持按牌种筛选、放大单张、显示尺寸/耗时。
- M5 已用真实浏览器截图逐张检查 144 张完整棋盘；画廊作为后续开发工具，不阻塞交付。

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
- 选中：牌体抬升 `+0.18`；牌面上方 `0.012` 放一张金色圆角描边平面（1.3×1.58，Canvas 纹理），比牌体略大，形成清晰的“描金框”。
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

- 粒子：`Points`，加法混合，金色 `#ffd27a`，寿命 0.7s，初速度向上锥形，重力 -3；低画质/减少动效时关闭。
- 冲击环：平面圆环纹理，scale 0.4→2.2，opacity 0.9→0。
- 若同时触发胜利，延后 600ms 再拉远相机。

### 9.5 失败回弹

- 整串以 `expoOut` 回到起点，`280ms`，带 4% 过冲。
- 牌面边缘闪一次红光（叠加红色描边平面，`opacity 0.5→0`，200ms）。
- 轻微相机震动（`±0.03`，120ms），可在低画质/减少动效时关闭。
- Toast：“落点无法配对”。

### 9.6 胜利

- 相机后拉 8%，`600ms`；
- 金色粒子从上方缓缓落下（60–100 个）；
- 桌面亮度略升；
- 800ms 后弹出结算面板（HTML）。

### 9.7 死局

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
- 支持 `killByTarget(target)`，用于重开/卸载时取消旧动画。
- 同一 target 的同一属性后加入的 tween 覆盖先前的（先 kill）。

### 10.2 缓动

- `linear`
- `cubicOut`：抬升/落位
- `backOut`：回弹/落位
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

- 牌体 `RoundedBoxGeometry` 分段 4 时约 1.5k 三角形/张 × 144 ≈ 216k，略超预算；可把分段降到 3 或在后续用 InstancedMesh。首版以观感优先，实测再调。

### 12.2 降级策略

| 档位 | DPR | 阴影 | 粒子 | 环境反射 | 视差 |
| --- | --- | --- | --- | --- | --- |
| 高 | min(dpr, 2) | 2048 | 32/次 | 开 | 开 |
| 中 | 1.75 | 1024 | 16/次 | 开 | 开 |
| 低 | 1.25 | 关 | 0 | 关 | 关 |

- 自动：连续 2s 平均帧时间 > 22ms → 降一档；只降不升，避免抖动。
- 用户可在设置中手动选“高/中/低/自动”。
- 切后台暂停 RAF；恢复时重置 `clock`，避免大 `dt`。

### 12.3 可选优化（后续）

- 牌体 `RoundedBoxGeometry` 分段 4 时约 1.5k 三角形/张 × 144 ≈ 216k，略超预算；可把分段降到 3 或用 InstancedMesh。
- 当前自动画质：平均帧时间 >24ms 时从 high 降到 medium；用户也可手动选低画质。
- 低画质：DPR 1.25、关闭阴影与粒子；中画质：DPR 1.75、1024 阴影、14 粒子。

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
| `?mode=easy\|medium\|full` | 预填菜单模式 |
| `?seed=12345` | 预填种子（也可在菜单输入） |
| `?faces=1` | 42 张牌面画廊（后续开发工具） |
| `?debug=1` | 暴露 `window.__mahj` 调试 API，并跳过首次引导 |
| 设置面板 | 音效、画质（自动/高/中/低）、动效（跟随系统/减少） |

### 14.2 验收清单

- [x] 42 张牌面无溢出、无错字、无上下颠倒；缩到 64px 仍可辨（完整模式截图）。
- [x] 12×12 棋盘完整入画；横竖屏、16:9/16:10/21:9 均不被 HUD 遮挡。
- [x] 牌与牌之间无 z-fighting；牌面无摩尔纹。
- [x] 阴影无 acne、无 peter-panning；牌底有接触感。
- [x] 选中/悬停/拖动/消除/回弹动效时长正确，无卡顿。
- [ ] 144 张牌场景 draw call、帧时间在预算内（需在目标设备实机测）。
- [x] 切换页面/重开无 WebGL context 泄漏（实测退出后 canvas 0、重开后 1）。
- [x] 低画质档可运行；`prefers-reduced-motion` 下动效收敛。

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
| WebGL 上下文丢失 | GPU 驱动重置/切后台 | 监听 `webglcontextlost` 阻止默认并暂停；`webglcontextrestored` 重建纹理与场景，提示“正在恢复” |

---

## 15. 实现顺序建议

1. 空场景 + 桌面 + 相机适配 + 一张牌（验证坐标、朝向、光照）。
2. 42 张牌面 2D 画廊（先不管 3D），逐张调美观。
3. 铺满 12×12 牌，验证 draw call、阴影、拾取。
4. 选中/悬停/拖动/消除/回弹动效。
5. 胜利/死局/低画质。
6. 性能优化（如需）。

先做“一张牌好看”，再做“一盘牌不卡”。
