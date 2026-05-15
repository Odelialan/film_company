# Film Studio

一个独立的多 Agent 电影公司工作流 Web 驾驶舱，参考 OiiOii.ai 的沉浸式创作工具体验。

**作者：OdeliaLan**

---

## 版本 1.0（2026-05-15）

### 核心功能

- **创作输入驾驶舱**：用户从一个创作输入框进入，支持秒数、类型、风格、故事内容、具体要求五大模块化提示词组合，内置 50 条随机创意灵感。
- **多 Agent 协作架构**：总导演、故事小说家、选角导演、编剧、分镜导演、场景美术、关键帧设计师、摄影指导等 10 个专业岗位 Agent 接力生产。
- **10 阶段生产流水线**：需求进入 → 需求澄清与立项 → 世界观/故事/角色搭建 → 剧本结构确定 → 分镜设计 → 视觉与场景方案 → 关键帧/运镜设计 → 制作执行 → 后期整合 → 审核定版归档。
- **项目资料库系统**：标准化 14 个文件夹结构（00_admin ~ 13_review），支持多项目管理、项目重命名、进度追踪。
- **Run 任务系统**：每次创作任务生成独立 Run 记录（TASK.md、ROUTE.json、STATUS.json、AGENT_WORK.json、RESULT.md），支持历史回溯和基于历史 Run 继续追加需求。
- **双通道同步**：重要产出同时写入项目资料库和对话流，保持单一真相源。
- **Node/Express 后端**：端口 4080，持有 API Key 代理模型请求，前端永不直接持有密钥。
- **用户认证系统**：支持注册/登录，用户数据按账户隔离。
- **模型配置管理**：支持多模型 Profile 切换，可自定义 provider、base_url、model list。
- **Cloudflare Tunnel 部署**：生产域名 `https://film.odelialan.space`。
- **PM2 进程管理**：通过 ecosystem.config.cjs 管理生产进程。
- **Agent 工位视图**：可视化每个 Agent 的岗位名称、职责边界、输入材料、输出文件和当前状态。
- **文档真相源面板**：聚合项目资料库关键文件（PROJECT_BRIEF、CHARACTER_BIBLE、STORYBOARD_MASTER 等）。
- **资产预览**：本地角色/场景图片和视频资产直接可见。
- **Agent Memory/Skills 面板**：展示各 Agent 的长期记忆和技能积累。

### 技术栈

- 前端：React 19 + Vite 7 + TypeScript 5 + Lucide Icons
- 后端：Node.js + Express 5
- 部署：PM2 + Cloudflare Tunnel
- 模型：支持 OpenAI 兼容 API（默认 aicodewith/gpt-5.5）

### 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 服务健康状态 |
| GET | /api/film/runtime | 运行时快照（Agent、项目、文档、Run） |
| GET | /api/film/agents | Agent 注册表 |
| GET | /api/film/projects | 项目列表 |
| POST | /api/film/projects | 创建新项目 |
| GET | /api/film/projects/:id/documents | 项目文档状态 |
| GET | /api/film/runs | 历史 Run 列表 |
| POST | /api/film/task | 总导演调度入口 |
| POST | /api/film/runs/:id/continue | 基于历史 Run 继续 |
| POST | /api/film/projects/:id/assets/actions | 资产生成（Dreamina CLI） |

---

## 快速开始

```bash
npm install
```

### 配置后端

```bash
cp server/.env.example server/.env
# 编辑 server/.env 填写 API Key
```

### 本地开发

```bash
# 启动前端
npm run dev

# 启动后端
npm run dev:server
```

前端默认地址：`http://127.0.0.1:5173/`  
后端默认地址：`http://127.0.0.1:4080/`

### 生产部署

```bash
npm run build
bash start-prod.sh
```

或使用 PM2：

```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 项目结构

```
film-company/
├── src/                  # React 前端源码
├── server/               # Node/Express 后端
│   ├── index.js          # 后端入口
│   ├── .env.example      # 环境变量模板
│   └── .env              # 实际配置（不上传）
├── agent/                # Agent 工作区（提示词和标准文档）
│   ├── workspace-film-company/   # 公司级标准和项目模板
│   ├── workspace-director/       # 总导演
│   ├── workspace-screenwriter/   # 编剧
│   ├── workspace-story-novelist/ # 故事小说家
│   ├── workspace-casting-director/  # 选角导演
│   ├── workspace-storyboard-director/ # 分镜导演
│   ├── workspace-scene-art/      # 场景美术
│   ├── workspace-art-designer/   # 美术设计
│   ├── workspace-keyframe-designer/ # 关键帧设计
│   └── workspace-cinematographer/   # 摄影指导
├── public/assets/        # 前端静态资产
├── package.json
├── vite.config.ts
├── tsconfig.json
├── ecosystem.config.cjs  # PM2 配置
├── start.sh              # 开发启动脚本
└── start-prod.sh         # 生产启动脚本
```

---

## License

Private project by OdeliaLan.
