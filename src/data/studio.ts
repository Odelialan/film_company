import {
  Aperture,
  Bot,
  Brush,
  Clapperboard,
  FileText,
  Film,
  FolderKanban,
  Images,
  KanbanSquare,
  MonitorPlay,
  PenLine,
  Sparkles,
  Users,
  Wand2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Agent = {
  id: string;
  name: string;
  role: string;
  workspace: string;
  status: "ready" | "working" | "review";
  icon: LucideIcon;
  input: string;
  output: string;
  color: string;
};

export type Stage = {
  id: string;
  title: string;
  owner: string;
  artifact: string;
  gate: string;
  progress: number;
};

export const agents: Agent[] = [
  {
    id: "director",
    name: "总导演",
    role: "需求澄清、视觉顶层、流程推进与变更同步",
    workspace: "/home/honeycake/project/film-company/agent/workspace-director",
    status: "working",
    icon: Clapperboard,
    input: "用户需求、参考链接、平台约束、IP 限制",
    output: "PROJECT_BRIEF、PROJECT_STATUS、视觉顶层定义",
    color: "#f05d9e"
  },
  {
    id: "novelist",
    name: "故事小说家",
    role: "世界观、故事原型、人物动机和情绪弧线",
    workspace: "/home/honeycake/project/film-company/agent/workspace-story-novelist",
    status: "ready",
    icon: PenLine,
    input: "项目简报、角色目标、受众与主题",
    output: "WORLD_SETTING、STORY_OUTLINE、STORY_NOTES",
    color: "#56c7f2"
  },
  {
    id: "casting",
    name: "选角导演",
    role: "角色识别锚点、造型稳定性和视觉匹配",
    workspace: "/home/honeycake/project/film-company/agent/workspace-casting-director",
    status: "review",
    icon: Users,
    input: "剧本角色、视觉风格、已有角色资产",
    output: "CHARACTER_BIBLE、CASTING_NOTES、角色参考图",
    color: "#ffb454"
  },
  {
    id: "storyboard",
    name: "分镜导演",
    role: "把剧本文字翻译成镜头级叙事方案",
    workspace: "/home/honeycake/project/film-company/agent/workspace-storyboard-director",
    status: "ready",
    icon: KanbanSquare,
    input: "SCRIPT、BEAT_SHEET、视觉风格与角色设定",
    output: "STORYBOARD_MASTER、SHOTLIST、RHYTHM_NOTES",
    color: "#7de2b8"
  },
  {
    id: "scene",
    name: "场景美术",
    role: "场景、布景、材质、灯光氛围与穿帮检查",
    workspace: "/home/honeycake/project/film-company/agent/workspace-scene-art",
    status: "ready",
    icon: Brush,
    input: "分镜、视觉风格、角色位置和空间关系",
    output: "SCENE_BIBLE、LIGHTING_GUIDE、LOCATION_NOTES",
    color: "#b8c0ff"
  },
  {
    id: "keyframe",
    name: "关键帧设计",
    role: "核心画面、关键动作定格与 Seedream 提示词",
    workspace: "/home/honeycake/project/film-company/agent/workspace-keyframe-designer",
    status: "working",
    icon: Images,
    input: "分镜、场景圣经、角色参考与镜头目标",
    output: "KEYFRAME_PLAN、SEEDREAM_KEYFRAMES、KEYFRAMES",
    color: "#f7d06b"
  },
  {
    id: "cinematographer",
    name: "摄影指导",
    role: "镜头语言、运镜、焦段、光影和视频生成决策",
    workspace: "/home/honeycake/project/film-company/agent/workspace-cinematographer",
    status: "ready",
    icon: Aperture,
    input: "关键帧、SHOTLIST、场景与光影方案",
    output: "CAMERA_LANGUAGE、MOVEMENT_PLAN、LENS_NOTES",
    color: "#8fe6ff"
  }
];

export const stages: Stage[] = [
  { id: "01", title: "需求进入", owner: "总导演", artifact: "00_admin/PROJECT_BRIEF.md", gate: "8 个关键要素明确", progress: 92 },
  { id: "02", title: "立项与排期", owner: "总导演", artifact: "PROJECT_STATUS、ROLE_RESPONSIBILITY", gate: "岗位与顺序确定", progress: 86 },
  { id: "03", title: "故事与角色基础", owner: "故事小说家 + 编剧", artifact: "WORLD_SETTING、STORY_OUTLINE", gate: "人物动机清楚", progress: 70 },
  { id: "04", title: "剧本定稿", owner: "编剧", artifact: "SCRIPT_V1/V2、BEAT_SHEET", gate: "标记为可分镜", progress: 58 },
  { id: "05", title: "分镜设计", owner: "分镜导演", artifact: "STORYBOARD_MASTER、SHOTLIST", gate: "镜头能直接执行", progress: 46 },
  { id: "06", title: "视觉与场景", owner: "场景美术 + 总导演", artifact: "VISUAL_STYLE、SCENE_BIBLE", gate: "风格和空间统一", progress: 39 },
  { id: "07", title: "关键帧与摄影", owner: "关键帧设计 + 摄影指导", artifact: "KEYFRAME_PLAN、CAMERA_LANGUAGE", gate: "关键帧和运镜可生成", progress: 30 },
  { id: "08", title: "制作与素材", owner: "执行岗位", artifact: "09_assets/asset_manifest.md", gate: "素材命名与来源清楚", progress: 18 },
  { id: "09", title: "后期整合", owner: "剪辑 / 音频", artifact: "EDIT_PLAN、MUSIC、VOICE、SFX", gate: "节奏和听感统一", progress: 8 },
  { id: "10", title: "交付复盘", owner: "总导演 + 项目负责人", artifact: "DELIVERY_NOTE、POSTMORTEM", gate: "定版与经验沉淀", progress: 4 }
];

export const documents = [
  { name: "PROJECT_BRIEF.md", folder: "00_admin", owner: "总导演", state: "已确认" },
  { name: "CHARACTER_BIBLE.md", folder: "02_characters", owner: "选角导演", state: "待审" },
  { name: "STORYBOARD_MASTER.md", folder: "04_storyboard", owner: "分镜导演", state: "草稿" },
  { name: "SCENE_BIBLE.md", folder: "06_scene", owner: "场景美术", state: "草稿" },
  { name: "SEEDREAM_KEYFRAMES.md", folder: "07_keyframes", owner: "关键帧设计", state: "制作中" },
  { name: "CAMERA_LANGUAGE.md", folder: "08_cinematography", owner: "摄影指导", state: "待启动" }
];

export const nav = [
  { id: "cockpit", label: "驾驶舱", icon: MonitorPlay },
  { id: "agents", label: "Agent", icon: Bot },
  { id: "pipeline", label: "流程", icon: FolderKanban },
  { id: "canvas", label: "画布", icon: Wand2 },
  { id: "docs", label: "文档", icon: FileText }
];

export const assets = [
  { src: "/assets/polly.png", title: "角色资产", tag: "Polly" },
  { src: "/assets/dino.png", title: "角色资产", tag: "小恐龙" },
  { src: "/assets/slide-scene.png", title: "场景资产", tag: "滑梯场景" }
];

export const loopSteps = ["接收消息", "上下文组装", "模型推理", "工具执行", "流式回复", "持久化归档"];

export const quickActions = [
  { label: "新建影片项目", icon: Film },
  { label: "生成分镜任务", icon: Sparkles },
  { label: "同步双通道交付", icon: FileText }
];
