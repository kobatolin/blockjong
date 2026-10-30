# 麻将消消乐 · Mahjong Slide

> 一款浏览器里的 **3D 麻将消除游戏**：点选同牌消除，或按住牌沿行/列拖动，带着连续牌串寻找新的配对。
>
> 三种规模：简单 8×9、中等 9×12、完整 12×12。
>
> **当前状态：M6 完成，可交付。** 三种模式可完整游玩；音效、消除粒子、画质/音效设置、减少动效与首次三步引导已加入。核心逻辑 56 个单测通过，`scripts/build.cmd -Test` 一键构建通过，并完成 Edge + Playwright 真实 WebGL2 回归。

---

## 这是什么

- **3D 表现**：Three.js WebGL2，象牙白麻将牌、雕刻牌面、墨绿毛毡桌面、暖光与投影。
- **相机操作**：相机高度固定；滚轮只改 FOV（22–50°），右键拖动改变水平观察角/观察半径，中键在桌面平面平移观察中心；左键仍只负责点选和拖动牌。
- **纯前端运算**：布局生成、合法性判定、拖动、消除、撤销、死局检测全部在浏览器完成。
- **后端只做资源分发**：FastAPI 提供模式配置、静态资源与生产环境的 SPA 托管，不保存对局状态。
- **程序化牌面**：42 种牌面来自 **I.Mahjong-HK** 的矢量轮廓，按 V3 的轮廓分组/颜色配方分层绘制（筒子 2/4/5 的配色见 `docs/RENDERING.md` §7.11）；牌面采用“干净亚克力底 + 深色填漆 + bump 浅阴刻”的高对比方案，不依赖运行时字体，保留 3D 牌体。
- **可复现布局**：同模式 + 同种子生成同一棋盘，支持复制种子与分享链接。
- **单张辅助**：两张同牌被挡住、但只靠一张牌滑动就能成对时，直接连点两张即可消除，省去一次拖动；需要推动连续牌串时仍走拖动。
- **多候选待选**：拖动落点能看到多张可配对的牌时，高亮全部候选，由玩家点击决定消除哪一张；点其它位置则整串归位。
- **声音与画质**：程序化 Web Audio 音效、可静音；画质自动/高/中/低，低画质关闭阴影与粒子；减少动效。
- **光照与材质可调**：设置内有四个基础滑杆；调试阶段对局右侧另有 **RENDER DEBUG** 面板，可调主光/补光/半球光/点光的强度/色温/位置、曝光、牌体与牌面的 PBR/清漆/环境反射、阴刻高度/金属度、边缘高光等 29 个滑杆，以及**牌面底色、牌体颜色、墙面反射、墨色、红色、绿色**六个颜色选择器；改牌面纹理相关颜色会重烘焙，全部实时生效并显示数值。
- **首次引导**：第一次进入对局时显示 3 步玩法说明，可跳过，之后不再出现。
- **快捷键**：`U` 撤销、`H` 提示、`P` 暂停、`R` 重开、`Esc` 关闭弹窗。

## 玩法

1. 棋盘随机铺满牌。
2. 点选两张**可配对**且**在同一行/列、中间无牌阻挡**的牌，即可消除。
3. 如果两张同牌被挡住，但其中一张能**单独滑动**后与另一张成对，直接依次点击两张也会自动完成这次单张滑动并消除。
4. 按住一张牌，向行或列方向拖动：被按住的牌与拖动方向上**连续相邻**的牌一起平移。
5. 松手时，被拖动的牌必须在新位置与另一张牌形成**原本不存在的新通路**，才能消除；拖动前已经直接可见的配对不会被拖动再次消除，请直接点选。
6. 如果落点同时出现**多张高亮候选**，点击其中一张消除它；点击其它位置则整串牌归位。

完整模式的花牌采用同组配对：春/夏/秋/冬 互通，梅/兰/竹/菊 互通。规则细节与边界情况见 [`docs/GAME_RULES.md`](docs/GAME_RULES.md)。

> 游戏内**没有洗牌**，棋盘不会在游戏中途被重排。无可行操作时，可以撤销上一步、重开本局或换一局。

## 模式

| 模式 | 布局 | 牌数 | 牌种 |
| --- | --- | --- | --- |
| 简单 | 8 行 × 9 列 | 72 | 筒、索 |
| 中等 | 9 行 × 12 列 | 108 | 筒、索、万 |
| 完整 | 12 行 × 12 列 | 144 | 筒、索、万、字牌、花牌 |

## 种子与分享

- 主菜单可选输入种子，**留空 = 随机**。
- 支持十进制 `0–4294967295`，或 `0x` 开头的十六进制（如 `0xA1B2C3D4`）。
- 同一模式 + 同一种子 → 同一初始布局；「重开本局」沿用种子（同种子重开不计入最佳），「换一局」生成新种子。
- 游戏中可复制种子，或复制分享链接：`?mode=full&seed=2712847316`。
- 自定义种子完成的对局不计入最佳记录，避免用简单种子刷记录。
- 刷新页面会用 URL 中的种子预填菜单，但不会恢复对局进度。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Vue 3.5 + TypeScript 5.9 + Vite 8 |
| 3D | Three.js 0.186（WebGL2） |
| 状态 | Pinia 4 |
| 测试 | Vitest 5 |
| 后端 | FastAPI + Uvicorn（仅配置/资源） |
| 样式 | 原生 CSS + 设计变量 |
| 音频 | Web Audio 程序化合成（已接入） |
| 牌面字体 | I.Mahjong-HK 轮廓（M+ Font License） |
| 牌面绘制 | 轮廓分组 + 颜色配方，Canvas 2D 分层 |

## 文档

| 文档 | 内容 |
| --- | --- |
| [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) | 目标、架构、模块、里程碑、风险、待确认决策 |
| [`docs/GAME_RULES.md`](docs/GAME_RULES.md) | 规则的形式化定义、算法、图例、测试矩阵 |
| [`docs/RENDERING.md`](docs/RENDERING.md) | 3D 场景、牌面生成、光照、动效、性能预算 |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | 本机环境检查与开发约束 |
| [`AGENTS.md`](AGENTS.md) | 协作约定与架构不变量 |

## 开发运行

```powershell
# 一条命令启动后端 + 前端（需要先安装依赖，见下方说明）
.\scripts\dev.cmd -Sandbox
```

也可以分别启动：

```powershell
# 前端依赖（必须使用项目内缓存；见环境文档）
cd frontend
npm --cache ..\.npm-cache install
npm run dev            # http://localhost:5173

# 后端（DSH 沙箱中 python -m venv 的 ensurepip 会被拒，改用 uv）
cd backend
$env:UV_CACHE_DIR = '..\.uv-cache'
uv venv .venv --python 3.13
uv pip install --python .\.venv\Scripts\python.exe -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

> 本会话/DSH 沙箱中请用 `npm run dev:sandbox`、`npm run build:sandbox`、`npm run test:sandbox`，以及 `scripts\dev.cmd -Sandbox` / `scripts\build.cmd -Sandbox`；普通环境直接用 `dev/build/test` 和 `scripts\dev.cmd` / `scripts\build.cmd`。原因见 [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)。

生产构建：

```powershell
.\scripts\build.cmd -Sandbox -Test   # 单测 + 构建 + 后端 py_compile
# 或
cd frontend
npm run build          # 产出 frontend/dist
cd ..\backend
.\.venv\Scripts\python -m uvicorn app.main:app --port 8000
# 打开 http://127.0.0.1:8000
```

WebGL 自检：双击 [`scripts/check-webgl.html`](scripts/check-webgl.html)，确认 WebGL2 与显卡信息正常。

## 截图

![主菜单](docs/screenshots/menu.png)

![简单模式对局](docs/screenshots/game-easy.png)

![完整模式 144 张](docs/screenshots/game-full.png)

![首次三步引导](docs/screenshots/tutorial.png)

![设置](docs/screenshots/settings.png)

![移动端](docs/screenshots/mobile.png)

![暂停弹窗](docs/screenshots/pause.png)

## 验收

- **56 个 Vitest 用例**：种子、牌组、可见性、拖动、生成、撤销、Session、单张辅助、多候选、URL。
- `npm run typecheck`、`npm run build:sandbox`、后端 `py_compile` 通过。
- `scripts\build.cmd -Sandbox -Test` 一键构建通过。
- Edge + Playwright（真实 WebGL2）验证：点选 72→70、指针拖动 70→68、同一 `mode+seed` 布局一致、144 张完整棋盘、暂停/死局/胜利流程、教程/设置持久化、低画质、快捷键、移动端 390×844；无 console error。
- 截图见 [`docs/screenshots`](docs/screenshots/)。
- 规则细节与测试矩阵见 [`docs/GAME_RULES.md`](docs/GAME_RULES.md) 与 [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md#132-手动回归矩阵m4m6)。

## 项目结构

```
mahj/
├── docs/            规划与规则文档
├── backend/         FastAPI：配置、资源、SPA 托管
│   ├── app/
│   └── assets/      预留音频/贴图
├── frontend/        Vue + Vite + Three.js
│   ├── src/core/    纯 TS 游戏逻辑（可单测）
│   ├── src/render/  Three.js 渲染
│   ├── src/components/
│   └── tests/
├── scripts/         开发脚本与 WebGL 检查页
├── config.json.example
├── AGENTS.md
└── README.md
```

详细目录见 [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md#11-项目结构)。

## 开发路线

- [x] **M0** 规则梳理、技术选型、架构设计、环境检查、文档落盘
- [x] **M1** FastAPI + Vue/Vite + Three.js 骨架（桌面与首张 3D 牌）
- [x] **M2** 纯 TS 核心引擎与单元测试（生成、种子、可见性、拖动、消除、撤销、死局）
- [x] **M3** 42 种牌面、相机、拾取与 3D 动效
- [x] **M4** 菜单、HUD、弹窗、种子、记录、响应式
- [x] **M5** 音效、画质/音效设置、粒子、性能降级、无障碍、首次引导
- [x] **M6** 构建脚本、回归验收、交付

## 环境要求

- Windows 11（当前开发环境）
- Node.js ≥ 22.12（实测 24.14）
- Python ≥ 3.11（实测 3.13.5）
- 支持 WebGL2 的浏览器（Edge / Chrome 最新版）

当前会话的 npm/pip 缓存目录默认不可写，需使用项目内缓存（`.npm-cache`、`.pip-cache`）；普通沙箱限制浏览器进程，完整权限下可用 Edge + Playwright 自动验收（见 [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)）。

## 许可

尚未确定（TBD）。在确定许可证前，请勿对外分发。
