# TOOLS.md - 本地工具与规范备忘

这里不写通用技能说明，只写这个岗位、这个环境下的本地规则。

## 这里适合记录什么

例如：

- 关键帧脚本的 JSON 结构路径与导出约定
- 模型参数命名方式（比例、强度、负面提示词等）
- `shot_id` / `frame_id` 的命名规则
- 提示词结构偏好（语言、顺序、重点层级）
- 与关键帧设计有关的环境特定规则

## 共享协作参照文件

在影视公司工程内协作时，先对齐以下共享真相源：

- `/home/honeycake/project/film-company/agent/workspace-film-company/TEAM_WORKFLOW.md`
- `/home/honeycake/project/film-company/agent/workspace-film-company/PROJECT_LIBRARY_TEMPLATE.md`

不要只根据群聊消息直接开工，必须先确认正式项目文件。

## 本岗位当前职责文件

镜头关键帧设计岗位重点维护：

- `07_keyframes/KEYFRAME_PLAN.md`
- `07_keyframes/KEYFRAMES/`

## 关键帧交付建议字段

关键帧交付内容建议至少包含：

- `shot_id` / `frame_id`
- 该帧目的与叙事功能
- 主体与角色连续性说明
- 动作 / 姿态 / 视线 / 站位
- 构图重点与镜头相对关系
- 场景元素与光线提示
- 质量要求
- 生成参数 / 执行说明
- 负面约束
- 面向摄影 / 图像视频生成 / 后期的交接备注

## 上下游文件意识

上游依赖常见包括：

- `04_storyboard/STORYBOARD_MASTER.md`
- `04_storyboard/SHOTLIST.csv`
- `02_characters/CHARACTER_BIBLE.md`
- `05_visual/VISUAL_STYLE_GUIDE.md`
- `06_scene/SCENE_BIBLE.md`

下游使用方常见包括：

- 摄影指导
- 关键帧绘制 / 图像视频生成
- 后期画面统一与校对

## 文件纪律

- 正式结论必须写回项目文件，不能只留在聊天里
- 平台、时长、风格、剧情、角色设定发生变化时，先更新文档，再继续关键帧设计
- 项目目录内正式文件是唯一真相源，不保留私人并行“最终版”

这是本岗位的本地速查表，后续可持续补充。

## 即梦 Dreamina CLI

- 线上 Linux CLI：`/home/honeycake/.local/bin/dreamina`
- 登录自检：`dreamina user_credit`
- 详细帮助：`dreamina -h` 与 `dreamina <subcommand> -h`
- 本岗位技能文件：`skills/dreamina-cli/SKILL.md`

关键帧图片生成：

```bash
dreamina text2image --prompt="<关键帧提示词>" --ratio=16:9 --resolution_type=2k --model_version=5.0
```

参考图改图：

```bash
dreamina image2image --images=<本地图片路径> --prompt="<改图提示词>" --ratio=16:9 --resolution_type=2k --model_version=5.0
```

关键帧转视频：

```bash
dreamina image2video --image=<关键帧图片路径> --prompt="<运动提示词>" --duration=5 --model_version=seedance2.0fast
```

归档规则：

- 图片结果写入当前项目 `07_keyframes/KEYFRAMES/`。
- 视频结果写入当前项目 `09_assets/processed/`。
- 每次真实生成必须记录 `submit_id`、命令类型、生成提示词和结果文件路径。
- 未登录、余额不足、任务失败时，不写占位文件，直接返回 Dreamina CLI 的真实错误。
