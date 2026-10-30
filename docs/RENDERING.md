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
| `TILE_W` | 0.984 | 牌宽 |
| `TILE_D` | 1.234 | 牌长 |
| `TILE_H` | 0.34 | 牌厚 |
| `CORNER_R` | 0.095 | 圆角半径 |
| 间隙 | 0.016 / 0.016 | 牌与格边的左右/前后留白；靠圆角读缝，几乎贴合 |

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
| `fov` | 34°（默认，滚轮 22–50°） |
| 俯仰角 | 初始约 60°（从水平面算） |
| 相机高度 | 固定为初始 fit 高度，缩放/平移/旋转都不改 Y |
| 朝向 | 默认沿 +Z 看向原点，无侧倾 |
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

- 窗口尺寸变化用 `ResizeObserver` 监听，只更新 aspect 并保持用户当前的旋转/平移/FOV；首次挂载才重新 fit，避免旋转屏幕时丢失视角。
- 竖屏时按宽度受限；不要把棋盘本身旋转，旋转只改相机。
- 实测截图见 `docs/` 或 `.tmp` 下的验收截图；相机参数以 `GameRenderer.fitCamera()` 为准。

### 4.3 交互控制

相机始终在桌面上方固定高度：

- **滚轮**：只改 `camera.fov`，范围 22–50°，不改相机高度/距离；
- **右键拖动**：相机绕当前目标点水平环绕，并可按垂直拖动改变观察半径（仍是固定高度），yaw 限制 ±60°；观察半径可从约 `0.02×fit`（向下拖，接近正向下）到 `1.8×fit`（向上拖，更斜的视角）；
- **中键拖动**：在水平面平移观察目标，目标点限制在棋盘范围内，相机高度不变；
- 所有相机变换只改相机，不改棋盘坐标；拾取使用当前相机矩阵。
- 右键/中键按下时捕获 pointer，并阻止 `contextmenu`/`auxclick`；左键的牌面点选和拖动逻辑不变。

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
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

### 5.2 灯光

| 灯 | 参数 | 作用 |
| --- | --- | --- |
| HemisphereLight | 天 `#fff3dd` / 地 `#0a241e`，强度 0.34 | 基础环境光，避免死黑 |
| DirectionalLight（主） | `#ffe9c9`，强度 1.55，位置 `(-8, 16, 10)` | 暖色主光，投射阴影 |
| DirectionalLight（补） | 色温联动冷色，强度 0.24，位置 `(9, 8, -8)` | 冷色补光，拉开层次 |
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
- 牌体 `#dee7da`，牌面亚克力底 `#eeece8`；墨层 `#0d1110`、红 `#df2029`、绿 `#114f37`，避免在灯光下冲淡。
- 牌面墨色整体加深（蓝 `#1b4f8f`、绿 `#196544`、红 `#94261f`、墨 `#1b2932`），保证缩小后仍可辨。
- 高辨识度构图：字牌用 154px 大字；万子数字与“萬”都用红色；筒一为花瓣轮盘，筒二至九用大号同心点；索二至九用带竹节/红色中段的竹签；花牌同时画数字、字与植物图标。
- 金色只用于选中/提示/粒子，不铺大面积。

---

## 6. 牌体与材质

### 6.1 几何

```ts
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const bodyGeo = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 4, CORNER_R);
```

- 所有牌共享同一份 `bodyGeo` 与 `faceGeo`。
- 圆角分段 4，半径 0.095；牌体放大到接近格距，牌与牌几乎贴合，靠圆角和倒角读缝。
- 牌体不需要背面细节（不可见）。

### 6.2 材质

```ts
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0xdee7da,
  roughness: 0.56,
  metalness: 0.0,
  clearcoat: 0.12,
  clearcoatRoughness: 0.6,
  envMapIntensity: 0.34,
});
```

- 清漆层只保留很轻的一层，避免把牌体打成白色塑料高光。
- 牌面按“亚克力本体 + 阴刻填漆”处理：干净象牙白亚克力底，深色墨层，凹槽边缘有暗边；牌面使用受光的 `MeshPhysicalMaterial`：

```ts
const faceMat = new THREE.MeshPhysicalMaterial({
  map: texture,
  normalMap: normalTexture,
  normalScale: new THREE.Vector2(0.36, 0.36),
  roughness: 0.82,
  metalness: 0,
  clearcoat: 0.04,
  clearcoatRoughness: 0.35,
  envMapIntensity: 0.05,
});
```

- 不使用 `MeshBasicMaterial`，也不设置 `emissive`；牌面会随主光/色温/曝光变化，不再“自发光”。
- 用牌面明度生成**独立灰度高程图**，再生成 normal map；白色亚克力高、红/绿/黑墨层低，形成阴刻。`normalScale` 由“阴刻高度”控制。
- 同时把阴刻高度用于烘焙**凹槽暗边**（blur/offset 随高度增大），保证在顶部视角和 45px 牌面下也有可见反馈。
- 纹样外圈暗边和干净亚克力底保证 144 张棋盘缩小后仍能读清。
- 牌面 `receiveShadow = true`；纸色/墨色的对比由 `facePainter` 和深色填漆直接控制，光照只做明暗和轻微清漆反射。
- 牌面边缘另有一层很淡的亚克力边缘高光，只覆盖边框、不覆盖中间刻痕，避免把字面洗白。

参考工艺：亚克力牌体、0.3mm 左右激光阴刻后填漆；实时渲染用 bump/normal 近似阴刻，避免逐牌高模。

- [Wetop：亚克力麻将牌与雕刻/填漆工艺流程](https://wetopacrylic.com/guide/mahjong-tile-engraving-laser-vs-uv-vs-cnc/)
- [Booth：多边形阴刻麻将牌模型（V 形槽、0.4mm 平凹、法线阴影）](https://booth.pm/en/items/8910883)
- [mahjong.wtf：用 bump map 模拟麻将阴刻的 Blender 流程](https://mahjong.wtf/?p=843)

### 6.3 牌面贴合



- `PlaneGeometry(TILE_W * 0.94, TILE_D * 0.94)`，`rotateX(-Math.PI / 2)`。
- 放在牌体顶面上方 `0.002`，避免 z-fighting。
- 纹理 UV 方向：平面局部 `+Y` 旋转后指向 `-Z`（远端），保证文字从近端看是正的。
- 若出现上下颠倒，优先检查 `flipY` 与这里的旋转，而不是改 UV。

### 6.4 拾取

- `Raycaster` 与 `body` 求交（圆角盒比平面更贴合视觉）。
- `body.userData.tileId = id`；命中后向上找到 `TileView`。
- 每帧复用 `raycaster` 与 `Vector2`，不新建对象。

### 6.5 可调光照与牌面材质

室内光按“顶部主光 + 墙面反弹 + 正面柔和补光”处理：

- 主光：方向光，位置 `(-4, 18, 8)`，色温 4300K，保留阴影；
- 墙面/天光：半球光，sky 暖白、ground `#b8a88e`，模拟室内墙面的漫反射；另有低强度 `AmbientLight` 作为 wall bounce，因为半球光 ground 只影响朝下法线，桌面和牌面朝上时几乎看不到墙面色；
- 补光：正面 `(7, 7, 12)`、5900K、低强度，避免暗部死黑；
- 使用 SSAO 产生牌与牌、牌与桌面的接触阴影。没有 AO 时，材质即使不是 emissive 也会因为缺少环境遮蔽而“浮起来、像自己在发光”。

`SettingsPanel` 保留四个基础滑杆，数值持久化到 `mahj.settings.v1`；`GameView` 监听 store 并调用 `GameRenderer.setLighting()`。调试阶段对局右侧固定显示 `LightingPanel.vue` 的 **RENDER DEBUG** 面板，复用同一渲染管线但不改结构，提供 25 个实时滑杆（灯光强度/色温/位置、曝光、牌体 PBR、牌面 PBR/清漆/反射、阴刻高度/金属度、边缘高光）和 **牌面底色/牌体颜色/墙面反射/墨色/红色/绿色** 六个颜色选择器；内部滚动、可折叠。高级参数覆盖基础设置，刷新后回到默认值。

改牌面底色/墨色/红/绿通过 `setLayerColors()` / `FacePainter.setBaseColor()` 更新轮廓绘制调色板与底色，`TileFactory.setFaceColor()` / `setFacePalette()` 重新生成 42 张牌面的 map/normalMap/metalnessMap；改牌体颜色直接更新 `MeshPhysicalMaterial.color`，改墙面色同时更新半球光 groundColor 和 wall-bounce ambient 的颜色；颜色和阴刻高度输入做了 120ms 防抖，避免反复重烘焙。阴刻金属度通过只在填漆区域生效的 metalnessMap 控制，牌面底色保持非金属。

参考：
- [Chaos：室内 3D 渲染的灯光基础](https://blog.chaos.com/lighting-basics-for-3d-rendering-in-enscape)（区域光、自然反弹、暖/冷色温、HDRI）
- [Autodesk：Ambient Occlusion](https://download.autodesk.com/us/3dsmax/2012help/files/GUID-88D3C277-BEFA-4742-B953-3CB377809FA-1954.htm)（AO 用于接触阴影和凹陷，避免物体“漂浮”）

| 控件 | store 字段 | 范围 | 默认 | 作用 |
| --- | --- | --- | --- | --- |
| 光照强度 | `lightIntensity` | 0.35–1.80 | 0.90 | 等比缩放主光/补光/半球光 |
| 色温 | `lightTemperature` | 2700–6500 K | 4300 K | 主光黑体色；补光更冷、半球光略暖 |
| 反光强度 | `tileReflectivity` | 0–1.20 | 0.18 | `envMapIntensity` + clearcoat + 牌面边缘高光 |
| 牌面粗糙度 | `tileRoughness` | 0.18–0.95 | 0.68 | 牌体/牌面粗糙度与边缘高光扩散 |

实现要点：

- 色温用近似黑体辐射公式转 `THREE.Color`，设置主光、补光与半球光颜色；
- 光强影响灯光，并映射到 `toneMappingExposure`（0.55–0.95）；牌面是受光材质，会一起变亮/变暗；
- 牌面用 `MeshPhysicalMaterial` + normal map（由独立高程图生成）、随高度变化的凹槽暗边、clearcoat 和边缘高光；中间刻痕区域不叠白色反光，保证缩小后填漆线条仍然清晰；
- 粗糙度/反光同时作用于牌体和牌面；反光层只覆盖牌面边缘，不覆盖刻痕；
- 默认值按室内顶部主光 + 暖色墙面/天光半球光 + 柔和正面补光设置：主光 1.395、补光 0.252、半球光 0.495、曝光 0.704；墙面 groundColor `#b8a88e`；
- SSAO 只在中/高画质启用，用于牌与牌、牌与桌面的接触阴影；低画质关闭。
- EffectComposer 的离屏 target 使用 **4x MSAA + HalfFloat**；只开 `WebGLRenderer({ antialias: true })` 不会给后处理离屏 buffer 抗锯齿，牌边会出现犬牙。
- “恢复默认光照”只重置四项外观参数，不动音效/画质/动效。

---

## 7. 牌面纹理（程序化）

> **当前实现（2026-10-30）**：已切换到 V2 的 **I.Mahjong-HK 轮廓管线**，见 §7.11；下面 7.1–7.10 是历史手绘方案，保留作设计参考。当前游戏不再在运行时加载牌面字体。

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

1. **底色**：中心 `#faf4e4` → 边缘 `#e8d8b8` 的线性渐变（256×320 纹理直接绘制）。
2. **纸纹**：约 110 个确定性噪点（按牌 id 走 FNV/mulberry32），避免纯色塑料感。
3. **内框**：距边 6px 的圆角矩形描边，`rgba(133, 115, 77, 0.32)`，宽 1.2px。
4. **构图坐标**：内容在 `120×160` 设计空间绘制，放大 2×并居中到 256×320 纹理（左右各 8px 纸边）。
5. **雕刻**：
   - 图形先画主色，再用同色 `strokeText` 加粗（万子数字 4px、萬 6px、發 7px、東 7.5px 设计宽度）；
   - 牌面不做阴影/浮雕，避免与 3D 牌体的阴影重复。

> 关键：高光在下方、阴影在上方，才会像“刻进去”；反过来会像贴纸。当前用真实浏览器完整棋盘截图检查；`?faces=1` 画廊为后续开发工具。

### 7.4 筒（Dots）

- 1 筒是**罗盘花心**：外圈 44、内圈 35、20 条放射刻线、8 个象牙点、红色花心；和 2–9 的同心圆点明显区分。
- 2–9 为同心圆点：外环 + 内环 + 实心圆心 + 象牙高光；外环宽度约为半径的 0.32。
- 圆点半径按密度取 14–22px，整体比参考包更饱满，避免小尺寸下“圈太小”：

| 点数 | 排布 |
| --- | --- |
| 1 | 中心罗盘花心 |
| 2 | 上、下各 1 |
| 3 | 左上、中、右下 斜线 |
| 4 | 2 × 2 |
| 5 | 2 × 2 + 中心 |
| 6 | 3 列 × 2 行 |
| 7 | 上 3（斜线）+ 下 4 |
| 8 | 2 列 × 4 行 |
| 9 | 3 × 3 |

- 配色：蓝 `#1b4f8f`、绿 `#175c3f`、红 `#c72c32` 交替；1 筒用绿色罗盘 + 红色花心。

### 7.5 索（Bamboo）

- 竹签：象牙白填充 + 绿色/红色描边 + 2 道竹节 + 浅色高光；绿 `#175c3f` 为主。
- 5/7/9 索的中间/顶部竹签用红色 `#c72c32` 作强调，其余保持绿色。
- 1 索：传统鸟形（象牙白填充 + 绿描边 + 红顶冠）。
- 8 索：**上方 W、下方倒 M**，由 8 段带竹节/高光的粗竹段组成，对应参考图的折叠竹形。
- 2–9 索排布与筒一致，但用竹签而非圆点：

| 点数 | 排布 |
| --- | --- |
| 2 | 2 根竖排 |
| 3 | 左上、中、右下 斜线 |
| 4 | 2 × 2 |
| 5 | 2 × 2 + 中心红签 |
| 6 | 3 列 × 2 行 |
| 7 | 上 3 + 下 4 |
| 8 | 上方 W + 下方倒 M，共 8 段竹节 |
| 9 | 3 × 3 |

### 7.6 万（Characters）

- 上部：汉字数字“一”–“九”，约 62–64px，**黑色**，字重靠 `strokeText` 加粗（4px）。
- 下部：“萬”，约 72px，**朱红**，使用 `MahjongTraditional` 字体并加粗（6px）。
- 五万使用“伍”（传统牌面写法），不是“五”。
- 不再画中间分隔线，保持两行大字满版构图，提高小尺寸识别。

### 7.7 字牌（Honors）

- 单字居中，约 86–98px：
  - 东：**繁体“東”**，`MahjongTraditional` + 7.5px 描边；
  - 南/西/北：`MahjongBrush` + 2.2px 描边，墨黑 `#18231d`；
  - 中：朱红 `#c72c32`；
  - 发：**繁体“發”**，`MahjongTraditional` + 7px 描边，墨绿 `#175c3f`；
  - 白：蓝色圆角空心框（64×108 设计尺寸），双线框，内部留白；不写“白”字。
- 東/發/萬必须使用内置 `MahjongTraditional`，避免系统字体回退造成缺字或风格跳变。

### 7.8 花牌（Flowers）

- **数字 + 大字 + 植物图标**三层构图：
  - 顶部左右两个标签：数字用红色、花名用组色，字号 46（设计空间），比参考包更大；
  - 季节组：数字 1–4，花名青绿 `#175c3f`，标签顺序“数字在左、字在右”；
  - 花组：数字 1/2/4/3，花名绛红 `#c72c32`，标签顺序“字在左、数字在右”；
  - 底部植物图标：春/夏/秋/冬/梅为花瓣与枝叶，兰为兰叶+小花，竹为竹竿+叶，菊为放射花瓣。
- 数字和图标只做装饰与识别，不改变“季节 4 张互通、花组 4 张互通”的配对规则。

### 7.9 字体与降级

```ts
const BRUSH_FONT =
  'MahjongBrush, MahjongTraditional, "Noto Serif CJK TC", "Songti TC", "KaiTi", serif';
const TRADITIONAL_FONT =
  'MahjongTraditional, "Noto Serif CJK TC", "Songti TC", "KaiTi", serif';
```

- 内置两份 OFL 子集字体：
  - `frontend/src/assets/fonts/mahjong-brush.ttf`：Ma Shan Zheng 子集，负责一~九、中/南/西/北、花名等；
  - `mahjong-traditional.ttf`：LXGW WenKai TC 子集，只包含 **東 / 發 / 萬**，专门补繁体大字。
- `main.ts` 在挂载 Vue 前 `await document.fonts.load(...)`，保证纹理烘焙时字体已就绪；失败时回退系统 serif，不阻塞启动。
- 東/發/萬使用 `TRADITIONAL_FONT` 并叠加 `strokeText`；一~九、南/西/北、花名使用 `BRUSH_FONT` 并加粗。
- 许可证见 `frontend/src/assets/fonts/FONT-LICENSE.txt` 与 `TRADITIONAL-FONT-LICENSE.txt`。

### 7.10 调试画廊（后续开发工具）

- 路由 `?faces=1`：以 7×6 网格展示 42 张牌面（2D canvas 直接 `toDataURL` 或绘制到页面）。
- 支持按牌种筛选、放大单张、显示尺寸/耗时。
- M5 已用真实浏览器截图逐张检查 144 张完整棋盘；画廊作为后续开发工具，不阻塞交付。

### 7.11 当前实现：I.Mahjong-HK V2 轮廓管线

- **源字形**：`I.Mahjong-HK.otf`（M+ Font License），只作为生成源，不在运行时加载。
- **轮廓数据**：`frontend/src/render/imahjong/hk-contours.js`，42 张牌按独立轮廓组保存，已剔除整牌外框；每组还带 `sub` 子路径，供局部上色/裁剪。
- **颜色配方**：`tile-segmentation.js` 按牌种分配 ink / red / green 层：
  - 万子：上半数字 ink，下半“萬” red；
  - 筒子：按点数决定基色与红/黑强调；1/5/7/9 有专门配方；
  - 索子：绿色竹签，1/5/7/9 有红色强调；
  - 花牌：按轮廓索引和裁剪区域给花瓣/花心/叶子着色；
  - 白板：由 3D 牌面上的自定义内框表现。
- **绘制**：`tile-renderer.js` 在 120×160 设计空间逐层 `Path2D` 绘制；`facePainter.ts` 将其放大 2×到 256×320，保留 8px 纸边，再贴到 3D 牌体。
- **外框**：牌面轮廓中不含牌框；3D 牌体负责圆角/厚度/阴影，避免双层框。
- **无字体依赖**：牌面烘焙不调用 `fillText`，规避字体加载失败、emoji 回退和不同机器字形差异。
- **验收**：V2 包自带的 1 筒/白板轮廓重合校验为 99.97% / 100%；当前 3D 棋盘的 144 张完整模式已逐张检查。
- **授权**：`src/assets/fonts/I-MAHJONG-LICENSE.md`；源 OTF 与轮廓文件一并保留，便于重新生成。

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
