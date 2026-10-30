# 开发环境与命令

> 面向仓库贡献者：只记录可复现的环境要求、常用命令与受限环境（DSH 沙箱）的规避方式。
> 一次性的机器审计（主机名、磁盘、权限修复记录等）不进入仓库，需要时放在仓库外的本地笔记。

---

## 1. 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | 24.x（Vite 8 要求 `^20.19.0 \|\| >=22.12.0`） |
| npm | 11.x（项目统一 npm，不使用 pnpm） |
| TypeScript | **5.9.x（锁定）**，`vue-tsc` 生态尚未验证 7.x |
| Python | 3.13.x（后端 FastAPI/Uvicorn） |
| Git | 2.5x |
| 浏览器 | 最新 Edge / Chrome（Three.js 0.186 需要 **WebGL2**） |

后端只提供配置、静态资源与 SPA 托管，不保存对局状态；前端可独立开发。

---

## 2. 安装与启动

```powershell
# 前端依赖（受限环境需要项目内缓存）
cd frontend
npm install --cache ..\.npm-cache

# 前端开发（5173，/api 代理到 8000）
npm run dev

# 后端
cd backend
uv venv .venv --python 3.13
uv pip install --python .\.venv\Scripts\python.exe -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

打开 `http://127.0.0.1:8000`（FastAPI 托管构建产物）；只调前端时打开 `http://localhost:5173`。

---

## 3. 构建、测试与检查

```powershell
cd frontend
npm run test        # Vitest（67 个用例）
npm run build       # vite build -> frontend/dist
npx vue-tsc --noEmit  # 类型检查

# 后端语法检查
.\.venv\Scripts\python -m py_compile app/main.py app/config.py app/schemas.py app/routers/*.py
```

一键脚本：`scripts\dev.cmd`、`scripts\build.cmd`（普通环境）；受限环境加 `-Sandbox`。

---

## 4. 受限环境（DSH 沙箱）

普通沙箱里以下操作会被拒绝，需要走对应的绕过方式；**普通本机开发不需要**。

| 限制 | 表现 | 规避 |
| --- | --- | --- |
| 用户级缓存不可写 | `npm`/`pip`/`uv` 报 `EPERM` | 缓存指向项目内：`--cache ..\.npm-cache`、`UV_CACHE_DIR`、`--cache-dir` |
| Vite 探测网络盘 | `spawn EPERM`（`net use`） | `npm run dev:sandbox` / `build:sandbox`，由 `scripts/sandbox-preload.cjs` 拦截该命令 |
| Vitest forks 池 | `Failed to start forks worker` | `npm run test:sandbox`（`--pool=threads`） |
| 浏览器进程被拒 | Playwright 启动 Edge 失败 | 切完整权限后验收；否则手动打开 `scripts/check-webgl.html` |
| `python -m venv` 的 `ensurepip` 被拒 | 建 venv 失败 | 用 `uv venv .venv --python 3.13` |
| PowerShell 执行策略 | `.ps1` 未签名被拦 | 用 `scripts\*.cmd` 包装（`-ExecutionPolicy Bypass`） |

沙箱命令对照：

```powershell
.\scripts\dev.cmd -Sandbox
.\scripts\build.cmd -Sandbox -Test
```

---

## 5. WebGL 自检

双击打开 [`scripts/check-webgl.html`](../scripts/check-webgl.html)，确认：

- WebGL2 可用；
- 显卡 vendor/renderer（浏览器允许时）；
- 最大纹理尺寸、GLSL 版本、DPR；
- 旋转三角形正常渲染。

若不可用：在 Edge/Chrome 设置中开启硬件加速，或更新显卡驱动。

---

## 6. 常见问题

- **牌面发灰/过曝**：`CanvasTexture` 必须设 `SRGBColorSpace`。
- **同一 `GameRenderer` 重复挂载泄漏 WebGL context**：`onBeforeUnmount` 必须 `dispose()`。
- **npm/pip 缓存报错**：优先检查是否用了项目内缓存目录（见 §4）。
- **文档中的版本号**：以本文件 §1 为准；升级依赖时同步更新本表与 `docs/PROJECT_PLAN.md`。
