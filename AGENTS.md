# AGENTS.md

本文件面向在此仓库工作的 AI 编码助手与人类开发者，记录**项目边界、架构不变量、命令与已知坑**。

## 项目是什么

浏览器端 3D 麻将消除游戏（代码名 `mahj`）。Vue 3 + Vite + TypeScript 前端，Three.js WebGL2 渲染；FastAPI 后端**只**提供模式配置、静态资源与生产环境 SPA 托管。

核心玩法：点选两张可配对且无阻挡的牌消除；或按住牌沿行/列拖动，带动连续牌串，落点成对则消除，否则整串回弹。

- **当前状态：M0–M6 完成，可交付**。三种模式可完整游玩；`frontend/src/core` 有 56 个 Vitest 用例通过；菜单、种子、3D 对局、HUD、暂停/结算、本地记录、移动端布局、程序化音效、消除粒子、画质/音效设置、减少动效与首次引导均已接通；`scripts/dev.cmd` / `build.cmd` 与最终回归已完成。
- 开始实现前，按顺序阅读：
  1. `docs/GAME_RULES.md` —— 规则唯一权威来源；
  2. `docs/PROJECT_PLAN.md` —— 架构、模块、路线；
  3. `docs/RENDERING.md` —— 3D 与牌面方案；
  4. `docs/ENVIRONMENT.md` —— 本机约束。

## 命令

```powershell
# 前端（普通环境）
cd frontend
npm install
npm run dev            # 5173，/api 代理到 8000
npm run test           # Vitest
npm run build          # vite build -> frontend/dist

# 前端（DSH 沙箱：Vite 的 net use 探测与 forks 池需要绕过）
npm run dev:sandbox
npm run build:sandbox
npm run test:sandbox

# 一键脚本（普通环境去掉 -Sandbox）
.\scripts\dev.cmd -Sandbox
.\scripts\build.cmd -Sandbox -Test

# 后端（DSH 中 python -m venv 的 ensurepip 会被拒，改用 uv）
cd backend
$env:UV_CACHE_DIR = '..\.uv-cache'
uv venv .venv --python 3.13
uv pip install --python .\.venv\Scripts\python.exe -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# 语法检查
.\.venv\Scripts\python -m py_compile app/main.py app/config.py app/schemas.py app/routers/*.py
```

## 架构不变量（必须遵守）

1. **`frontend/src/core/**` 是纯 TypeScript**：不得 import `three`、不得访问 `window`/`document`/DOM。所有规则可在 Node/Vitest 下运行。
2. **`GameSession` 是唯一权威状态**。渲染层与 Vue 只能读快照、播放动画，不得直接改棋盘。
3. **渲染层只读**：`src/render/**` 不实现规则（不判断可见性、不决定配对），只负责表现与拾取。
4. **所有随机走可播种 PRNG**（`core/rng.ts`）；同一 `seed` + 同一操作序列必须得到同一结果。禁止在核心逻辑中直接用 `Math.random()`。
5. **后端无游戏逻辑**：不接收对局操作、不存状态、不校验步数。只做 `GET /api/config`、`GET /api/assets/*`、`/api/health` 与静态托管。
6. **牌面/音效优先程序化生成**，不是必须依赖素材；后端资源接口保留给后续扩展。
7. **规则改动必须同步三处**：`docs/GAME_RULES.md` → `core` 实现 → `tests`。三者不一致时以文档为准，先改文档。

## 规则要点（摘要，详见 GAME_RULES.md）

- 可见：同行或同列，中间所有格为空；空格不阻挡，斜线/绕行不算。
- 花牌：季节组（春夏秋冬）互通、花组（梅兰竹菊）互通，跨组不可配；这是 144 张完整模式可全消的前提。
- 拖动牌串：被按住的牌 + **拖动方向上**连续相邻的牌；反方向不动；只能滑入空格，不能推挤/穿越。
- 拖动只判定**新形成**的配对：拖动前已可见的同类牌（例如两张相邻白板随串一起移动）不参与落点判定；想消除请直接点选。
- 同轴拖动不会“新造”同轴配对：行拖动 → 新配对通常是纵向，列拖动 → 新配对通常是横向。
- 落点优先当前锚牌；否则自动选最近的可见同牌；无候选则整串回弹，不写历史、不记步。
- 满盘时所有 `kMax = 0`，开局只能点选；必须先消出空格才能拖动。
- 死局：无点选对子且无任何可成对拖动；撤销上一步、重开本局或换一局，**不提供洗牌/棋盘重排**。不承诺任意随机布局必然可解。
- 单张辅助：两张被挡同牌若可通过**单张牌**滑动成对，第二次点选直接滑动+消除；需要推动连续牌串时不触发，仍手动拖。
- 多候选：拖动落点有多张可配对牌且无锚牌时，不自动选；高亮全部候选，点候选消除，点其它位置整串归位。
- 种子：无符号 32 位；输入十进制或 `0x` 十六进制；同模式 + 同种子必须生成同一初始棋盘；“重开本局”沿用 seed 但标记为自定义，“换一局”换新 seed 并恢复随机资格；自定义种子不计入最佳记录。

## 已知坑

- **npm 缓存**：默认 `%LocalAppData%\npm-cache` 在本会话沙箱下不可写（EPERM）。始终用 `--cache ..\.npm-cache` 或设置 `npm_config_cache`。`.npm-cache/` 已 gitignore。
- **pip/uv 缓存**同样受限：用 `--cache-dir` / `UV_CACHE_DIR` 指向项目内。
- **pnpm 未安装**：不要引入 pnpm 工作流；统一 npm + `package-lock.json`。
- **浏览器自动化**：普通沙箱无法启动 Edge（mojo IPC 被拒）；切到完整权限后可用 `playwright-core` + 本机 Edge 截图/点击/拖拽验收。不要假设 `npm run test` 在沙箱中可用，统一用 `test:sandbox`。
- **`?debug=1`**：在 `window.__mahj` 暴露快照、hint、findDrag、assistMove、findChoice、cellToScreen、tap/drag、uiState（含 awaitingChoice）；仅用于验收，不参与正常玩法。`?debug=1` 会跳过首次三步引导。
- **音效**：`render/audio.ts` 用 Web Audio 程序化合成，AudioContext 必须由首次用户手势创建；设置里的静音会 `suspend/resume`，不要在模块顶层 new AudioContext。
- **设置持久化**：`mahj.tutorial.v1` 与 `mahj.settings.v1` 存 localStorage；自动化测试用 `?debug=1` 跳过教程，或预先写入 storage。`settings.v1` 现包含 `lightIntensity` / `lightTemperature` / `tileRoughness` / `tileReflectivity`，加载时必须 clamp；`GameView` 监听四项并调用 `GameRenderer.setLighting()`。调试阶段 `LightingPanel.vue` 的 RENDER DEBUG 面板通过 `GameRenderer.setTuning()` 暴露 24 项高级参数，**不持久化**且覆盖基础设置；改参数映射时同步更新 `DEFAULT_RENDER_TUNING`。
- **画质档位**：`GameRenderer.setQuality()` 控制 DPR/阴影/粒子；低画质关闭阴影与粒子，自动档在平均帧时间 >24ms 时降到 medium。不要在渲染循环里反复重建 renderer。
- **Node 24 + Vite 8**：满足 engines；但 **TypeScript 锁 5.9.x**，不要升到 7.x（`vue-tsc` 生态未验证）。
- **Three.js 0.186 只支持 WebGL2**；不要写 WebGL1 回退渲染器。
- **Three.js addons 路径**：`three/addons/geometries/RoundedBoxGeometry.js`、`three/addons/environments/RoomEnvironment.js`。版本升级前先查 API。
- **HMR / 重开**：`GameRenderer` 必须在 `onBeforeUnmount` 调用 `dispose()`（几何、材质、纹理、renderer、canvas），否则多次挂载会泄漏 WebGL context。
- **响应式**：不要把 Three.js 对象放进 Vue `reactive`/Pinia 深层响应式；用普通变量或 `shallowRef`。
- **纹理颜色空间**：CanvasTexture 必须设 `SRGBColorSpace`，否则牌面发灰/过曝。
- **牌面**：当前使用 `src/render/imahjong/` 的 V2 轮廓管线（`hk-contours.js` + `tile-segmentation.js` + `tile-renderer.js`）。牌面在运行时**不加载字体**，不要重新引入 `fillText` 牌面；源字体与 M+ 授权在 `src/assets/fonts/`，`hk-contours.js` 是生成产物。
- **牌面外框**：轮廓数据已剔除整牌边框；边框由 3D 牌体承担。白板内框在 `facePainter.ts` 里单独补画，否则会空白。
- **牌面光照**：牌面用 `MeshPhysicalMaterial`（`map` + `bumpMap`、无 `emissive`），干净亚克力底 + 深色填漆；暗色墨层同时作为高度场形成浅阴刻。`TileFactory.setFaceAppearance()` 让粗糙度/反光滑杆作用于牌面；牌面边缘另有一层只覆盖边框的 additive 高光，不能改成覆盖整张牌面的白色反光层，否则会洗掉刻痕对比度。
- **拾取坐标**：NDC 用 `canvas.getBoundingClientRect()`，不是 `window.innerWidth`。
- **相机适配**：棋盘为竖长格（`CELL_D = 1.25`），别按正方形算范围。
- **种子**：0 是合法 seed，“未输入”用 `null`；URL 的 `?seed=` 必须走同一套校验；随机 seed 用 `crypto.getRandomValues`，不要用 `Math.random` 生成开局布局。
- **DSH 沙箱**：Vite 8 会执行 `net use` 探测网络盘，`scripts/sandbox-preload.cjs` 只拦截这一条命令；Vitest 必须用 `--pool=threads`（forks 会 spawn 子进程被拒）。这只影响本会话，普通环境用 `npm run dev/build/test` 即可。

## 代码约定

- TypeScript `strict: true`；避免 `any`，公共函数写显式返回类型。
- 核心逻辑用不可变数据：操作返回新 `BoardSnapshot`，不原地改旧状态。
- 坐标统一 `(row, col)`；渲染层负责转世界坐标，核心层不出现 `x/z`。
- 动画时长/缓动集中放在 `render/tween.ts` 或常量文件，不散落魔法数。
- 新增规则必须先补测试；测试命名用行为描述（`it('blocks pair when a tile sits between')`）。
- UI 文案中文；代码标识符英文。

## 验证（每个里程碑）

1. `cd frontend && npm run test`（M2 起）
2. `cd frontend && npm run build`
3. `cd backend && python -m py_compile ...`
4. 手动回归矩阵见 `docs/PROJECT_PLAN.md` 的 13.2 节，自动化用例见 `docs/GAME_RULES.md#11-测试矩阵`
5. 3D/UI 改动后检查 `?debug=1` 与真实浏览器截图/控制台；确认无 console error、无 WebGL context 泄漏
6. M5 之后补测：首次引导、设置持久化、低画质、静音/音效、快捷键与移动端 HUD

## 文档维护

- 规则/数值变化 → 更新 `docs/GAME_RULES.md`，再改实现与测试。
- 技术栈/目录/里程碑变化 → 更新 `docs/PROJECT_PLAN.md`。
- 环境/依赖/沙箱限制变化 → 更新 `docs/ENVIRONMENT.md`。
- 新增坑或约定 → 更新本文件。
- 文档中的版本号以 `docs/ENVIRONMENT.md` 实测为准。
