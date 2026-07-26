# Film Studio

一个独立的多 Agent 电影公司工作流 Web 驾驶舱，参考 OiiOii.ai 的沉浸式创作工具体验。

**作者：OdeliaLan · 当前版本：1.1.0 · 发布日期：2026-07-26**

---

## 版本记录

### 1.1.0（2026-07-26）

本版本将 Film Studio 从本地工作台升级为可安全开放注册的单机 SaaS 基线；生产环境默认继续关闭公开注册，待真实 SMTP 与 Turnstile 联调通过后再开启。

- SQLite 升级为唯一事务数据源，使用 WAL、外键、FULL synchronous 和 schema v2 迁移；用户、会话、项目属主、稳定项目 ID、Run/Job 索引、模型配置、限流、用量、存储预占和审计统一持久化。
- 公开用户强制 BYOK，模型 Key 使用 AES-256-GCM 加密，主密钥与数据库备份域分离；远程模型仅允许 HTTPS，HTTP 只允许显式回环地址。
- 注册流程改为 Cloudflare Turnstile 服务端验证与 8 位邮箱验证码；验证码使用 HMAC 保存、10 分钟过期、最多尝试 5 次、限制重发并防止 token 重放。远程安全问题恢复被永久禁用。
- Dreamina 全路径统一要求管理员角色，普通账户无法触发平台付费调用；Film Run、Dreamina、文档保存和项目创建使用 SQLite 原子额度/存储预占，成功按实际大小结算，失败释放。
- 加固文件权限、符号链接/路径穿越、磁盘余量、临时目录、单文件/任务/项目/账户存储边界；公共 API 错误统一为最小结构，并移除内部路径、CLI 输出和供应商原始错误。
- 项目重命名不再移动目录或改变 API ID；Run 历史改为分页摘要并只按需读取最新详情，账户安全面板显示实时项目、存储和每日调用用量。
- 前端移除安全问题流程，完善原生 dialog、键盘焦点、移动端和 reduced-motion；删除无动作搜索入口，以 WebP/AVIF 替代大型预览 PNG。
- CI 增加 ESLint、主服务器覆盖率、Playwright、依赖审计和 Gitleaks；当前 32 项单元/集成测试与浏览器 E2E 全部通过，已知依赖漏洞为 0。

### 1.0.1（2026-07-24）

本版本在 1.0 的可运行工作台基础上完成安全、可靠性和生产闭环升级：

- 增加人工发布门禁、逐文件审批、结构化差异、基线冲突检测、安全回滚，以及发布/回滚事务的崩溃恢复。
- 认证、会话、项目属主、Run/Job 索引、配额与审计迁入 SQLite；注册使用 Turnstile 与邮箱验证码，远程安全问题恢复已禁用。
- 将后台任务与资产生成改为账户私有持久化队列，支持幂等、进度查询、取消、重启续跑和资源边界控制。
- Agent 按岗位读取上游真相源，分别预算提示词、规则、工具和账户私有 Memory，并记录输入清单、SHA-256 与请求指纹。
- 收紧服务监听、可信代理、限流、文件访问、响应头和密钥边界；加入 32 项关键回归测试及 GitHub Actions 验证。

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
- **Node/Express + SQLite 后端**：端口 4080；SQLite 使用 WAL、外键、FULL synchronous 与版本化迁移。
- **用户认证系统**：支持 Turnstile、人机验证、8 位邮箱验证码、Cookie 会话、注销和安全改密；远程恢复 API 固定返回 410。
- **账户输入规则**：密码最低 12 个字符；验证码 10 分钟过期、最多 5 次尝试且单次使用。
- **模型配置管理**：公开用户使用自己的模型 Key；Key 以 AES-256-GCM 加密，主密钥支持独立私有文件注入，远程模型地址必须使用 HTTPS。
- **事务配额**：项目数量、每日调用和账户/项目存储在 SQLite 事务中原子预占，完成后按实际目录大小结算，失败释放预占。
- **资产权限**：共享 Dreamina 仅管理员可用，普通用户在所有资产生成入口均收到 `403 ASSET_ADMIN_REQUIRED`。
- **Cloudflare Tunnel 部署**：生产域名 `https://film.odelialan.space`。
- **进程管理**：提供 ecosystem.config.cjs 的 PM2 配置；当前单机生产实例使用 systemd 用户服务管理。
- **Agent 工位视图**：可视化每个 Agent 的岗位名称、职责边界、输入材料、输出文件和当前状态。
- **文档真相源面板**：聚合项目资料库关键文件（PROJECT_BRIEF、CHARACTER_BIBLE、STORYBOARD_MASTER 等）。
- **资产预览**：本地角色/场景图片和视频资产直接可见。
- **Agent Memory/Skills 面板**：展示各 Agent 的长期记忆和技能积累。

### 技术栈

- 前端：React 19 + Vite 7 + TypeScript 5 + Lucide Icons
- 后端：Node.js + Express 5 + better-sqlite3
- 部署：PM2 + Cloudflare Tunnel
- 模型：支持 OpenAI 兼容 API（默认 aicodewith/gpt-5.5）

### 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 服务健康状态 |
| GET | /api/auth/me | 恢复并验证当前登录会话 |
| GET | /api/auth/registration/config | 获取注册状态与 Turnstile site key |
| POST | /api/auth/registration/start | 验证 Turnstile 并发送邮箱验证码 |
| POST | /api/auth/register | 使用邮箱、8 位验证码和密码注册 |
| POST | /api/auth/login | 登录并轮换会话 |
| POST | /api/auth/logout | 注销并清理 Cookie |
| POST | /api/auth/password | 验证旧密码后修改密码并撤销旧会话 |
| * | /api/auth/recovery/* | 已禁用，固定返回 `410 RECOVERY_DISABLED` |
| GET | /api/usage | 项目、存储、Film Run 和管理员资产额度 |
| GET | /api/film/runtime | 运行时快照（Agent、项目、文档、Run） |
| GET | /api/film/agents | Agent 注册表 |
| GET | /api/film/projects | 项目列表 |
| POST | /api/film/projects | 创建新项目 |
| GET | /api/film/projects/:id/documents | 项目文档状态 |
| GET | /api/film/runs | 分页历史 Run 摘要 |
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

本机管理员操作统一通过审计 CLI 完成，重设密码从 stdin 读取：

```bash
printf '%s\n' 'new-password' | npm run admin-user -- reset-password user@example.com
npm run admin-user -- verify-email user@example.com
npm run admin-user -- enable user@example.com
npm run admin-user -- grant-admin user@example.com
```

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

生产环境应通过 `FILM_CREDENTIAL_ENCRYPTION_KEY_FILE` 指向独立备份、权限为 `0600` 的 32 字节密钥文件，不要把数据库和解密密钥放进同一个备份归档。

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
