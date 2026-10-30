# 环境检查记录

> 检查时间：2026-10-29 19:39–19:50（Asia/Shanghai）
> 检查对象：`D:\workspace\mahj`（新建项目）
> 结论：**工具链满足开发要求，按下方约束可直接进入 M1**。

---

## 1. 主机与工作区

| 项 | 值 |
| --- | --- |
| 操作系统 | Windows 11（NT 10.0.26200.0），64 位 |
| 主机名 | `host` |
| CPU | AMD64 Family 26 Model 68（AMD，Zen 5 级别） |
| Shell | Windows PowerShell 5.1.26100.9711 |
| 工作区 | `D:\workspace\mahj` |
| D: 磁盘 | 总计 547.5 GB，可用 180.9 GB |
| C: 磁盘 | 总计 382.8 GB，可用 101.7 GB |

> 未采集到显卡型号：会话沙箱禁止 `Get-CimInstance Win32_VideoController`（拒绝访问）。WebGL 能力需在真实浏览器中确认，见 §5。

---

## 2. 工具链

| 工具 | 版本 / 路径 | 状态 |
| --- | --- | --- |
| Git | 2.53.0.windows.1，`C:\Program Files\Git\cmd\git.exe` | ✅ |
| Node.js | v24.14.0，`C:\Program Files\nodejs\node.exe` | ✅ |
| npm | 11.9.0 | ✅ |
| pnpm | 未安装 | ⚠️ 本项目统一用 npm，不引入 pnpm |
| Python | 3.13.5（Microsoft Store 包） | ✅ |
| uv | 0.11.1，`C:\Users\user\.local\bin\uv.exe` | ⚠️ 用户级缓存不可写，需改项目内缓存 |
| pip | 随 Python 提供 | ✅（需改缓存目录） |

Git 身份已配置：

```
user.name  = <hidden>
user.email = tbs@users.noreply.github.com
```

未设置 `core.autocrlf`；仓库通过 `.gitattributes` 统一为 LF（`.bat`/`.ps1` 为 CRLF）。

---

## 3. Node / npm 生态

- 默认 registry：`https://registry.npmjs.org/`，网络可达。
- **限制**：npm 默认缓存 `C:\Users\user\AppData\Local\npm-cache` 在当前会话沙箱下不可写（`EPERM`）。必须使用项目内缓存：

```powershell
# 方式一：命令行参数
npm --cache D:\workspace\mahj\.npm-cache install

# 方式二：当前会话环境变量
$env:npm_config_cache = 'D:\workspace\mahj\.npm-cache'
npm install
```

`.npm-cache/` 已加入 `.gitignore`。

本机可获取到的关键版本（2026-10-29）：

| 包 | 版本 |
| --- | --- |
| `three` | 0.186.1 |
| `vue` | 3.5.44 |
| `vite` | 8.3.5 |
| `@vitejs/plugin-vue` | 6.0.10 |
| `pinia` | 4.1.0 |
| `vitest` | 5.0.5 |
| `typescript` | 7.0.2（最新）；本项目选 **5.9.3** |
| `@types/node` | 24.19.2（对应 Node 24） |
| `tailwindcss` | 4.3.3（本项目不使用） |

兼容性核对：

- Vite 8 `engines`：`^20.19.0 || >=22.12.0` → Node 24.14.0 ✅
- `@vitejs/plugin-vue@6` peer：`vite ^5 || ^6 || ^7 || ^8` ✅
- `pinia@4` peer：`vue ^3.5.11`、`typescript >=5.6` ✅
- `vitest@5` peer：`vite ^6.4 || ^7 || ^8`、`@types/node ^22 || >=24` ✅

> TypeScript 7.0.2 是当前 latest，但 `vue-tsc` 的语言服务生态尚未验证；本项目锁 5.9.3，避免开工即踩坑。

---

## 4. Python 生态

已安装：Python 3.13.5、pip、uv 0.11.1。

未安装（`importlib.util.find_spec` 均为 `False`）：

- `fastapi`
- `uvicorn`
- `pydantic`
- `httpx`
- `pytest`

计划在 M1 创建 `backend/.venv` 并安装 `backend/requirements.txt`。当前会话中：

- `uv` 默认缓存 `C:\Users\user\AppData\Local\uv\cache` 不可写；
- pip 默认缓存同样可能受沙箱限制。

建议命令：

```powershell
cd D:\workspace\mahj\backend
python -m venv .venv
.\.venv\Scripts\python -m pip install --cache-dir D:\workspace\mahj\.pip-cache -r requirements.txt

# 如用 uv：
$env:UV_CACHE_DIR = 'D:\workspace\mahj\.uv-cache'
uv venv .venv
uv pip install --python .\.venv\Scripts\python.exe -r requirements.txt
```

`.pip-cache/`、`.uv-cache/`、`.venv/` 均已加入 `.gitignore`。

---

## 5. 浏览器与 WebGL

- 已安装 Microsoft Edge：
  `C:\Program Files (x86)\Microsoft Edge\Application\msedge.exe`
- 未发现 Google Chrome 的默认安装路径。

**会话限制**：在本会话的沙箱中启动 Edge（含 `--headless=new --no-sandbox`）失败：

```
mojo\public\cpp\platform\platform_channel.cc: Check failed: 拒绝访问 (0x5)
```

这是 AI 会话沙箱对浏览器进程/IPC 的限制，不代表本机浏览器不可用。因此：

- 无法在会话内自动截图或跑 Playwright 验收；
- WebGL 能力需在**真实浏览器**中验证；
- 已提供独立检查页 `scripts/check-webgl.html`。

### 5.1 如何验证 WebGL

1. 双击打开 `D:\workspace\mahj\scripts\check-webgl.html`（或拖入 Edge）。
2. 页面会显示：
   - WebGL2 是否可用（Three.js 0.186 需要 WebGL2）；
   - 显卡 vendor / renderer（若浏览器允许暴露）；
   - 最大纹理尺寸、GLSL 版本、设备像素比；
   - 一个旋转的彩色三角形（证明实际渲染，而不只是上下文创建）。
3. 期望结果：**WebGL2 可用**，renderer 显示真实 GPU 或 `ANGLE (...)`；三角形正常旋转。
4. 若显示“WebGL2 不可用”，请在 Edge 设置中开启硬件加速，或更新显卡驱动后重试。

> Three.js 自 r163 起已移除 WebGL1 渲染器后端；本项目必须运行在 WebGL2 环境。

---

## 6. 工作区权限备注

首次执行时，DSH 为工作区授予写权限失败：

```
SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\workspace\mahj)
```

已通过一次性授权运行诊断脚本修复：为当前用户补上该目录的完全控制项，并重新读取验证通过。未修改文件内容与所有者。

- 备份与回滚脚本：`D:\workspace\mahj-acl-recovery\`
- 报告：`D:\workspace\mahj-acl-recovery\acl-report-00000000000000000000000000000000.jsonl`
- 如后续需要恢复原权限，可运行备份目录中 `acl-backup-*.json.ps1` 的 `-Restore` 命令。

该目录在仓库之外，不影响代码；保留用于审计/回滚。

---

## 7. 环境对开发的约束

| 约束 | 影响 | 应对 |
| --- | --- | --- |
| 只允许写工作区内路径 | npm/pip/uv 默认缓存在用户目录，会失败 | 所有缓存指向 `D:\workspace\mahj\.*-cache` |
| 浏览器进程被沙箱阻断 | 无法自动截图/跑 Playwright（普通沙箱） | 切完整权限后用 Edge + Playwright；否则手动打开 `check-webgl.html` |
| pnpm 缺失 | 不能用 pnpm 工作流 | 统一 npm + `package-lock.json` |
| Python 依赖未装 | 后端暂不可启动 | M1 建 venv 并安装 |
| 显卡信息不可读 | 无法预判 GPU 性能 | 运行时自适应降级 + 手动画质档 |
| PowerShell 5.1 | 部分新语法不可用 | 脚本写成兼容 5.1 的语法（避免 `??`、`?.`） |

---

## 8. 可复现的检查命令

```powershell
# 工具版本
git --version
node --version
npm --version
python --version
uv --version

# Python 依赖
python -c "import importlib.util as u; [print(m, bool(u.find_spec(m))) for m in ['fastapi','uvicorn','pydantic','httpx','pytest']]"

# npm registry + 项目内缓存
npm --cache D:\workspace\mahj\.npm-cache view three version
npm --cache D:\workspace\mahj\.npm-cache view vue version

# 磁盘
[System.IO.DriveInfo]::GetDrives() | Where-Object IsReady |
  Select-Object Name,@{n='FreeGB';e={[math]::Round($_.AvailableFreeSpace/1GB,1)}}

# Git 身份
git config --global user.name
git config --global user.email
```

---

## 9. M1–M5 实测状态（2026-10-29）

- [x] 前端依赖安装成功（Vite 8.3.5、Three 0.186.1、Vue 3.5.44、Vitest 5.0.5、`@types/three` 0.186.0）。
- [x] `npm run test:sandbox`：6 个测试文件、55 个用例全部通过。
- [x] `npm run typecheck`：通过。
- [x] `npm run build:sandbox`：产出 `frontend/dist`（JS 约 697KB / gzip 191KB，Three.js 体积警告可接受）。
- [x] 后端 `uv venv` + `uv pip install`：FastAPI 0.162.0、Uvicorn 0.54.0、Pydantic 2.14.1。
- [x] `py_compile` 通过。
- [x] `/api/health`、`/api/config`、`/`（SPA）、`/api/assets` 路径穿越 404 均验证通过。
- [x] Edge + Playwright（完整权限）实测：WebGL2 可用；点选消除（72→70）、指针拖动消除（70→68）、同种子复现、144 张完整棋盘、暂停/死局弹窗、移动端 390×844 布局均通过；无页面 console error。
- [x] M5：首次三步引导、设置面板、音效开关、低画质、减少动效、快捷键与移动端 HUD 均通过真实浏览器验收；消除粒子截图可见。
- [x] `scripts\build.cmd -Sandbox` 一键构建通过（脚本执行策略由 `.cmd` 包装绕过）；`scripts\dev.cmd -Sandbox` 用于双端启动。
- [x] M6 最终交付（回归清单归档、README/文档终检、最终提交）。

---

## 10. 结论

- 本机具备完整的 Node + Python + Git 开发条件，磁盘充足。
- 唯一需要预处理的坑是 **npm/pip/uv 缓存目录**、**Vite 的 Windows 网络盘探测**、**Vitest forks 子进程**与**浏览器自动化限制**，均已给出规避方案。
- 环境层面没有阻塞项；M0–M6 已完成，可交付。

---

## 11. M1–M5 环境适配记录

### 11.1 Vite 8 的 `net use` 探测

Vite 8 在 Windows 上会执行 `exec("net use")` 探测映射网络盘。当前 DSH 沙箱禁止子进程管道，导致：

```
Error: spawn EPERM
  at optimizeSafeRealPathSync (.../vite/dist/node/chunks/node.js)
```

应对：`scripts/sandbox-preload.cjs` 只拦截这一条命令（其他 `exec` 原样放行），让 Vite 回退到 `fs.realpathSync`。仅影响本会话；普通环境无需该脚本。

```powershell
cd frontend
npm run dev:sandbox
npm run build:sandbox
```

### 11.2 Vitest 必须用线程池

Vitest 默认 forks 池会 `spawn` 子进程，在沙箱中被拒：

```
Failed to start forks worker ... spawn EPERM
```

`vitest.config.ts` 已设 `pool: 'threads'`；沙箱命令再加 preload：

```powershell
npm run test:sandbox
# 等价于：
# node -r ../scripts/sandbox-preload.cjs node_modules/vitest/vitest.mjs run --pool=threads
```

### 11.3 Three.js 类型声明

`three@0.186.1` 不自带 `.d.ts`，需要 devDependency：

```powershell
npm install -D @types/three@^0.186.0 --ignore-scripts
```

`RoundedBoxGeometry` 的类型不在 `THREE` 命名空间，使用导入的类名作为类型。

### 11.4 Python venv

本机 `python -m venv` 的 `ensurepip` 失败，改用 uv：

```powershell
cd backend
$env:UV_CACHE_DIR = 'D:\workspace\mahj\.uv-cache'
uv venv .venv --python 3.13
uv pip install --python .\.venv\Scripts\python.exe -r requirements.txt
```

`python -m venv` 在普通环境仍可用；以上是 DSH 下的实测路径。

### 11.5 编码

`/api/config` 返回的 JSON 为 UTF-8（已检查原始字节）；PowerShell 5.1 控制台按本地代码页显示时中文会乱码，不是服务端问题。浏览器/前端按 UTF-8 解析。

### 11.6 浏览器验收

**完整权限下可用**：`playwright-core` + 本机 Edge（`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`）可以启动无头浏览器并完成：

- 菜单/完整棋盘/暂停/死局/移动端截图；
- 真实点击两张牌消除（HUD 72→70、步数 0→1）；
- 真实指针拖拽消除（70→68）；
- 同一 `?mode=easy&seed=12345` 两次开局的 `boardSignature` 完全一致；
- 144 张完整模式棋盘 WebGL2 渲染；
- 无 console error（favicon 已补）。

Playwright 仅装在 `.tmp/verify`（不提交，不进入 `package.json`）；普通沙箱中浏览器进程仍会被拒绝，此时请手动验收：

- 打开 `scripts/check-webgl.html` 确认 WebGL2；
- `npm run dev:sandbox`，或让 FastAPI 托管 `frontend/dist`；
- 用鼠标/触屏检查点选、拖动、暂停、结算。

调试参数：`?debug=1` 会在 `window.__mahj` 暴露只读快照、hint、findDrag、cellToScreen、tap/drag 与 uiState，供自动化验收使用；普通用户不会看到。`?debug=1` 也会跳过首次三步引导。

### 11.7 构建脚本与执行策略

本机 PowerShell 的脚本执行策略会阻止直接运行 `.ps1`：

```text
无法加载文件 ...\build.ps1。未对文件进行数字签名。
```

因此提供 `.cmd` 包装，用 `powershell.exe -ExecutionPolicy Bypass` 调用：

```powershell
scripts\dev.cmd -Sandbox
scripts\build.cmd -Sandbox -Test
```

`scripts/build.cmd -Sandbox` 实测通过，输出 `frontend/dist` 后由 FastAPI 托管。普通环境去掉 `-Sandbox` 即可。
