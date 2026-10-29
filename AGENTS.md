# AGENTS.md

本文件面向在此仓库工作的 AI 编码助手与人类开发者，记录**项目边界、架构不变量、命令与已知坑**。

## 项目是什么

浏览器端 3D 麻将消除游戏（代码名 `mahj`）。Vue 3 + Vite + TypeScript 前端，Three.js WebGL2 渲染；FastAPI 后端**只**提供模式配置、静态资源与生产环境 SPA 托管。

核心玩法：点选两张可配对且无阻挡的牌消除；或按住牌沿行/列拖动，带动连续牌串，落点成对则消除，否则整串回弹。

- **当前状态：M0（规划）**。仓库内只有文档与 `scripts/check-webgl.html`；`frontend/` 与 `backend/app/` 尚未创建。
- 开始实现前，按顺序阅读：
  1. `docs/GAME_RULES.md` —— 规则唯一权威来源；
  2. `docs/PROJECT_PLAN.md` —— 架构、模块、路线；
  3. `docs/RENDERING.md` —— 3D 与牌面方案；
  4. `docs/ENVIRONMENT.md` —— 本机约束。

## 命令（M1 骨架完成后生效）

```powershell
# 前端
cd frontend
npm --cache ..\.npm-cache install
npm run dev            # 5173，/api 代理到 8000
npm run test           # Vitest
npm run build          # vite build -> frontend/dist

# 后端
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install --cache-dir ..\.pip-cache -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# 语法检查
.\.venv\Scripts\python -m py_compile app/main.py app/config.py app/routers/*.py
```

> 以上 `frontend/package.json`、`backend/app`、`requirements.txt` 在 M1 创建；当前不存在，不要假装命令已可运行。

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
- 同轴拖动只能创造异轴配对：行拖动 → 纵向配对；列拖动 → 横向配对。
- 落点优先当前锚牌；否则自动选最近的可见同牌；无候选则整串回弹，不写历史、不记步。
- 满盘时所有 `kMax = 0`，开局只能点选；必须先消出空格才能拖动。
- 死局：无点选对子且无任何可成对拖动；免费洗牌/撤销/重开。不承诺任意随机布局必然可解。

## 已知坑

- **npm 缓存**：默认 `%LocalAppData%\npm-cache` 在本会话沙箱下不可写（EPERM）。始终用 `--cache ..\.npm-cache` 或设置 `npm_config_cache`。`.npm-cache/` 已 gitignore。
- **pip/uv 缓存**同样受限：用 `--cache-dir` / `UV_CACHE_DIR` 指向项目内。
- **pnpm 未安装**：不要引入 pnpm 工作流；统一 npm + `package-lock.json`。
- **浏览器自动化不可用**：本会话沙箱无法启动 Edge（mojo IPC 被拒）。不要试图用 Playwright 截图验收；让用户手动打开 `scripts/check-webgl.html`，或切完全权限后再试。
- **Node 24 + Vite 8**：满足 engines；但 **TypeScript 锁 5.9.x**，不要升到 7.x（`vue-tsc` 生态未验证）。
- **Three.js 0.186 只支持 WebGL2**；不要写 WebGL1 回退渲染器。
- **Three.js addons 路径**：`three/addons/geometries/RoundedBoxGeometry.js`、`three/addons/environments/RoomEnvironment.js`。版本升级前先查 API。
- **HMR / 重开**：`GameRenderer` 必须在 `onBeforeUnmount` 调用 `dispose()`（几何、材质、纹理、renderer、canvas），否则多次挂载会泄漏 WebGL context。
- **响应式**：不要把 Three.js 对象放进 Vue `reactive`/Pinia 深层响应式；用普通变量或 `shallowRef`。
- **纹理颜色空间**：CanvasTexture 必须设 `SRGBColorSpace`，否则牌面发灰/过曝。
- **拾取坐标**：NDC 用 `canvas.getBoundingClientRect()`，不是 `window.innerWidth`。
- **相机适配**：棋盘为竖长格（`CELL_D = 1.25`），别按正方形算范围。

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
5. 3D 改动后检查 `?faces=1` 与 `?debug=1`；确认无 draw call / 显存异常

## 文档维护

- 规则/数值变化 → 更新 `docs/GAME_RULES.md`，再改实现与测试。
- 技术栈/目录/里程碑变化 → 更新 `docs/PROJECT_PLAN.md`。
- 环境/依赖/沙箱限制变化 → 更新 `docs/ENVIRONMENT.md`。
- 新增坑或约定 → 更新本文件。
- 文档中的版本号以 `docs/ENVIRONMENT.md` 实测为准。
