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
| 浏览器进程被沙箱阻断 | 无法自动截图/跑 Playwright | 手动打开 `check-webgl.html`；验收由真实浏览器完成 |
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

## 9. M1 启动清单

- [ ] `cd frontend && npm --cache ..\.npm-cache install`
- [ ] 确认 `node_modules/.bin/vite` 存在，`npm run dev` 可启动
- [ ] `cd backend && python -m venv .venv`
- [ ] `.\.venv\Scripts\python -m pip install --cache-dir ..\.pip-cache -r requirements.txt`
- [ ] `python -m uvicorn app.main:app --port 8000` 可启动
- [ ] 浏览器打开 `scripts/check-webgl.html`，确认 WebGL2
- [ ] 两个终端分别启动前后端，访问 `http://localhost:5173`，`/api/health` 返回 ok

---

## 10. 结论

- 本机具备完整的 Node + Python + Git 开发条件，磁盘充足。
- 唯一需要预处理的坑是 **npm/pip/uv 缓存目录**与**浏览器自动化限制**，均已给出规避方案。
- 环境层面没有阻塞项；可以按 `PROJECT_PLAN.md` 的 M1 开始搭骨架。
