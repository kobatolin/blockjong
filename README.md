# 挡通关 · Blockjong

浏览器里的 3D 麻将消除游戏：点选两张通路同牌，或按住一张牌拖动整串，寻找新的配对。

- 三种规模：简单 8×9、中等 9×12、完整 12×12
- 42 种程序化牌面，WebGL2 实时光照与材质
- 每局 3 次“移牌”道具，死局也能救场
- 同一模式 + 同一种子可复现同一棋盘

## 玩法

1. 点选两张**可配对**、且在**同一行/列中间无牌阻挡**的牌，即可消除。
2. 按住一张牌沿行/列拖动：被按住的牌与拖动方向上连续相邻的牌一起平移。
3. 松手时，被拖动的牌要在新位置与另一张牌形成**原本不存在的新通路**，才能消除。
4. 落点出现多张候选时，点其中一张消除；点其它位置则整串归位。
5. 每局有 3 次**移牌**：选一张牌，再点它上/下/左/右的空格，把牌挪过去。
6. 没有可消除的操作时，可以移牌、撤销上一步、重开本局或换一局。

完整模式的花牌同组互通：春/夏/秋/冬、梅/兰/竹/菊。规则细节见 [`docs/GAME_RULES.md`](docs/GAME_RULES.md)。

## 模式

| 模式 | 布局 | 牌数 | 牌种 |
| --- | --- | --- | --- |
| 简单 | 8 × 9 | 72 | 筒、索 |
| 中等 | 9 × 12 | 108 | 筒、索、万 |
| 完整 | 12 × 12 | 144 | 筒、索、万、字牌、花牌 |

## 快速开始

需要 Node.js 24+、Python 3.13+ 与支持 WebGL2 的浏览器。

```powershell
# 前端
cd frontend
npm install
npm run dev        # http://localhost:5173

# 后端（另一个终端）
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

生产构建：

```powershell
cd frontend
npm run build      # 产出 frontend/dist
cd ..\backend
.\.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

打开 `http://127.0.0.1:8000`。受限环境（DSH 沙箱）的命令差异见 [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)。

## 操作

| 操作 | 行为 |
| --- | --- |
| 左键点牌 | 选牌 / 配对消除 |
| 左键拖动牌 | 沿行或列移动连续牌串 |
| 滚轮 | 改视场角（FOV） |
| 右键拖动 | 水平旋转视角 / 调整观察半径 |
| 中键拖动 | 在桌面平面平移观察中心 |
| `U` / `H` / `I` | 撤销 / 提示 / 移牌 |
| `P` / `R` / `Esc` | 暂停 / 重开 / 关闭弹窗 |

## 种子与分享

- 开局可选输入种子，留空即随机。
- 支持十进制或 `0x` 开头的十六进制，例如 `12345`、`0xA1B2C3D4`。
- 同一模式 + 同一种子生成同一棋盘；游戏中可复制种子或分享链接。
- 自定义种子开局不计入最佳记录。

## 文档

| 文档 | 内容 |
| --- | --- |
| [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) | 目标、架构、模块、里程碑、风险 |
| [`docs/GAME_RULES.md`](docs/GAME_RULES.md) | 规则、边界情况、算法、测试矩阵 |
| [`docs/RENDERING.md`](docs/RENDERING.md) | 3D 场景、牌面生成、光照、动效 |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | 环境要求、构建/测试命令、受限环境 |
| [`AGENTS.md`](AGENTS.md) | 协作约定与架构不变量 |

## 许可

- 代码以 [MIT](LICENSE) 许可发布。
- 牌面字体 **I.Mahjong-HK** 采用 M+ Font License，见 [`frontend/src/assets/fonts/I-MAHJONG-LICENSE.md`](frontend/src/assets/fonts/I-MAHJONG-LICENSE.md)。
- 第三方依赖的许可见各包自带的 `LICENSE`。
