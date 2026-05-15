# TOOLS.md - 摄影指导本地工具与记录规则

## 本文件用途

记录摄影指导岗位的本地工具习惯、命名规则、执行偏好、模型路径、导出格式与环境特有信息。
不要把人格规则写在这里；行为约束与工作流程写入 `AGENTS.md`。

## 文件归档原则

- 群聊中的结论不是正式交付，正式版本必须回写到工作区文件或项目文件
- 与岗位职责、工作规则、会话启动流程有关的内容写入 `AGENTS.md`
- 与用户背景、偏好、上下文有关的内容写入 `USER.md`
- 与模型、路径、命名、执行参数、导出格式有关的内容写入本文件
- 与长期可复用经验有关的内容写入 `MEMORY.md`
- 与当天事项、临时决定、执行日志有关的内容写入 `memory/YYYY-MM-DD.md`

## 项目文件位置

### 公司项目总目录
- `/home/honeycake/project/film-company/agent/workspace-film-company/projects/`

### 当前项目目录
- `/home/honeycake/project/film-company/agent/workspace-film-company/projects/P001-滑梯旁的小恐龙-2026`

## 摄影指导岗位正式输出文件

项目中的正式输出优先写入：
- `08_cinematography/CAMERA_LANGUAGE.md`
- `08_cinematography/MOVEMENT_PLAN.md`
- `08_cinematography/LENS_NOTES.md`

联动参考：
- `04_storyboard/SHOTLIST.csv`
- `07_keyframes/KEYFRAME_PLAN.md`
- `07_keyframes/KEYFRAMES/`

## 摄影指导执行经验（P001《滑梯旁的小恐龙》沉淀）

### 1. 关键帧数量判断规则
- 简单运镜、稳镜对白、同一空间内的微表情 / 微手势 / 轻口型变化，优先使用 **1 个关键帧**。
- 从无到有、明显位移、遮挡前后变化、角色进入退出、上滑梯 / 下滑梯、空间层级明显变化，使用 **2 个关键帧**。

### 2. 视频生成工具选择
- **1 个关键帧生成视频：Seedance**
- **2 个关键帧首尾帧生成视频：即梦 3.0**

### 3. 摄影指导工作输入文件
优先读取以下项目文件：
- `04_storyboard/STORYBOARD_MASTER.md`
- `07_keyframes/SEEDREAM_KEYFRAMES.md`
- `05_visual/VISUAL_STYLE_GUIDE.md`
- `06_scene/SCENE_BIBLE.md`

### 4. 摄影指导正式输出文件
优先回写：
- `08_cinematography/CAMERA_LANGUAGE.md`
- `08_cinematography/MOVEMENT_PLAN.md`
- `08_cinematography/LENS_NOTES.md`

### 5. 本岗位在儿童叙事项目中的摄影优先级
- 先保证角色表情可读
- 再保证教学关系可读
- 再保证滑梯等空间锚点可读
- 最后才考虑镜头张力增强

### 6. 高风险镜头类型
- 遮挡前后变化镜头
- 上下台阶镜头
- 并排滑行镜头
- 从双人关系整理到三人同框的收束镜头

## 后续建议记录项

后续可继续补充：
- 视频模型名称与适用镜头类型
- 运镜预设（推进、拉远、平移、跟拍、环绕、定镜微动）
- 导出命名规范
- 修复策略速查表
- 常用路径与交付格式
- 不同镜头复杂度对应的执行方案
