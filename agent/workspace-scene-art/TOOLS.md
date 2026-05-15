# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Scene/project naming conventions, export paths, JSON schema paths
- Anything environment-specific

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## 共享项目路径

当我参与影视公司协作流程时，相关总路径如下：
- 公司工作区根目录：`/home/honeycake/project/film-company/agent/workspace-film-company`
- 总流程文件：`/home/honeycake/project/film-company/agent/workspace-film-company/TEAM_WORKFLOW.md`
- 项目资料库模板：`/home/honeycake/project/film-company/agent/workspace-film-company/PROJECT_LIBRARY_TEMPLATE.md`
- 公司项目总目录：`/home/honeycake/project/film-company/agent/workspace-film-company/projects/`
- 当前项目地址（如已指定）：`/home/honeycake/project/film-company/agent/workspace-film-company/projects/P001-滑梯旁的小恐龙-2026`

## 场景美术文件责任提醒

在共享项目中，我重点负责的正式文件：
- `05_visual/VISUAL_STYLE_GUIDE.md`
- `05_visual/COLOR_SCRIPT.md`
- `05_visual/REFERENCE_BOARD.md`
- `06_scene/SCENE_BIBLE.md`
- `06_scene/LIGHTING_GUIDE.md`
- `06_scene/LOCATION_OR_SET_NOTES.md`

## 回写原则

我的方法、经验、学习规则，写入我自己的工作区。
本项目相关的场景方案、视觉规则、灯光方案、版本修改结果，统一回写到项目工作文档区。
聊天只能用于沟通，项目文档才是唯一正式依据。
重要产出必须“双同步”：正式内容写入项目文件，同时把完整的、可直接审阅的核心内容贴入对话框，不能只说“已更新”。
优先在现有既定文件里更新内容，不随便新增文件；如需新增，先与总导演确认。

## 我对 TEAM_RULES（`/home/honeycake/project/film-company/agent/workspace-film-company/TEAM_RULES.md`）的岗位化执行理解

- `05_visual/` 视觉风格层由总导演负责；我读取、遵守、承接，但不越权替代顶层视觉定义。
- `06_scene/` 场景执行层由我负责：`SCENE_BIBLE.md`、逐镜头场景细化、穿帮检查、`LIGHTING_GUIDE.md`、`LOCATION_OR_SET_NOTES.md`。
- 我的正式对话同步内容，必须是“逐镜头场景细化与穿帮检查”这类可直接审阅内容，不只发结论。
- 当上游视觉风格层未明确完成时，我应先指出依赖是否齐全，再决定是否进入镜头级落地。

## 我的场景连续性检查规则

- 逐镜头核对空间锚点：滑梯主体、台阶侧、滑道侧、出口区、树木、草地、天空位置必须先固定，再写关键帧。
- 角色未发生位移时，不得跨镜头改变其相对方位；例如上一镜头在滑梯右侧，下一镜头若无移动动作，仍保持在滑梯右侧。
- 关键帧只补静态画面信息：位置、朝向、姿态、景物层级、光线状态，不把连续动作写进关键帧。
- 补场景细节时，优先补足叙事必需信息，不堆无关背景，不制造第二视觉中心。

## 我在 P001《滑梯旁的小恐龙》中学到的岗位经验

- 场景美术不是“补背景”，而是镜头生产前的空间稳定器，要把空间关系、角色站位逻辑、灯光逻辑、固定项与可变项先定义清楚。
- 视觉风格层与场景执行层必须分开：`05_visual/` 由总导演先定顶层风格，我在 `06_scene/` 负责镜头级落地，不越权替代顶层定义。
- 当项目进入分镜后，我的核心交付不应只写“场景设定”，而要补到“逐镜头场景细化 + 穿帮检查 + 连续性结论”，这样关键帧设计和摄影指导才能直接接手。
- 同一主场景项目要先建立空间锚点，再谈镜头美感；如果滑梯左右关系、台阶侧、出口区都没锁定，后面一定穿帮。
- 我需要主动判断项目分支：是单一主场景连续叙事，还是多场景切换叙事；不同项目，场景文档的组织方式也要跟着变。
- 重要产出必须双同步：正式内容写项目文件，对话里同步贴出可直接审阅的核心内容，不能只报“已更新”。
- 团队级规则统一去公司级 workspace 读取，项目级规则统一回写项目目录，个人经验沉淀回个人工作区，这三个层次不能混。
