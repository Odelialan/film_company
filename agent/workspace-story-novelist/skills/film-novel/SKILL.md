---
name: film-novel
description: 生成可直接落到影视项目 `01_story` 目录的电影化故事文件。适用于用户要求写适合电影剧本改编的故事、电影感大纲、分章剧情、按时长定制故事体量，或要求将结果固定输出到项目故事目录的场景。
metadata:
  pattern: generator
  output-format: markdown
  fixed-output-dir: /home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story
---

# 电影故事生成器

你不是只输出一段故事文本，你要生成一组固定的项目故事文件，并写入项目目录。

## 固定输出位置

最终结果必须写入：

`/home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story/`

固定只产出或更新这 3 个文件，不额外新增其他故事文件，除非用户明确要求：

1. `STORY_OUTLINE.md`
2. `STORY_NOTES.md`
3. `WORLD_SETTING.md`

## 执行步骤

严格按以下步骤执行。

### 第 1 步：确认项目路径

先确认项目名称，拼出目标路径：

`/home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story/`

如果用户没有明确项目名称，先询问，不要猜。

### 第 2 步：读取项目上下文

优先读取这些项目文件。如果文件存在，必须先读再写：

- `.../<项目名称>/00_admin/PROJECT_BRIEF.md`
- `.../<项目名称>/00_admin/CHANGELOG.md`
- `.../<项目名称>/00_admin/ROLE_RESPONSIBILITY.md`
- `.../<项目名称>/01_story/STORY_OUTLINE.md`
- `.../<项目名称>/01_story/STORY_NOTES.md`
- `.../<项目名称>/01_story/WORLD_SETTING.md`

目的：

- 确认项目目标、平台、受众、时长和边界
- 避免覆盖已有有效内容
- 保证输出和当前项目版本一致

### 第 3 步：加载本 skill 的规则文件

先读取：

- `references/output-style-guide.md`

再读取模板：

- `assets/story-outline-template.md`
- `assets/story-notes-template.md`
- `assets/world-setting-template.md`

`SKILL.md` 只负责编排流程，不负责承载具体模板细节。最终输出时必须遵守样式指南和模板结构。

### 第 4 步：补齐必要变量

如果用户没有给全，先补齐以下最低必要信息。缺一个问一个，不要一次追问太多无关问题：

- 项目名称
- 故事类型
- 目标时长或目标篇幅
- 主角
- 主角目标
- 核心阻碍
- 失败代价
- 受众与平台语境
- 结尾要开放还是闭合
- 用户这次要：新建、重写、补全，还是只改局部

如果只是局部修改，也仍然要按固定文件结构回写到 `01_story`。

### 第 5 步：先确定故事主轴

在真正写文件前，先内部锁定这几个核心变量：

- 开场钩子是什么
- 主角动作线是什么
- 核心对抗线是什么
- 反转发生在哪里
- 决战如何落地
- tag 如何留下延续

如果这些变量不清楚，不要直接铺写。

### 第 6 步：按固定结构生成 3 份文件

生成时遵守以下分工，不要重复堆砌：

- `STORY_OUTLINE.md`：承载主要故事内容，是最核心文件，篇幅最多
- `WORLD_SETTING.md`：只写直接影响故事成立的世界、环境、规则和冲突土壤
- `STORY_NOTES.md`：只写创作抓手、风险、备选方案、待确认项，不复述大段剧情

### 第 7 步：写入目标目录

将生成结果直接写入：

- `/home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story/STORY_OUTLINE.md`
- `/home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story/STORY_NOTES.md`
- `/home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story/WORLD_SETTING.md`

如果目标文件已存在：

- 优先保留已确认且仍然有效的信息
- 只替换本次明确需要更新的内容
- 不因为追求整洁而删除用户未要求删除的内容

### 第 8 步：完成后返回固定结果

完成后，对用户返回一个固定回执，不要自由发挥，不要省略字段。

固定回执必须包含：

1. 本次更新的项目名称
2. 已写入的 3 个文件路径
3. 本次故事核心变化摘要
4. 本次已读取的规则文件
5. 如有缺失信息，明确列出 `待确认项`

固定回执格式如下：

```markdown
## 技能执行回执
- skill: film-novel
- 项目名称：<项目名称>
- 输出目录：/home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story

## 已读取文件
- references/output-style-guide.md
- assets/story-outline-template.md
- assets/story-notes-template.md
- assets/world-setting-template.md

## 已写入文件
- /home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story/STORY_OUTLINE.md
- /home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story/STORY_NOTES.md
- /home/honeycake/project/film-company/agent/workspace-film-company/projects/<项目名称>/01_story/WORLD_SETTING.md

## 本次故事核心变化
- <变化 1>
- <变化 2>

## 待确认项
- <如无则写：无>
```

执行本 skill 时，回复中必须出现 `## 技能执行回执` 这个标题，便于调用后人工核对。

## 核心输出原则

### 1. 故事内容优先

所有文件都要服务故事本身，不要写成泛泛的分析文档。

- 少空话
- 少重复
- 少抽象总结
- 多事件
- 多动作
- 多冲突
- 多可改编成戏的情节

### 2. 开场必须抓人

故事开头必须优先呈现最强的异常事件、危险、羞辱、裂口、追逐、背叛、失踪或生死危机。

- 必要时允许倒叙或插叙
- 不允许把最有力的钩子藏到中后段

### 3. 情绪必须外化

不要用大段心理分析充数。

必须把情绪写成：

- 对抗
- 动作
- 明确对白
- 视觉异象
- 后果

### 4. 每段都要有推进

每个主要段落都必须至少承担以下一种功能：

- 推进目标
- 放大阻碍
- 暴露秘密
- 改变关系
- 触发反转
- 提高代价

### 5. 结尾必须留钩或明确闭合

除非用户明确要求完整闭合，否则默认保留可继续发展的悬念或余波。

## 绝对不要做的事

- 不要额外新建说明文档
- 不要脱离 `01_story` 固定目录输出
- 不要把同样的故事内容在 3 个文件里重复写三遍
- 不要写成只有概念、没有情节推进的空架子
- 不要为了显得完整而堆砌无效设定
- 不要在用户未授权时改动 `01_story` 之外的项目文件

## 输出成功标准

只有同时满足以下条件，才算完成：

1. 目标项目 `01_story` 目录下已经写入固定的 3 个文件
2. 文件结构符合模板
3. `STORY_OUTLINE.md` 明显是故事主文件，内容不空
4. 三个文件之间职责清楚，不重复堆砌
5. 读者能直接把结果交给编剧继续开发
