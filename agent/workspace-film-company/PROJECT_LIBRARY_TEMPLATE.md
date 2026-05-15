# 项目共享资料库模板

> 目标：为每一个影视项目提供统一目录结构、文件职责、维护人定义和更新规则。
>
> 使用方式：新项目启动时，复制 `projects/_PROJECT_TEMPLATE/` 作为项目目录，再按本模板执行。

---

## 一、标准项目目录结构

```text
projects/
└── _PROJECT_TEMPLATE/
    ├── 00_admin/
    │   ├── PROJECT_BRIEF.md
    │   ├── PROJECT_STATUS.md
    │   ├── CHANGELOG.md
    │   ├── ROLE_RESPONSIBILITY.md
    │   └── MEETING_NOTES.md
    ├── 01_story/
    │   ├── WORLD_SETTING.md
    │   ├── STORY_OUTLINE.md
    │   └── STORY_NOTES.md
    ├── 02_characters/
    │   ├── CHARACTER_BIBLE.md
    │   ├── RELATIONSHIP_MAP.md
    │   ├── CASTING_NOTES.md
    │   └── CHARACTER_REFERENCES/
    ├── 03_script/
    │   ├── BEAT_SHEET.md
    │   ├── SCRIPT_V1.md
    │   ├── SCRIPT_V2.md
    │   └── DIALOGUE_NOTES.md
    ├── 04_storyboard/
    │   ├── STORYBOARD_MASTER.md
    │   ├── SHOTLIST.csv
    │   └── RHYTHM_NOTES.md
    ├── 05_visual/
    │   ├── VISUAL_STYLE_GUIDE.md
    │   ├── COLOR_SCRIPT.md
    │   ├── REFERENCE_BOARD.md
    │   └── REFERENCES/
    ├── 06_scene/
    │   ├── SCENE_BIBLE.md
    │   ├── LIGHTING_GUIDE.md
    │   └── LOCATION_OR_SET_NOTES.md
    ├── 07_keyframes/
    │   ├── README.md
    │   ├── KEYFRAME_PLAN.md
    │   ├── SEEDREAM_KEYFRAMES.md
    │   └── KEYFRAMES/               # 【空文件夹】用于放置后续生成的关键帧图片
    ├── 08_cinematography/
    │   ├── CAMERA_LANGUAGE.md
    │   ├── MOVEMENT_PLAN.md
    │   └── LENS_NOTES.md
    ├── 09_assets/
    │   ├── raw/
    │   ├── processed/
    │   ├── selects/
    │   └── asset_manifest.md
    ├── 10_edit/
    │   ├── EDIT_PLAN.md
    │   ├── CUT_NOTES.md
    │   └── VERSION_LOG.md
    ├── 11_audio/
    │   ├── MUSIC_PLAN.md
    │   ├── VOICE_PLAN.md
    │   ├── SFX_PLAN.md
    │   └── AUDIO_ASSETS/
    ├── 12_delivery/
    │   ├── review_exports/
    │   ├── FINAL_EXPORTS/
    │   └── DELIVERY_NOTE.md
    └── 13_review/
        ├── POSTMORTEM.md
        └── REUSABLE_LESSONS.md
```

---

## 二、各阶段工具调用说明

| 阶段 | 阶段名称 | 负责人 | 核心交付物 | 完成标准 |
|---|---|---|---|---|
| 阶段 1 | 需求定义与视觉顶层设计 | 总导演（全责） | `USER.md`、`PROJECT_BRIEF.md`、`VISUAL_STYLE_GUIDE.md`、`COLOR_SCRIPT.md`、`REFERENCE_BOARD.md` | **必须在所有执行前完成**；目标、平台、时长、风格、分辨率、IP、约束全部明确；视觉风格顶层定义完成 |
| 阶段 2 | 故事编写 | 故事小说家 | 故事大纲 | 有起承转合、教学目标清晰、角色动机明确 |
| 阶段 3 | 剧本 | 编剧 | 完整剧本 | 对白自然、与故事大纲一致 |
| 阶段 4 | 选角与角色定义 | 选角导演 | 角色设定文件、角色参考图 | 角色形象、色彩、性格、识别锚点明确，与视觉风格统一；**确认角色后调用 seedream 工具生成角色样图，保存到公司项目文件夹** |
| 阶段 5 | 分镜设计 | 分镜导演 | `STORYBOARD_MASTER.md`、镜头清单 | 符合「6 条强制技术规则」：1镜头≤2关键帧、中文景别、准确方位、关键帧只描述静态画面 |
| 阶段 6 | 场景美术落地 | 场景美术 | `SCENE_BIBLE.md`、逐镜头穿帮检查、灯光指南 | 逐镜头细化与穿帮检查；无穿帮、场景细节完整、空间连续性一致 |
| 阶段 7 | 关键帧设计 | 镜头关键帧设计 | 关键帧画稿/描述 | 按 2 个关键帧/镜头做基础；视觉风格统一、符合分镜、关键动作定格准确；**确认关键帧设计后，调用 seedream 工具生成关键帧** |
| 阶段 8 | 镜头生成 | 摄影指导 | 运镜方案、焦段建议、光影方案、成片镜头 | 优化判断关键帧数量，**根据不同需求调用不同工具生成镜头**；镜头语言清晰、运镜节奏明确、光影与情绪匹配 |

---

## 二、每个目录的用途、维护人、更新规则

| 目录 / 文件 | 用途 | 主要维护人 | 何时更新 |
|---|---|---|---|
| `00_admin/PROJECT_BRIEF.md` | 项目需求真相源，记录目标、平台、时长、风格、硬约束 | 总导演 | 需求变化时立即更新 |
| `00_admin/PROJECT_STATUS.md` | 记录当前进度、阻塞点、下一步 | 总导演 / 项目负责人 | 每个关键阶段结束后更新 |
| `00_admin/CHANGELOG.md` | 记录版本变化及影响范围 | 总导演 | 每次需求或方向变更时更新 |
| `00_admin/ROLE_RESPONSIBILITY.md` | 记录岗位分工与边界 | 总导演 | 角色变动或新增岗位时更新 |
| `00_admin/MEETING_NOTES.md` | 会议纪要、口头结论回写 | 会议组织者 | 每次重要沟通后更新 |
| `01_story/WORLD_SETTING.md` | 世界观、故事规则、背景设定 | 故事小说家 | 世界观首次建立或调整时 |
| `01_story/STORY_OUTLINE.md` | 故事大纲、核心冲突、情绪走向 | 故事小说家 / 编剧 | 大纲变化时 |
| `01_story/STORY_NOTES.md` | 备选桥段、灵感、废案说明 | 故事小说家 | 讨论过程中持续补充 |
| `02_characters/CHARACTER_BIBLE.md` | 角色设定全集 | 选角导演 / 故事小说家 | 角色设定变化时 |
| `02_characters/RELATIONSHIP_MAP.md` | 人物关系图与互动逻辑 | 故事小说家 | 角色关系变化时 |
| `02_characters/CASTING_NOTES.md` | 角色视觉匹配、演员/形象建议 | 选角导演 | 角色确定与调整时 |
| `03_script/BEAT_SHEET.md` | 节奏点、段落目标、情绪设计 | 编剧 | 进入正式剧本前或重构时 |
| `03_script/SCRIPT_V1.md` 等 | 正式剧本版本文件 | 编剧 | 每次迭代生成新版本 |
| `03_script/DIALOGUE_NOTES.md` | 对白优化与表演提示 | 编剧 | 对白打磨阶段 |
| `04_storyboard/STORYBOARD_MASTER.md` | 分镜主文件 | 分镜导演 | 分镜迭代时 |
| `04_storyboard/SHOTLIST.csv` | 镜头清单，方便协同与执行 | 分镜导演 / 摄影指导 | 分镜确认后同步 |
| `04_storyboard/RHYTHM_NOTES.md` | 节奏、转场、镜头密度说明 | 分镜导演 | 节奏有调整时 |
| `05_visual/VISUAL_STYLE_GUIDE.md` | 统一视觉语言说明 | **总导演**（必须在阶段1确定） | 风格确认或变化时 |
| `05_visual/COLOR_SCRIPT.md` | 色彩情绪规划 | 总导演 | 视觉方案明确时 |
| `05_visual/REFERENCE_BOARD.md` | 视觉参考索引 | 总导演 | 新增参考时 |
| `06_scene/SCENE_BIBLE.md` | 场景说明、布景逻辑、逐镜头穿帮检查 | 场景美术 | 场景方案变化时 |
| `06_scene/LIGHTING_GUIDE.md` | 灯光风格、氛围说明 | 场景美术 / 摄影指导 | 灯光方案更新时 |
| `06_scene/LOCATION_OR_SET_NOTES.md` | 场地 / 棚景备注 | 场景美术 / 制片协同 | 场地方案调整时 |
| `07_keyframes/README.md` | 07_keyframes 目录结构规范 | 总导演 | 目录结构调整时 |
| `07_keyframes/KEYFRAME_PLAN.md` | 哪些镜头要做关键帧以及目的 | 镜头关键帧设计 | 分镜确认后 |
| `07_keyframes/SEEDREAM_KEYFRAMES.md` | Seedream 工具提示词（唯一主文件） | 镜头关键帧设计 | 关键帧迭代时 |
| `07_keyframes/KEYFRAMES/` | 【空文件夹】用于放置后续生成的关键帧图片，当前不要放任何文件 | - | 后续生成图片时 |
| `08_cinematography/CAMERA_LANGUAGE.md` | 镜头语言原则 | 摄影指导 | 摄影方案确立时 |
| `08_cinematography/MOVEMENT_PLAN.md` | 运镜设计 | 摄影指导 | 运镜调整时 |
| `08_cinematography/LENS_NOTES.md` | 镜头焦段、视角、机位备注 | 摄影指导 | 镜头设计阶段 |
| `09_assets/raw/` | 原始素材存放 | 对应执行岗位 | 素材生成后立即归档 |
| `09_assets/processed/` | 清洗后素材 | 对应执行岗位 | 处理后归档 |
| `09_assets/selects/` | 可直接使用的精选素材 | 项目负责人 / 剪辑 | 初筛完成后 |
| `09_assets/asset_manifest.md` | 素材清单、来源、用途、状态 | 项目负责人 | 每次素材新增时 |
| `10_edit/EDIT_PLAN.md` | 剪辑方向、结构策略 | 剪辑 | 开始剪辑前 |
| `10_edit/CUT_NOTES.md` | 版本观看反馈 | 总导演 / 剪辑 | 每轮审片后 |
| `10_edit/VERSION_LOG.md` | 剪辑版本记录 | 剪辑 | 每次导出版后 |
| `11_audio/MUSIC_PLAN.md` | 配乐策略与点位 | 配乐 | 音乐方案形成时 |
| `11_audio/VOICE_PLAN.md` | 配音角色、台词、语气计划 | 配音负责人 | 配音前后 |
| `11_audio/SFX_PLAN.md` | 音效思路和清单 | 音效负责人 | 音效设计阶段 |
| `12_delivery/review_exports/` | 审核版导出文件 | 剪辑 / 项目负责人 | 每轮送审时 |
| `12_delivery/FINAL_EXPORTS/` | 最终交付文件 | 项目负责人 | 定版时 |
| `12_delivery/DELIVERY_NOTE.md` | 交付说明、版本信息、注意事项 | 项目负责人 | 最终交付时 |
| `13_review/POSTMORTEM.md` | 复盘：问题、返工、经验 | 总导演 + 各岗位 | 项目收尾时 |
| `13_review/REUSABLE_LESSONS.md` | 可模板化的经验和 SOP | 总导演 | 复盘后沉淀 |

---

## 三、关键目录补充说明

### 05_visual/ - 视觉风格层（总导演全责，必须在阶段1确定）
- **重要**：此目录由总导演负责，必须在所有执行前完成
- 核心文件：`VISUAL_STYLE_GUIDE.md`、`COLOR_SCRIPT.md`、`REFERENCE_BOARD.md`
- 目的：定义全片视觉语言，作为下游所有岗位的统一参考

### 07_keyframes/ - 关键帧设计（两大分支）
- **主文件**：`SEEDREAM_KEYFRAMES.md`
- **分支1（有参考图）**：提示词只需要参考图说明，不需要完整的分支2结构
- **分支2（无参考图）**：完整提示词结构（统一要素+景别+镜头角度+构图+角色描述+...+质量提示词）
- **详细标准**：见公司级文件 `KEYFRAME_DESIGN_STANDARD.md`

---

## 四、核心文件模板建议

以下文件是每个项目一定要优先建立并维护好的：

1. `PROJECT_BRIEF.md` - 需求真相源
2. `CHANGELOG.md` - 版本记录
3. `CHARACTER_BIBLE.md` - 角色设定
4. `STORYBOARD_MASTER.md` - 分镜主文件
5. `SEEDREAM_KEYFRAMES.md` - 关键帧提示词（如需要）

因为它们分别控制：
- 需求是否一致
- 版本是否清楚
- 角色是否稳定
- 镜头是否统一
- 关键帧是否可直接用于生产

---

## 五、项目目录命名建议

建议格式：

`项目代号-项目名-年份`

例如：
- `P001-滑梯旁的小恐龙-2026`
- `P002-狐妖短剧-2026`
- `P003-品牌广告测试片-2026`

---

## 六、文件状态标记建议

建议在文件顶部标记：

- `状态：草稿`
- `状态：待审`
- `状态：已确认`
- `状态：已废弃`

并附：
- 版本号
- 更新时间
- 维护人

---

## 七、全员强制规则（来自 TEAM_RULES.md）

### 1. 存档规则
- **个人内容**（写入个人工作区）：个人学习规则、工作方法、长期经验
- **项目内容**（写入公司项目工作文档区）：项目相关的所有内容、版本变更、阶段产出
- ❌ 禁止：项目内容只留在对话框，不写入文件

### 2. 交付结果双同步（强制）
所有重要产出必须按以下两步执行：
1. **第一步**：把完整内容写入公司项目工作文档区
2. **第二步**：把完整的、可直接审阅的核心内容同步贴入对话框告知用户
   - ❌ 禁止：只改文件不说话
   - ❌ 禁止：只说话不改文件
   - ❌ 禁止：只贴一句「已完成」而不贴具体内容

### 3. 项目文档区保持稳定
- ✅ 优先：在现有既定文件里更新内容
- ❌ 不要：随便新增文件
- ⚠️ 如需新增：先跟总导演确认

---

## 八、分镜设计强制技术规则

分镜导演必须 100% 遵守：
1. 一个镜头只承担一个主变化
2. 一个镜头最多对应两个关键帧
3. 景别统一使用中文（远景、中景、中近景、近景、特写）
4. 使用准确方位描述（如「画面左侧」，不要说「画面一侧」）
5. 关键帧只描述静态画面，不描述运动
6. 关键帧一句话说完，用逗号分隔，不分段

---

## 九、维护底线

1. 不允许只在聊天里确认，不回写文件
2. 不允许覆盖旧版本而不留记录
3. 不允许把"最终版"文件名反复改乱
4. 不允许跨岗位随意改别人主文件而不留说明
5. 不允许项目结束后不归档、不复盘

---

## 十、公司级资产库体系

公司级资产库存放于：`/home/honeycake/project/film-company/agent/workspace-film-company/assets/`

| 资产库 | 用途 | 说明 |
|---|---|---|
| `characters/` | 固定角色库 | 跨项目复用的固定 IP（如 Polly） |
| `project_characters/` | 项目角色库 | 单项目专用角色（选角导演生成） |
| `scenes/` | 场景库 | 场景参考图（场景美术调用 Seedream 生成） |
| `styles/` | 美术风格库 | 皮克斯风格、迪士尼风格、手绘风格等 |
| `camera_templates/` | 运镜模板库 | 常用运镜与镜头角度组合 |

---

## 十一、公司级标准文件

所有岗位必须遵守的公司级标准文件：
- `TEAM_RULES.md` - 团队协作统一规则
- `WORKFLOW_STANDARD.md` - 标准化工作流程
- `KEYFRAME_DESIGN_STANDARD.md` - 关键帧设计岗位标准
- `PROJECT_LIBRARY_TEMPLATE.md` - 本文件，项目共享资料库模板

---

## 十二、一句话总结

项目共享资料库不是"文件堆放区"，而是整个项目的共同记忆系统。谁负责什么、什么文件算准、什么时候更新，必须事先定义清楚，团队才能真正稳定协作。
