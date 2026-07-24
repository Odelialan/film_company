# Film Studio

一个独立的多 Agent 电影公司工作流 Web 驾驶舱，参考 OiiOii.ai 的沉浸式创作工具体验。

**作者：OdeliaLan · 当前版本：1.0.1 · 发布日期：2026-07-24**

---

## 版本记录

### 1.0.1（2026-07-24）

本版本在 1.0 的可运行工作台基础上完成安全、可靠性和生产闭环升级：

- 增加人工发布门禁、逐文件审批、结构化差异、基线冲突检测、安全回滚，以及发布/回滚事务的崩溃恢复。
- 补齐注册、登录、Cookie 会话恢复、注销、改密和忘记密码闭环；认证库、模型配置和项目属主元数据损坏时改为 fail-closed。
- 将后台任务与资产生成改为账户私有持久化队列，支持幂等、进度查询、取消、重启续跑和资源边界控制。
- Agent 按岗位读取上游真相源，分别预算提示词、规则、工具和账户私有 Memory，并记录输入清单、SHA-256 与请求指纹。
- 收紧服务监听、可信代理、限流、文件访问、响应头和密钥边界；加入 28 项关键回归测试及 GitHub Actions 验证。

### 1.0（2026-05-15）

1.0 是 Film Studio 的首个可运行版本，完成了多 Agent 影视生产驾驶舱、项目资料库、Run 任务记录、八阶段后端工作流、双通道同步、模型配置、资产预览，以及 PM2/Cloudflare Tunnel 部署基础。

---

## 核心功能

- **创作输入驾驶舱**：用户从一个创作输入框进入，支持秒数、类型、风格、故事内容、具体要求五大模块化提示词组合，内置 50 条随机创意灵感。
- **多 Agent 协作架构**：总导演、故事小说家、编剧、选角导演、分镜导演、场景美术、视觉风格导演、关键帧设计师、摄影指导等 9 个岗位 Agent 接力生产。
- **8 个后端强制阶段**：视觉顶层 → 故事 → 剧本 → 选角 → 分镜 → 场景 → 关键帧 → 镜头生成；后期、交付和复盘仍由项目资料库管理，尚未接入自动执行状态机。
- **项目资料库系统**：标准化 14 个文件夹结构（00_admin ~ 13_review），支持多项目管理、项目重命名、进度追踪。
- **Run 任务系统**：每次创作任务生成独立 Run 记录（TASK.md、ROUTE.json、STATUS.json、AGENT_WORK.json、RESULT.md），支持历史回溯和基于历史 Run 继续追加需求。
- **人工发布门禁**：Agent 交付默认保存为 Run 草稿，工作区对照显示正式版本与草稿；项目属主批准后才发布，拒绝不会修改正式文件。
- **可恢复后台 Job**：后台任务状态按账户私有持久化，服务重启时把中断任务收敛为明确的可查询错误。
- **双通道同步**：重要产出同时写入项目资料库和对话流，保持单一真相源。
- **Node/Express 后端**：端口 4080，持有 API Key 代理模型请求，前端永不直接持有密钥。
- **用户认证系统**：支持带验证问题的注册、登录、忘记密码、Cookie 会话恢复、注销撤销和安全改密；验证答案使用独立 scrypt 哈希，认证库损坏时拒绝覆盖并明确返回服务故障。
- **账户输入规则**：新注册、改密和重设密码最低 12 个字符；新验证答案最低 8 个字符，服务端只持久化不可逆哈希。
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
| GET | /api/auth/me | 恢复并验证当前登录会话 |
| POST | /api/auth/login | 登录并轮换会话 |
| POST | /api/auth/logout | 注销并清理 Cookie |
| POST | /api/auth/password | 验证旧密码后修改密码并撤销旧会话 |
| GET | /api/auth/recovery/questions | 获取允许使用的验证问题 |
| POST | /api/auth/recovery/setup | 登录后验证当前密码并设置验证问题 |
| POST | /api/auth/recovery/challenge | 按邮箱读取验证问题状态 |
| POST | /api/auth/recovery/reset | 验证答案后重设密码并撤销全部旧会话 |
| GET | /api/film/runtime | 运行时快照（Agent、项目、文档、Run） |
| GET | /api/film/agents | Agent 注册表 |
| GET | /api/film/projects | 项目列表 |
| POST | /api/film/projects | 创建新项目 |
| GET | /api/film/projects/:id/documents | 项目文档状态 |
| GET | /api/film/runs | 历史 Run 列表 |
| GET | /api/film/runs/:id | Run 详情、草稿和审批状态 |
| POST | /api/film/runs/:id/approve | 批准并发布全部或指定 `entryIds` 的 Agent 草稿 |
| POST | /api/film/runs/:id/reject | 拒绝全部或指定 `entryIds` 的 Agent 草稿 |
| POST | /api/film/runs/:id/rollback | 按发布 journal 安全回滚已批准文件 |
| GET | /api/film/jobs/:id | 查询持久化后台任务状态 |
| POST | /api/film/task | 总导演调度入口 |
| POST | /api/film/runs/:id/continue | 基于历史 Run 继续 |
| POST | /api/film/projects/:id/assets/actions | 资产生成（Dreamina CLI） |
| GET | /api/film/asset-jobs | 查询账户资产任务列表 |
| GET | /api/film/asset-jobs/:id | 查询资产任务进度与结果 |
| DELETE | /api/film/asset-jobs/:id | 取消排队或运行中的资产任务 |

审批发布会在 run 目录写入 `APPROVAL_JOURNAL.json` 和独立回滚快照。服务启动时会自动恢复中断的发布事务：未完整发布的批次回滚，已完整落盘的批次完成审批元数据提交。

审批面板支持逐文件选择、结构化行级差异和安全回滚。若正式文件在草稿生成或发布后被修改，批准/回滚都会返回 409，前端刷新状态且不会覆盖人工修改。用户主动回滚由 `APPROVAL_ROLLBACK_REQUEST.json` 记录并支持重启恢复。

每个 Agent 的 `AGENT_WORK.json` 会记录实际项目输入清单、字符数及 SHA-256，并记录模型请求指纹；账户私有 Memory 正文不会复制到审计字段。

资产请求传入 `background: true` 后进入账户私有持久化队列。客户端可通过 `Idempotency-Key` 防止重复生成，并使用资产 Job API 查询进度或取消；前端工作台默认使用该模式。

---

## 快速开始

```bash
npm ci
```

### 配置后端

```bash
cp server/.env.example server/.env
# 编辑 server/.env 填写 API Key
```

### 本地开发

```bash
bash start.sh
```

前端默认地址：`http://127.0.0.1:5173/`  
后端默认地址：`http://127.0.0.1:4080/`

后端默认只绑定回环地址。若通过反向代理部署，请用 `FILM_TRUST_PROXY` 明确配置可信代理地址或网段；不要重新使用无条件的单跳代理信任。

### 生产部署

```bash
npm ci
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
