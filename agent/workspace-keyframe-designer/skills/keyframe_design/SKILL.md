---
name: keyframe-design
description: 为 AI 视频项目生成可直接写入 `07_keyframes/KEYFRAME_PLAN.md` 与 `07_keyframes/SEEDREAM_KEYFRAMES.md` 的关键帧设计内容；在需要把分镜转成 Seedream 可用提示词，并且必须遵循 `KEYFRAME_DESIGN_STANDARD.md` 时使用。若任务目标为 `9:16`、`3:4` 或 `2:3` 竖构图，必须联动加载 `vertical-short-video-rhythm`。
---

# 关键帧镜头序列设计（Keyframe Design）

## Pattern

`generator`：依据场景类型选择参考模块，并按项目既有关键帧标准生成可直接落盘的双文件产物，不替代导演总纲或单镜画面细化。

## Purpose

在剧本、分镜或场景描述已给定的前提下，产出**关键帧计划**与**Seedream 提示词**两份标准文档内容；覆盖对话、动作、情感、悬疑惊悚、蒙太奇与转场五类，并将镜头序列转成符合项目标准的关键帧提示词。

## When To Use

- 用户需要把分镜或镜头序列转成 `07_keyframes/` 目录下的正式交付内容。
- 场景类型属于：对话、动作戏、情感戏、悬疑惊悚、蒙太奇或场景间转场。
- 需要输出 Seedream 可直接使用的关键帧提示词，并满足固定参考图、传入参考图、连续性简化等规则。
- 若目标画幅为 `9:16`、`3:4` 或 `2:3` 任一竖构图，必须同时应用 `skills/vertical-short-video-rhythm/` 中的节奏优化规则。

## Instructions

1. **先读取强制规则**：必须先阅读 `/home/honeycake/project/film-company/agent/workspace-film-company/KEYFRAME_DESIGN_STANDARD.md`，再开始生成；其中分支判断、参考图编号、连续性简化、提示词结构公式、双同步要求均为硬约束。
2. **确认输入**：场景简述、人物与空间、情绪或类型片倾向、总时长或段落时长上限、目标画幅、是否有参考图、上游分镜文件、角色与场景参考图位置【若缺失则按 style-guide 中的【待确认】标注并采用合理默认】。
3. **先判断是否为竖构图联动任务**：若目标画幅为 `9:16`、`3:4` 或 `2:3`，必须先加载 `skills/vertical-short-video-rhythm/`，并把该 skill 输出的节奏规则合并到关键帧与运镜设计中；若为其他画幅，则跳过此联动。
4. **先做分支判断**：按标准区分「有参考图项目」与「无参考图项目」；若未明确，默认先输出【待确认：是否有参考图】并暂停写最终提示词中的引用编号。
5. **划分场景类型**：若单段含多类型，按主导类型选主参考；次要类型在镜头说明中单列「混合说明」。
6. **加载对应参考**（只读扩展，按需打开）：
   - 对话：`references/dialogue-sequence.md`
   - 动作：`references/action-sequence.md`
   - 情感：`references/emotional-sequence.md`
   - 悬疑惊悚：`references/suspense-thriller.md`
   - 蒙太奇与转场：`references/montage-transition.md`
7. **生成镜头级基础信息**：必须先形成每个镜头的叙事目的、对白、镜头类别、运镜方式、关键帧数量判断、每个关键帧的静态画面状态；动作/悬疑/蒙太奇须体现节奏与剪辑意图（硬切、叠化、匹配点等）。若已联动竖构图 skill，则镜头节奏、景别密度、钩子与安全区必须同步满足竖构图规则。
8. **按项目双文件格式输出**：严格使用 `assets/report-template.md` 中规定的双文件结构，分别组织为：
   - `KEYFRAME_PLAN.md`
   - `SEEDREAM_KEYFRAMES.md`
9. **提示词构建规则**：
   - 有参考图项目：每个关键帧必须单独列出 `**提示词**` 与 `**传入参考图**`，并保证「参考图 X」与传入顺序完全一致。
   - 无参考图项目：遵循标准中的统一要素、角色描述一次性原则、逗号分隔短语原则。
10. **继承分镜字段**：`SEEDREAM_KEYFRAMES.md` 中每个镜头都必须标注：
   - `对白`：继承自分镜阶段；无对白时写 `无`
   - `镜头类别`：继承自分镜阶段，如对白镜头、动作镜头、情绪反应镜头、转场镜头、空镜等
11. **衔接说明**：在 `KEYFRAME_PLAN.md` 中明确上游依赖与下游使用说明；在 `SEEDREAM_KEYFRAMES.md` 中保留镜头描述、对白、镜头类别、运镜提示词、关键帧与格式检查。

## Output

- 输出必须对齐 `/home/honeycake/project/film-company/agent/workspace-film-company/projects/_PROJECT_TEMPLATE/07_keyframes/` 的双文件格式，而不是自定义单报告格式。
- `KEYFRAME_PLAN.md` 与 `SEEDREAM_KEYFRAMES.md` 的章节骨架、关键字段、参考图表头必须保留。
- `SEEDREAM_KEYFRAMES.md` 的镜头级字段至少包括：`镜头描述`、`对白`、`镜头类别`、`运镜提示词`、`关键帧`、`传入参考图`。
- 中文撰写正文说明；镜头类型与字段键名可与参考文档中的英文标识一致以便检索。

## Constraints

- 不得编造用户未给出的剧情关键事实；信息不足处标「【待确认】」并列出缺项。
- 不得将本 Skill 写成纯影评或故事大纲；必须落到镜头、关键帧、提示词级条目。
- 同一任务内 Jump Scare、反转等强手段须控制频次，并与 references 中的频控建议一致。
- 有参考图项目下，连续镜头必须优先遵守「连续性简化原则」，不得机械重复传入原始角色图。
- 每个关键帧只描述静态画面，不描述运动；运动应写在「运镜提示词」中。
- 不展开单镜光影、布光、调色等极致参数之外的无关说明；所有描述都应服务于 Seedream 提示词生成。
- 只要目标画幅属于 `9:16`、`3:4`、`2:3` 任一竖构图，就不得跳过 `vertical-short-video-rhythm` 的联动加载与验收规则。

## References Map

| 场景 | 文件 |
|------|------|
| 对话 | `references/dialogue-sequence.md` |
| 动作 | `references/action-sequence.md` |
| 情感 | `references/emotional-sequence.md` |
| 悬疑惊悚 | `references/suspense-thriller.md` |
| 蒙太奇与转场 | `references/montage-transition.md` |
| 项目总标准 | `/home/honeycake/project/film-company/agent/workspace-film-company/KEYFRAME_DESIGN_STANDARD.md` |
| 模板：计划文件 | `/home/honeycake/project/film-company/agent/workspace-film-company/projects/_PROJECT_TEMPLATE/07_keyframes/KEYFRAME_PLAN.md` |
| 模板：提示词文件 | `/home/honeycake/project/film-company/agent/workspace-film-company/projects/_PROJECT_TEMPLATE/07_keyframes/SEEDREAM_KEYFRAMES.md` |
| 文风与版式 | `references/style-guide.md` |
| 输出映射说明 | `assets/report-template.md` |
