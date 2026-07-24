import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, Command, FileCheck2, Folder, Image as ImageIcon, KeyRound, Loader2, MessageSquareText, Play, Plus, Radio, RefreshCw, Search, Send, Server, SlidersHorizontal, Video, X } from "lucide-react";
import { agents, assets, documents, loopSteps, nav, quickActions, stages } from "./data/studio";

const statusText = {
  ready: "待命",
  working: "运行中",
  review: "待审"
};

const promptModules = [
  {
    name: "秒数",
    description: "决定短片体量、节奏密度和分镜颗粒度",
    examples: ["10 秒", "45 秒", "90 秒", "180 秒", "1000 秒"]
  },
  {
    name: "类型",
    description: "告诉总导演这是广告、剧情、教学、预告还是系列内容",
    examples: ["儿童短片", "品牌广告", "奇幻剧情片", "悬疑预告", "科普短视频"]
  },
  {
    name: "风格",
    description: "决定美术、镜头、色彩、节奏和生成参考方向",
    examples: ["皮克斯式 3D 萌系", "真人电影感", "赛博朋克霓虹", "水彩绘本", "复古胶片"]
  },
  {
    name: "故事内容",
    description: "提供人物、场景、核心冲突和情绪闭环",
    examples: ["Polly 和小恐龙在滑梯旁交朋友", "夜之城少年第一次失控", "月球邮差送错礼物"]
  },
  {
    name: "具体要求",
    description: "约束交付物、平台、钩子、分镜、角色和文件归档",
    examples: ["前三秒强钩子", "输出剧本和分镜", "每镜头只承担一个变化", "列出关键帧清单"]
  }
];

const promptDurations = [
  10, 15, 20, 25, 30, 35, 45, 50, 60, 75,
  90, 100, 120, 150, 180, 210, 240, 300, 420, 600,
  720, 900, 1000
];

const promptTypes = [
  "儿童短片", "品牌广告", "奇幻剧情片", "悬疑预告片", "科普短视频",
  "音乐视觉短片", "角色出场片", "世界观概念片", "短剧第一集", "节日宣传片",
  "产品故事片", "公益广告", "校园青春片", "赛博朋克动作片", "治愈系绘本片",
  "亲子互动短片", "历史幻想片", "城市旅行片", "教育动画", "游戏剧情 PV"
];

const promptStyles = [
  "皮克斯式 3D 萌系", "真人电影感", "赛博朋克霓虹", "水彩绘本",
  "复古胶片", "日系治愈动画", "低饱和高级广告", "黑色电影",
  "黏土定格动画", "国风水墨", "法式浪漫喜剧", "太空歌剧",
  "明亮儿童教育风", "硬科幻写实", "梦核超现实", "港风霓虹",
  "手账拼贴", "北欧冷淡写实", "热血少年漫", "博物馆纪录片"
];

const promptStories = [
  "Polly 和小恐龙在滑梯旁因为排队发生小冲突，最后学会轮流玩",
  "一个小机器人第一天去幼儿园，不敢开口，Polly 引导孩子用英文和它交朋友",
  "夜之城少年在母亲离开后第一次装上危险义体，命运开始偏航",
  "月球邮差把一封迟到十年的信送到错误星球，却救下一座孤独城市",
  "一只会修梦的猫进入孩子的噩梦，把恐惧改造成一场游乐园冒险",
  "旧书店老板发现每本书的最后一页都会预言明天的天气和一次相遇",
  "海边小镇的灯塔突然只照向一个人的影子，大家追查被遗忘的秘密",
  "两个小朋友在雨天公交站捡到一把会说话的透明伞",
  "一个品牌吉祥物从包装盒里醒来，寻找自己为什么被设计出来",
  "未来厨房里的 AI 烤箱为了做出妈妈的味道，开始采访全家人的记忆",
  "少年乐队在毕业前最后一次排练，却发现鼓点能让时间倒退 3 秒",
  "一位失眠摄影师在凌晨城市里拍到只有镜头能看见的鲸鱼",
  "博物馆小讲解员带领恐龙骨架逃过一场夜间大停电",
  "小女孩把坏掉的玩具飞船送去维修，结果开启一场卧室宇宙旅行",
  "一家咖啡店每天只在第 13 杯咖啡里出现一条来自未来的便签",
  "山谷里的风铃会记录每个路人的愿望，一个孩子想找回爸爸的声音",
  "新来的转学生其实是来自海底城市的使者，必须学会陆地的告别方式",
  "一只纸飞机穿过四季，把奶奶年轻时没寄出的信带回家",
  "公司发布一款能删除尴尬记忆的 App，主角却误删了最重要的勇气",
  "废弃游乐场的旋转木马每晚都会复原一次，等待最后一位游客"
];

const promptRequirements = [
  "前三秒必须有强钩子，结尾要有可记忆的情绪反转",
  "请输出项目简报、故事大纲、角色设定、剧本和分镜任务",
  "每个镜头只承担一个主要变化，并标注需要关键帧的镜头",
  "要求儿童友好、无惊吓动作，并把英文教学点自然嵌入对白",
  "优先保证角色识别锚点稳定，列出不可改变的视觉设定",
  "适合抖音竖屏传播，节奏要快，但情绪不能碎",
  "适合 B 站系列追更，要留下下一集钩子和人物关系悬念",
  "输出场景美术方案，重点检查空间连续性和穿帮风险",
  "生成视觉风格指南，包含色彩、材质、光线和参考方向",
  "先给总导演判断，再给各 Agent 的接力路线和交付物清单",
  "要有旁白、对白、镜头调度和音乐节奏建议",
  "请拆成 5 个生产阶段，并说明每一阶段写入哪些文件",
  "风格要统一，不允许角色在不同镜头里变脸或换核心配色",
  "请给出主视觉海报画面、三张关键帧和视频生成提示词方向",
  "需要有清晰起承转合，冲突简单但情绪完整",
  "按商业广告节奏处理，突出产品利益点但不要像硬广",
  "请列出目标受众、平台、画幅、分辨率和审核风险",
  "增加一个意外但温暖的结尾，让观众愿意转发",
  "必须能直接交给分镜导演、场景美术、关键帧设计和摄影指导接力",
  "最后生成双通道同步摘要：文件更新什么，对话里告诉用户什么"
];

const promptIdeas = Array.from({ length: 50 }, (_, index) => buildPromptIdea(index));

const defaultPrompt = promptIdeas[0];
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
const workbenchStorageKey = "film-studio:last-workbench";

type RuntimeAgent = {
  id: string;
  name: string;
  role: string;
  workspace: string;
  configured: boolean;
  input: string;
  output: string;
};

type RuntimeDocument = {
  name: string;
  folder: string;
  owner: string;
  state: string;
  relativePath?: string;
};

type WorkflowStage = {
  id: string;
  order: number;
  name: string;
  ownerAgentId: string;
  owner: string;
  deliverables: string[];
  completionStandard: string;
  tools: string[];
  status: "pending" | "working" | "done";
  completedDeliverables: number;
};

type ProjectAsset = {
  name: string;
  relativePath: string;
  type: "image" | "video";
  url: string;
  updatedAt?: string | null;
  versionId?: string;
  parentRelativePath?: string;
};

type AgentMemoryState = {
  agentId: string;
  name: string;
  workspace: string;
  memoryPath: string;
  skillsPath: string;
  memoryCount: number;
  skillCount: number;
  memoryIndex?: string;
  skillNames: string[];
};

type RuntimeProject = {
  id: string;
  title: string;
  updatedAt: string;
  brief?: string;
  fileCount?: number;
  runIdPrefix?: string;
  editableName?: string;
  progress?: ProjectProgress | null;
};

type ProjectProgress = {
  status: string;
  doneStageCount: number;
  totalStageCount: number;
  nextStage?: {
    id: string;
    order: number;
    name: string;
    ownerAgentId: string;
    owner: string;
    status: string;
    completedDeliverables: number;
    deliverableCount: number;
    missingDeliverables: string[];
  } | null;
};

type RuntimeRun = {
  id: string;
  createdAt: string | null;
  updatedAt?: string | null;
  status?: string;
  currentStage?: string;
  prompt: string;
  projectId: string | null;
  parentRunId?: string | null;
  childRunCount?: number;
  selectedAgents: string[];
};

type ConversationEntry = {
  id: string;
  rootRunId: string;
  projectId?: string | null;
  latestRun: RuntimeRun;
  runs: RuntimeRun[];
  createdAt: string | null;
  updatedAt: string | null;
  prompt: string;
  latestPrompt: string;
  status?: string;
  selectedAgents: string[];
  runCount: number;
};

type RuntimeState = {
  backend?: {
    ok: boolean;
    ready: boolean;
    status: string;
  };
  agents?: RuntimeAgent[];
  projects?: RuntimeProject[];
  activeProject?: RuntimeProject | null;
  projectProgress?: ProjectProgress | null;
  documents?: RuntimeDocument[];
  workflow?: WorkflowStage[];
  assets?: ProjectAsset[];
  agentMemory?: AgentMemoryState[];
  recentRuns?: RuntimeRun[];
};

type ModelProfile = {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
  wireApi: "responses" | "chat" | "anthropic";
  authScheme: "bearer" | "x-api-key" | "none";
  reasoningEffort: string;
  disableResponseStorage: boolean;
  apiKey?: string;
  apiKeyMasked?: string | null;
  hasApiKey?: boolean;
  copyApiKeyFromProfileId?: string;
};

type ModelConfigState = {
  activeProfileId: string;
  profiles: ModelProfile[];
};

type UserAccount = {
  id: string;
  email: string;
  createdAt?: string | null;
  recoveryConfigured?: boolean;
};

type AuthMode = "login" | "register" | "recover";

type RecoveryQuestion = {
  id: string;
  question: string;
};

type ModelConnectionEntry = {
  key: string;
  profile: ModelProfile;
  profiles: ModelProfile[];
  models: string[];
};

type TaskState = {
  status: "idle" | "submitting" | "success" | "error";
  message: string;
  meta?: string;
};

type RouteInfo = {
  mode: string;
  stepBudget: number;
  selectedAgents: string[];
  reasons: Array<{ agentId: string; reason: string }>;
};

type RunFile = {
  name: string;
  path: string;
  relativePath: string;
};

type WorkEvent = {
  id: string;
  label: string;
  owner: string;
  status: "pending" | "running" | "done" | "degraded" | "error" | "awaiting_approval" | "rejected";
  detail: string;
  files?: string[];
  startedAt?: string;
  endedAt?: string;
  runId?: string;
  runLabel?: string;
};

type ApprovalEntry = {
  id: string;
  agentId: string;
  agentName: string;
  targetPath: string;
  mode: "append" | "replace";
  kind: "file" | "directory_handoff";
  status: string;
  currentContent: string;
  draftContent: string;
  conflicted?: boolean;
  currentHash?: string | null;
  diff?: {
    beforeHash: string;
    afterHash: string;
    beforeLineCount: number;
    afterLineCount: number;
    added: number;
    removed: number;
    truncated: boolean;
    lines: Array<{
      type: "context" | "add" | "remove";
      text: string;
      oldLine: number | null;
      newLine: number | null;
    }>;
  };
};

type ApprovalState = {
  required: boolean;
  status: string;
  entries: ApprovalEntry[];
  decidedAt?: string | null;
  rollback?: {
    available: boolean;
    status?: string | null;
    rollbackId?: string | null;
    error?: string | null;
    candidates: Array<{
      journalId: string;
      entryId: string;
      targetPath: string;
      decidedAt?: string | null;
    }>;
  };
};

type AgentWork = {
  agentId: string;
  name: string;
  status: string;
  stages: string[];
  role: string;
  workspace: string;
  instruction: string;
  inputs: string;
  deliverables: string[];
  completionStandard?: string;
  tools?: string[];
  writtenFiles?: string[];
  toolCalls?: string[];
  summary?: string;
  error?: string | null;
};

type WorkMessage = {
  speaker: "user" | "director" | "agent";
  title: string;
  body: string;
  agentId?: string;
};

type WorkbenchState = {
  status: "draft" | "running" | "done" | "error";
  projectTitle: string;
  prompt: string;
  runId?: string;
  parentRunId?: string;
  projectId?: string;
  provider?: string;
  model?: string;
  route?: RouteInfo;
  files: RunFile[];
  events: WorkEvent[];
  historyEvents: WorkEvent[];
  agentWork: AgentWork[];
  approval?: ApprovalState;
  responseText?: string;
  messages: WorkMessage[];
};

type ProjectFileState = {
  name: string;
  relativePath: string;
  content: string;
  previewHtml: string;
  contentHash: string;
  updatedAt?: string;
};

export function App() {
  const [promptIndex, setPromptIndex] = useState(0);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [renamingProjectId, setRenamingProjectId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [view, setView] = useState<"home" | "workspace">("home");
  const [workbench, setWorkbench] = useState<WorkbenchState>(() => createDraftWorkbench(defaultPrompt));
  const [selectedFile, setSelectedFile] = useState<ProjectFileState | null>(null);
  const [fileDraft, setFileDraft] = useState("");
  const [fileMode, setFileMode] = useState<"preview" | "edit">("preview");
  const [modelConfig, setModelConfig] = useState<ModelConfigState | null>(null);
  const [modelConfigOpen, setModelConfigOpen] = useState(false);
  const [modelDraft, setModelDraft] = useState<ModelProfile>(() => createEmptyModelProfile());
  const [modelListDraft, setModelListDraft] = useState<string[]>([""]);
  const [authChecked, setAuthChecked] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [authUser, setAuthUser] = useState<UserAccount | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordRepeat, setAuthPasswordRepeat] = useState("");
  const [passwordPanelOpen, setPasswordPanelOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [nextPasswordRepeat, setNextPasswordRepeat] = useState("");
  const [recoveryQuestions, setRecoveryQuestions] = useState<RecoveryQuestion[]>([]);
  const [recoveryQuestionId, setRecoveryQuestionId] = useState("recovery_phrase");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [recoveryCurrentPassword, setRecoveryCurrentPassword] = useState("");
  const [recoveryChallenge, setRecoveryChallenge] = useState<{ questionId: string; question: string } | null>(null);
  const [recoveryNextPassword, setRecoveryNextPassword] = useState("");
  const [recoveryNextPasswordRepeat, setRecoveryNextPasswordRepeat] = useState("");
  const [activeAssetJobId, setActiveAssetJobId] = useState("");
  const [selectedApprovalEntryIds, setSelectedApprovalEntryIds] = useState<string[]>([]);
  const [task, setTask] = useState<TaskState>({
    status: "idle",
    message: "正在连接 Film Studio 后端运行时...",
    meta: "/api/film/runtime"
  });

  const agentCards = useMemo(() => {
    if (!runtime?.agents?.length) return agents;

    return runtime.agents.map((runtimeAgent, index) => {
      const fallback = findFallbackAgent(runtimeAgent.id);
      return {
        id: runtimeAgent.id,
        name: runtimeAgent.name || fallback?.name || runtimeAgent.id,
        role: runtimeAgent.role || fallback?.role || "影视公司岗位 Agent",
        workspace: runtimeAgent.workspace || fallback?.workspace || "",
        status: (runtimeAgent.configured ? "ready" : "review") as "ready" | "working" | "review",
        icon: fallback?.icon || Command,
        input: runtimeAgent.input || fallback?.input || "项目上下文",
        output: runtimeAgent.output || fallback?.output || "岗位交付物",
        color: fallback?.color || ["#f05d9e", "#56c7f2", "#ffb454", "#7de2b8", "#b8c0ff", "#f7d06b"][index % 6]
      };
    });
  }, [runtime]);

  const docRows = runtime?.documents?.length ? runtime.documents : documents;
  const projectAssets = runtime?.assets || [];
  const projectPreviewAsset = projectAssets.find((asset) => asset.type === "image");
  const agentMemoryRows = runtime?.agentMemory || [];
  const projectRows = runtime?.projects || [];
  const requestedProjectId = selectedProjectId || workbench.projectId || "";
  const projectsLoaded = Array.isArray(runtime?.projects);
  const requestedProjectIsKnown = !requestedProjectId || !projectsLoaded || projectRows.some((project) => project.id === requestedProjectId);
  const currentProjectId = (requestedProjectIsKnown ? requestedProjectId : "") || runtime?.activeProject?.id || projectRows[0]?.id || "";
  const currentProject = projectRows.find((project) => project.id === currentProjectId) || runtime?.activeProject || null;
  const runtimeNextStage = runtime?.projectProgress?.nextStage;
  const activeStage = runtimeNextStage ? {
    title: runtimeNextStage.name,
    owner: runtimeNextStage.owner,
    artifact: runtimeNextStage.missingDeliverables?.join("、") || "阶段交付物",
    gate: `完成 ${runtimeNextStage.completedDeliverables}/${runtimeNextStage.deliverableCount} 项交付物`
  } : runtime?.projectProgress?.status === "done" ? {
    title: "项目流程已完成",
    owner: "总导演",
    artifact: "交付、归档与复盘",
    gate: "正式文件与资产均已通过阶段检查"
  } : stages[0];
  const selectedFileIsKeyframe = Boolean(selectedFile?.relativePath?.startsWith("07_keyframes/"));
  const selectedFileGenerationPrompt = (fileDraft || selectedFile?.content || "").trim();
  const libraryEntries = useMemo(() => {
    return projectRows
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map((project, index) => ({
        key: `project:${project.id}`,
        project,
        projectId: project.id,
        title: project.title || project.id,
        subtitle: project.id,
        meta: projectProgressText(project.progress),
        historyCode: `H${String(index + 1).padStart(3, "0")}`
      }));
  }, [projectRows]);
  const runHistoryEntries = useMemo(() => groupConversationEntries(runtime?.recentRuns || []), [runtime?.recentRuns]);
  const activeModelProfile = useMemo(() => {
    return modelConfig?.profiles.find((profile) => profile.id === modelConfig.activeProfileId) || modelConfig?.profiles[0] || null;
  }, [modelConfig]);
  const modelConnectionEntries = useMemo(() => {
    return groupModelConnections(modelConfig?.profiles || []);
  }, [modelConfig?.profiles]);

  async function reloadRuntime(projectId = currentProjectId) {
    const suffix = projectId ? `?project=${encodeURIComponent(projectId)}` : "";
    const response = await apiFetch(`/api/film/runtime${suffix}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || payload?.detail || `HTTP ${response.status}`);
    }
    setRuntime(payload);
    if (payload?.activeProject?.id) {
      setSelectedProjectId(payload.activeProject.id);
    }
    return payload as RuntimeState;
  }

  async function reloadModelConfig() {
    const response = await apiFetch("/api/config/models");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(payload?.profiles)) {
      throw new Error(payload?.error || payload?.detail || `HTTP ${response.status}`);
    }
    const nextConfig = {
      activeProfileId: payload.activeProfileId || payload.profiles[0]?.id || "",
      profiles: payload.profiles
    } as ModelConfigState;
    setModelConfig(nextConfig);
    const active = nextConfig.profiles.find((profile) => profile.id === nextConfig.activeProfileId) || nextConfig.profiles[0];
    if (active) setModelEditorDraft(active, nextConfig.profiles);
    return nextConfig;
  }

  async function loadRecoveryQuestions() {
    const response = await apiFetch("/api/auth/recovery/questions");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(payload?.questions)) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    setRecoveryQuestions(payload.questions);
    if (!payload.questions.some((item: RecoveryQuestion) => item.id === recoveryQuestionId) && payload.questions[0]?.id) {
      setRecoveryQuestionId(payload.questions[0].id);
    }
    return payload.questions as RecoveryQuestion[];
  }

  async function openPasswordPanel() {
    setPasswordPanelOpen(true);
    await loadRecoveryQuestions().catch((error) => {
      setTask({ status: "error", message: "无法读取验证问题。", meta: error instanceof Error ? error.message : String(error) });
    });
  }

  function openModelSettings(profile = activeModelProfile) {
    if (profile) {
      setModelEditorDraft(profile, modelConfig?.profiles || []);
    } else {
      const empty = createEmptyModelProfile();
      setModelDraft(empty);
      setModelListDraft([""]);
    }
    setModelConfigOpen(true);
  }

  function setModelEditorDraft(profile: ModelProfile, profiles = modelConfig?.profiles || []) {
    setModelDraft({ ...profile, apiKey: "" });
    setModelListDraft(modelNamesForProfile(profile, profiles));
  }

  async function switchModelProfile(profileId: string) {
    if (!profileId || profileId === modelConfig?.activeProfileId) return;
    try {
      const response = await apiFetch("/api/config/models/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProfileId: profileId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload?.profiles)) {
        throw new Error(payload?.error || payload?.detail || `HTTP ${response.status}`);
      }
      setModelConfig({ activeProfileId: payload.activeProfileId, profiles: payload.profiles });
      const active = payload.profiles.find((profile: ModelProfile) => profile.id === payload.activeProfileId);
      if (active) setModelEditorDraft(active, payload.profiles);
      setTask({ status: "success", message: "模型已切换。", meta: active?.model || profileId });
    } catch (error) {
      setTask({ status: "error", message: "模型切换失败。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function saveModelDraft() {
    const modelNames = uniqueModelNames(modelListDraft);
    const primaryModelName = modelDraft.model.trim() && modelNames.includes(modelDraft.model.trim())
      ? modelDraft.model.trim()
      : modelNames[0] || "";
    const draft = {
      ...modelDraft,
      id: modelDraft.id || `custom-${Date.now().toString(36)}`,
      name: modelDraft.name.trim(),
      provider: modelDraft.provider.trim() || "custom",
      model: primaryModelName,
      baseUrl: modelDraft.baseUrl.trim().replace(/\/$/, "")
    };
    if (!draft.baseUrl || !modelNames.length) {
      setTask({ status: "error", message: "base_url 和 model list 不能为空。" });
      return;
    }

    const profiles = modelConfig?.profiles || [];
    const sourceProfile = profiles.find((profile) => profile.id === draft.id) || null;
    const sourceConnection = sourceProfile || draft;
    const groupProfiles = profiles.filter((profile) => sameModelConnection(profile, sourceConnection));
    const otherProfiles = profiles.filter((profile) => {
      if (!sameModelConnection(profile, sourceConnection)) return true;
      if (sourceProfile) return false;
      return !modelNames.includes(profile.model);
    });
    const existingByModel = new Map(groupProfiles.map((profile) => [profile.model, profile]));
    const generatedProfiles = modelNames.map((modelName, index) => {
      const existing = existingByModel.get(modelName) || (index === 0 ? sourceProfile : null);
      return {
        ...draft,
        id: existing?.id || `custom-${Date.now().toString(36)}-${index}`,
        name: modelName,
        model: modelName,
        apiKey: draft.apiKey || "",
        hasApiKey: existing?.hasApiKey || draft.hasApiKey,
        apiKeyMasked: existing?.apiKeyMasked || draft.apiKeyMasked,
        copyApiKeyFromProfileId: draft.id || sourceProfile?.id
      };
    });
    const activeDraft = generatedProfiles.find((profile) => profile.model === primaryModelName) || generatedProfiles[0];
    const nextProfiles = [...otherProfiles, ...generatedProfiles];

    try {
      const response = await apiFetch("/api/config/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProfileId: activeDraft.id, profiles: nextProfiles })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload?.profiles)) {
        throw new Error(payload?.error || payload?.detail || `HTTP ${response.status}`);
      }
      setModelConfig({ activeProfileId: payload.activeProfileId, profiles: payload.profiles });
      const active = payload.profiles.find((profile: ModelProfile) => profile.id === payload.activeProfileId);
      if (active) setModelEditorDraft(active, payload.profiles);
      setTask({ status: "success", message: "模型接口配置已保存。", meta: modelNames.join(", ") });
    } catch (error) {
      setTask({ status: "error", message: "模型接口配置保存失败。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  function startNewModelProfile() {
    const nextDraft = createEmptyModelProfile();
    setModelDraft(nextDraft);
    setModelListDraft([""]);
    setModelConfigOpen(true);
  }

  function updateModelListDraft(index: number, value: string) {
    setModelListDraft((items) => {
      const next = items.length ? [...items] : [""];
      next[index] = value;
      return next;
    });
    if (index === 0) {
      setModelDraft((draft) => ({ ...draft, model: value }));
    }
  }

  function addModelListDraftRow() {
    setModelListDraft((items) => [...(items.length ? items : [modelDraft.model || ""]), ""]);
  }

  function removeModelListDraftRow(index: number) {
    const next = modelListDraft.filter((_, itemIndex) => itemIndex !== index);
    const fallback = next.length ? next : [""];
    setModelListDraft(fallback);
    setModelDraft((draft) => ({ ...draft, model: fallback[0] || "" }));
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const authResponse = await apiFetch("/api/auth/me");
        const authPayload = await authResponse.json().catch(() => ({}));
        if (!authResponse.ok || !authPayload?.user) {
          const healthResponse = await apiFetch("/api/health").catch(() => null);
          const healthPayload = healthResponse ? await healthResponse.json().catch(() => ({})) : {};
          if (!cancelled) {
            setRegistrationEnabled(Boolean(healthPayload?.registrationEnabled));
            setAuthChecked(true);
            setTask({ status: "idle", message: "请先登录 Film Studio。", meta: "用户数据会按账户隔离保存" });
          }
          return;
        }
        const user = authPayload.user as UserAccount;
        const saved = loadSavedWorkbench(user.id);
        if (!cancelled) {
          setAuthUser(user);
          setAuthEmail(user.email);
          if (saved) {
            setWorkbench(saved);
            setPrompt(saved.prompt || defaultPrompt);
            setSelectedProjectId(saved.projectId || "");
            setView("workspace");
          }
        }
        const [payload] = await Promise.all([
          reloadRuntime(saved?.projectId || selectedProjectId),
          reloadModelConfig().catch(() => null)
        ]);
        if (cancelled) return;

        setRuntime(payload);
        setAuthChecked(true);
        setTask({
          status: "idle",
          message: `后端已连接：${payload?.agents?.length || 0} 个 Agent，当前项目 ${payload?.activeProject?.id || "未选择"}。`,
          meta: payload?.backend?.ready ? "本地工作区已就绪" : "本地工作区未就绪"
        });
      } catch (error) {
        if (cancelled) return;
        setAuthChecked(true);
        setTask({
          status: "error",
          message: "无法连接后端服务。",
          meta: error instanceof Error ? error.message : String(error)
        });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authUser?.id) saveWorkbench(workbench, authUser.id);
  }, [workbench, authUser?.id]);

  useEffect(() => {
    setSelectedApprovalEntryIds(
      (workbench.approval?.entries || []).filter((entry) => entry.status === "pending").map((entry) => entry.id)
    );
  }, [workbench.runId, workbench.approval?.entries]);

  useEffect(() => {
    function handleExpiredSession() {
      setAuthUser(null);
      setRuntime(null);
      setModelConfig(null);
      setAuthChecked(true);
      setView("home");
      setTask({ status: "error", message: "登录会话已过期，请重新登录。", meta: "SESSION_EXPIRED" });
    }
    window.addEventListener("film-auth-expired", handleExpiredSession);
    return () => window.removeEventListener("film-auth-expired", handleExpiredSession);
  }, []);

  async function submitAuth() {
    if (authMode === "recover") return;
    if (authMode === "register" && !registrationEnabled) {
      setTask({ status: "error", message: "公开注册已关闭，请联系管理员开通账户。" });
      return;
    }
    const normalizedEmail = authEmail.trim().toLowerCase();
    if (!normalizedEmail || !authPassword) {
      setTask({ status: "error", message: "请输入邮箱和密码。" });
      return;
    }
    if (authMode === "register" && authPassword.length < 12) {
      setTask({ status: "error", message: "新账户密码至少需要 12 个字符。" });
      return;
    }
    if (authMode === "register" && (!recoveryQuestionId || recoveryAnswer.trim().length < 8)) {
      setTask({ status: "error", message: "请选择验证问题并填写至少 8 个字符的答案。" });
      return;
    }
    const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    try {
      setTask({ status: "submitting", message: authMode === "register" ? "正在注册账户..." : "正在登录账户..." });
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: authPassword,
          repeatPassword: authPasswordRepeat,
          questionId: recoveryQuestionId,
          recoveryAnswer
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.user) {
        setTask({ status: "error", message: payload?.error || "登录失败。", meta: payload?.detail || `HTTP ${response.status}` });
        return;
      }
      const sessionResponse = await apiFetch("/api/auth/me");
      const sessionPayload = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok || !sessionPayload?.user) {
        throw new Error("登录凭据已验证，但浏览器未能保存会话 Cookie。请确认使用 HTTPS 且未禁用本站 Cookie。");
      }
      const user = sessionPayload.user as UserAccount;
      const saved = loadSavedWorkbench(user.id);
      setAuthUser(user);
      setAuthPassword("");
      setAuthPasswordRepeat("");
      setRecoveryAnswer("");
      setAuthChecked(true);
      if (saved) {
        setWorkbench(saved);
        setPrompt(saved.prompt || defaultPrompt);
        setSelectedProjectId(saved.projectId || "");
        setView("workspace");
      } else {
        setWorkbench(createDraftWorkbench(defaultPrompt));
        setPrompt(defaultPrompt);
        setSelectedProjectId("");
        setView("home");
      }
      const [runtimePayload] = await Promise.all([
        reloadRuntime(saved?.projectId || ""),
        reloadModelConfig().catch(() => null)
      ]);
      setRuntime(runtimePayload);
      setTask({ status: "idle", message: `已登录：${user.email}`, meta: runtimePayload?.backend?.ready ? "本地工作区已就绪" : "本地工作区未就绪" });
    } catch (error) {
      setTask({ status: "error", message: "无法完成登录请求。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    if (authUser?.id) window.localStorage.removeItem(userWorkbenchStorageKey(authUser.id));
    setAuthUser(null);
    setRuntime(null);
    setModelConfig(null);
    setWorkbench(createDraftWorkbench(defaultPrompt));
    setPrompt(defaultPrompt);
    setSelectedProjectId("");
    setAuthPassword("");
    setAuthPasswordRepeat("");
    setView("home");
    setTask({ status: "idle", message: "已退出登录。" });
  }

  async function requestRecoveryChallenge() {
    const email = authEmail.trim().toLowerCase();
    if (!email) {
      setTask({ status: "error", message: "请输入需要恢复的账户邮箱。" });
      return;
    }
    setTask({ status: "submitting", message: "正在读取账户验证问题..." });
    try {
      const response = await apiFetch("/api/auth/recovery/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      if (!payload?.available || !payload?.question) {
        setRecoveryChallenge(null);
        setTask({ status: "error", message: "该账户尚未设置验证问题，无法自助重置密码。" });
        return;
      }
      setRecoveryChallenge({ questionId: payload.questionId, question: payload.question });
      setTask({ status: "idle", message: "请回答验证问题并设置新密码。" });
    } catch (error) {
      setTask({ status: "error", message: "无法读取验证问题。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function resetForgottenPassword() {
    if (!recoveryChallenge || recoveryAnswer.trim().length < 3 || recoveryNextPassword.length < 12 || recoveryNextPassword !== recoveryNextPasswordRepeat) {
      setTask({ status: "error", message: "请填写验证答案；新密码至少 12 个字符且两次输入必须一致。" });
      return;
    }
    setTask({ status: "submitting", message: "正在验证答案并重设密码..." });
    try {
      const response = await apiFetch("/api/auth/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim().toLowerCase(),
          answer: recoveryAnswer,
          nextPassword: recoveryNextPassword,
          repeatPassword: recoveryNextPasswordRepeat
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      setRecoveryChallenge(null);
      setRecoveryAnswer("");
      setRecoveryNextPassword("");
      setRecoveryNextPasswordRepeat("");
      setAuthMode("login");
      setTask({ status: "success", message: "密码已重设，所有旧登录会话均已撤销。请使用新密码登录。" });
    } catch (error) {
      setTask({ status: "error", message: "密码重设失败。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function setupRecoveryQuestion() {
    if (!recoveryCurrentPassword || recoveryAnswer.trim().length < 8 || !recoveryQuestionId) {
      setTask({ status: "error", message: "请选择验证问题，并填写当前密码和至少 8 个字符的答案。" });
      return;
    }
    setTask({ status: "submitting", message: "正在保存验证问题..." });
    try {
      const response = await apiFetch("/api/auth/recovery/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: recoveryCurrentPassword, questionId: recoveryQuestionId, answer: recoveryAnswer })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      setRecoveryCurrentPassword("");
      setRecoveryAnswer("");
      setAuthUser((current) => current ? { ...current, recoveryConfigured: true } : current);
      setTask({ status: "success", message: "验证问题已保存。", meta: "答案仅以不可逆哈希保存" });
    } catch (error) {
      setTask({ status: "error", message: "验证问题保存失败。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function changePassword() {
    if (!currentPassword || nextPassword.length < 12 || nextPassword !== nextPasswordRepeat) {
      setTask({
        status: "error",
        message: nextPassword !== nextPasswordRepeat ? "两次输入的新密码不一致。" : "请填写当前密码，新密码至少 12 个字符。"
      });
      return;
    }
    setTask({ status: "submitting", message: "正在更新登录密码并撤销旧会话..." });
    try {
      const response = await apiFetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword, repeatPassword: nextPasswordRepeat })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || payload?.detail || `HTTP ${response.status}`);
      setCurrentPassword("");
      setNextPassword("");
      setNextPasswordRepeat("");
      setPasswordPanelOpen(false);
      setTask({ status: "success", message: "密码已更新，其他登录会话已撤销。", meta: "当前设备已重新签发会话" });
    } catch (error) {
      setTask({ status: "error", message: "密码修改失败。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  function renderPasswordPanel() {
    if (!passwordPanelOpen) return null;
    return (
      <div className="password-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasswordPanelOpen(false); }}>
        <div className="password-panel">
          <div className="password-panel-head">
            <div>
              <p className="eyebrow">Account Security</p>
              <h2>账户安全</h2>
            </div>
            <button className="icon-button" type="button" aria-label="关闭" onClick={() => setPasswordPanelOpen(false)}><X size={17} /></button>
          </div>
          <form className="security-section" onSubmit={(event) => { event.preventDefault(); void changePassword(); }}>
            <h3>修改登录密码</h3>
            <label><span>当前密码</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label><span>新密码</span><input type="password" autoComplete="new-password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required minLength={12} maxLength={1024} /></label>
            <label><span>重复新密码</span><input type="password" autoComplete="new-password" value={nextPasswordRepeat} onChange={(event) => setNextPasswordRepeat(event.target.value)} required minLength={12} maxLength={1024} /></label>
            <p className="muted">成功后会撤销其他设备的全部登录会话，当前设备自动重新登录。</p>
            <button className="primary-action" type="submit" disabled={task.status === "submitting"}>{task.status === "submitting" ? "更新中..." : "更新密码"}</button>
          </form>
          <form className="security-section" onSubmit={(event) => { event.preventDefault(); void setupRecoveryQuestion(); }}>
            <h3>忘记密码验证问题</h3>
            <p className="muted">状态：{authUser?.recoveryConfigured ? "已设置，可重新设置" : "尚未设置"}。答案仅保存不可逆哈希。</p>
            <label>
              <span>验证问题</span>
              <select value={recoveryQuestionId} onChange={(event) => setRecoveryQuestionId(event.target.value)} required>
                {recoveryQuestions.map((item) => <option value={item.id} key={item.id}>{item.question}</option>)}
              </select>
            </label>
            <label><span>验证答案</span><input type="text" autoComplete="off" value={recoveryAnswer} onChange={(event) => setRecoveryAnswer(event.target.value)} required minLength={8} maxLength={200} /></label>
            <label><span>当前登录密码</span><input type="password" autoComplete="current-password" value={recoveryCurrentPassword} onChange={(event) => setRecoveryCurrentPassword(event.target.value)} required /></label>
            <button className="ghost-button" type="submit" disabled={task.status === "submitting"}>{authUser?.recoveryConfigured ? "重新设置验证问题" : "保存验证问题"}</button>
          </form>
        </div>
      </div>
    );
  }

  function rotatePrompt() {
    const randomIndex = Math.floor(Math.random() * promptIdeas.length);
    const nextIndex = randomIndex === promptIndex ? (randomIndex + 1) % promptIdeas.length : randomIndex;
    setPromptIndex(nextIndex);
    setPrompt(promptIdeas[nextIndex]);
    setTask({
      status: "idle",
      message: "已随机抽取新的创作提示，可以继续换一换，或直接发送给后端总导演调度。",
      meta: `提示 ${nextIndex + 1} / ${promptIdeas.length}`
    });
  }

  async function selectProject(projectId: string) {
    if (!projectId) return;
    setSelectedProjectId(projectId);
    setSelectedFile(null);
    const project = projectRows.find((item) => item.id === projectId);
    try {
      const payload = await reloadRuntime(projectId);
      const loadedProject = payload.activeProject || project || { id: projectId, title: projectId };
      const loadedProgress = payload.projectProgress || payload.activeProject?.progress || project?.progress || null;
      const projectTitle = loadedProject.title || loadedProject.id;

      // Try to load conversation history for this project
      const projectRuns = (payload.recentRuns || [])
        .filter((run: RuntimeRun) => run.projectId === projectId)
        .sort((a: RuntimeRun, b: RuntimeRun) => String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || "")));

      if (projectRuns.length > 0) {
        // Load full details for all runs to build conversation history
        const runDetails = (await Promise.all(projectRuns.slice(-40).map(async (run: RuntimeRun) => {
          try {
            const response = await apiFetch(`/api/film/runs/${encodeURIComponent(run.id)}`);
            const detailPayload = await response.json().catch(() => ({}));
            return response.ok && detailPayload?.run ? detailPayload.run : run;
          } catch {
            return run;
          }
        }))).filter(Boolean);

        const messages = messagesFromConversationDetails(runDetails);
        const latestRun = projectRuns[projectRuns.length - 1];
        const next = loadedProgress?.nextStage;
        const statusBody = next
          ? `当前执行到阶段 ${next.order}「${next.name}」。缺少：${next.missingDeliverables?.length ? next.missingDeliverables.join("、") : "待细化交付物"}。输入\u201c继续\u201d后，总导演会按这个阶段继续派发给 ${next.owner}。`
          : `该项目的标准阶段文件已基本完成。输入\u201c继续\u201d后，总导演会进入审查、补强或按你的新要求追加执行。`;

        setWorkbench({
          status: "done",
          projectTitle,
          prompt: latestRun.prompt || prompt,
          runId: latestRun.id,
          parentRunId: latestRun.parentRunId || undefined,
          projectId,
          files: [],
          events: [],
          historyEvents: [],
          agentWork: [],
          messages: [
            ...messages,
            {
              speaker: "director",
              title: "总导演 / 项目状态",
              body: statusBody
            }
          ]
        });
      } else {
        setWorkbench(createProjectWorkbench(prompt, loadedProject.id, projectTitle, loadedProgress));
      }
      setPrompt((current) => current.trim() ? current : "继续");
      setView("workspace");
    } catch (error) {
      setTask({ status: "error", message: "项目切换失败。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function createProjectRecord(title: string, sourcePrompt: string): Promise<RuntimeProject> {
    const response = await apiFetch("/api/film/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, prompt: sourcePrompt })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.project) {
      throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
    }
    setNewProjectTitle("");
    setSelectedProjectId(payload.project.id);
    await reloadRuntime(payload.project.id);
    return payload.project;
  }

  async function openNewProject() {
    const title = newProjectTitle.trim().slice(0, 40);
    setTask({ status: "submitting", message: "正在创建项目资料库...", meta: "POST /api/film/projects" });
    try {
      const project = await createProjectRecord(title, "");
      setPrompt("");
      setWorkbench(createDraftWorkbench("", project.id, project.title || project.id));
      setView("workspace");
      setTask({ status: "success", message: "项目资料库已创建。", meta: project.id });
    } catch (error) {
      setTask({ status: "error", message: "无法创建项目。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  function beginRenameProject(projectId: string) {
    const project = projectRows.find((item) => item.id === projectId);
    setRenamingProjectId(projectId);
    setRenameDraft(project?.editableName || project?.title || "");
  }

  async function submitProjectRename(projectId: string) {
    const name = renameDraft.trim();
    if (!name) {
      setTask({ status: "error", message: "项目名称不能为空。", meta: "只能修改 runId 后面的文字部分" });
      return;
    }
    const wasCurrentProject = currentProjectId === projectId || workbench.projectId === projectId;
    setTask({ status: "submitting", message: "正在重命名历史子项目...", meta: projectId });
    try {
      const response = await apiFetch(`/api/film/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.project) {
        setTask({ status: "error", message: payload?.error || "项目重命名失败。", meta: payload?.detail || `HTTP ${response.status}` });
        return;
      }
      setRenamingProjectId("");
      setRenameDraft("");
      setSelectedProjectId(payload.project.id);
      setWorkbench((current) => wasCurrentProject ? {
        ...current,
        projectId: payload.project.id,
        projectTitle: payload.project.title || payload.project.id
      } : current);
      await reloadRuntime(payload.project.id);
      setTask({ status: "success", message: "历史子项目已重命名。", meta: payload.project.id });
    } catch (error) {
      setTask({ status: "error", message: "无法重命名项目。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function openHistoryRun(run: RuntimeRun) {
    setPrompt(run.prompt || prompt);
    setView("workspace");
    try {
      const response = await apiFetch(`/api/film/runs/${encodeURIComponent(run.id)}`);
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.run) {
        const loaded = createWorkbenchFromRun(payload.run);
        setWorkbench(loaded);
        setPrompt(loaded.prompt || prompt);
        if (loaded.projectId) {
          setSelectedProjectId(loaded.projectId);
          await reloadRuntime(loaded.projectId);
        }
        return;
      }
    } catch {
      // The deployed server may not have the detail endpoint until restart; the summary still gives enough to continue.
    }
    const fallback = createWorkbenchFromRunSummary(run);
    if (fallback.projectId) setSelectedProjectId(fallback.projectId);
    setWorkbench(fallback);
  }

  async function openHistoryConversation(conversation: ConversationEntry) {
    const sortedRuns = conversation.runs
      .slice()
      .sort((a, b) => String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || "")));
    const latestRun = conversation.latestRun || sortedRuns[sortedRuns.length - 1];
    if (!latestRun) return;
    setPrompt(conversation.latestPrompt || latestRun.prompt || prompt);
    setView("workspace");
    try {
      const runDetails = (await Promise.all(sortedRuns.slice(-40).map(async (run) => {
        const response = await apiFetch(`/api/film/runs/${encodeURIComponent(run.id)}`);
        const payload = await response.json().catch(() => ({}));
        return response.ok && payload?.run ? payload.run : run;
      }))).filter(Boolean);
      const loaded = createWorkbenchFromConversation(conversation, runDetails);
      setWorkbench(loaded);
      setPrompt(loaded.prompt || prompt);
      if (loaded.projectId) {
        setSelectedProjectId(loaded.projectId);
        await reloadRuntime(loaded.projectId);
      }
      return;
    } catch {
      // Fall back to the latest run if a detail request fails.
    }
    await openHistoryRun(latestRun);
  }

  async function refreshRunApproval() {
    if (!workbench.runId) return null;
    const response = await apiFetch(`/api/film/runs/${encodeURIComponent(workbench.runId)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.run) throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
    const loaded = createWorkbenchFromRun(payload.run);
    setWorkbench(loaded);
    return loaded;
  }

  async function decideRunApproval(decision: "approve" | "reject", requestedEntryIds = selectedApprovalEntryIds) {
    if (!workbench.runId || !workbench.approval?.required) return;
    const entryIds = [...new Set(requestedEntryIds)].filter(Boolean);
    if (!entryIds.length) {
      setTask({ status: "error", message: "请至少选择一个待审批文件。" });
      return;
    }
    setTask({
      status: "submitting",
      message: decision === "approve" ? "正在批准并发布 Agent 草稿..." : "正在拒绝 Agent 草稿...",
      meta: `POST /api/film/runs/${workbench.runId}/${decision}`
    });
    try {
      const response = await apiFetch(`/api/film/runs/${encodeURIComponent(workbench.runId)}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.run) {
        if (response.status === 409) await refreshRunApproval().catch(() => null);
        throw new Error(`${payload?.detail || payload?.error || `HTTP ${response.status}`}${response.status === 409 ? "（审批状态已刷新）" : ""}`);
      }
      const loaded = createWorkbenchFromRun(payload.run);
      setWorkbench(loaded);
      if (loaded.projectId) await reloadRuntime(loaded.projectId);
      setTask({
        status: "success",
        message: decision === "approve" ? `已批准并发布 ${entryIds.length} 个草稿。` : `已拒绝 ${entryIds.length} 个草稿。`,
        meta: `run ${workbench.runId}`
      });
    } catch (error) {
      setTask({
        status: "error",
        message: decision === "approve" ? "草稿批准失败。" : "草稿拒绝失败。",
        meta: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function rollbackLatestApproval() {
    if (!workbench.runId || !workbench.approval?.rollback?.available) return;
    const candidates = workbench.approval.rollback.candidates;
    const latestJournalId = candidates.at(-1)?.journalId;
    const entryIds = candidates.filter((entry) => entry.journalId === latestJournalId).map((entry) => entry.entryId);
    if (!latestJournalId || !entryIds.length) return;
    setTask({ status: "submitting", message: "正在验证并回滚已发布文件...", meta: latestJournalId });
    try {
      const response = await apiFetch(`/api/film/runs/${encodeURIComponent(workbench.runId)}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalId: latestJournalId, entryIds })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.run) {
        if (response.status === 409) await refreshRunApproval().catch(() => null);
        throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
      }
      const loaded = createWorkbenchFromRun(payload.run);
      setWorkbench(loaded);
      if (loaded.projectId) await reloadRuntime(loaded.projectId);
      setTask({ status: "success", message: `已安全回滚 ${entryIds.length} 个已发布文件。`, meta: latestJournalId });
    } catch (error) {
      setTask({ status: "error", message: "已发布文件回滚失败。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function submitPrompt() {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      setTask({ status: "error", message: "请先输入项目创意或任务要求。" });
      return;
    }

    let projectId = currentProjectId;
    if (!projectId) {
      setTask({ status: "submitting", message: "正在先创建项目资料库...", meta: "POST /api/film/projects" });
      try {
        const project = await createProjectRecord(newProjectTitle.trim().slice(0, 40), nextPrompt);
        projectId = project.id;
        setWorkbench(createDraftWorkbench(nextPrompt, project.id, project.title || project.id));
      } catch (error) {
        setTask({ status: "error", message: "无法创建项目。", meta: error instanceof Error ? error.message : String(error) });
        return;
      }
    }

    const shouldContinue = Boolean(workbench.runId && workbench.projectId === projectId);
    const endpoint = shouldContinue
      ? `/api/film/runs/${encodeURIComponent(workbench.runId as string)}/continue`
      : "/api/film/task";
    const previousMessages = workbench.messages.length > 1 || shouldContinue ? workbench.messages : [];

    setTask({ status: "submitting", message: shouldContinue ? "正在续写历史 run..." : "正在提交给后端总导演调度接口...", meta: `POST ${endpoint}` });
    setWorkbench(createRunningWorkbench(nextPrompt, projectId, shouldContinue ? workbench.runId : undefined, previousMessages));
    setView("workspace");

    const requestStartedAt = new Date();
    try {
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nextPrompt, projectId, background: true })
      });
      let payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = payloadErrorDetail(payload) || `HTTP ${response.status}`;
        const recoveredRun = payload?.run || (response.status >= 500
          ? await recoverArchivedRun(projectId, nextPrompt, requestStartedAt).catch(() => null)
          : null);
        if (recoveredRun) {
          setTask({
            status: "error",
            message: "模型调用失败，run 已归档。",
            meta: detail
          });
          setWorkbench(createWorkbenchFromRun(recoveredRun));
          await reloadRuntime(projectId);
          return;
        }
        setTask({
          status: "error",
          message: payload?.error || "后端请求失败。",
          meta: detail
        });
        setWorkbench((current) => ({
          ...current,
          status: "error",
          messages: [
            ...current.messages,
            {
              speaker: "director",
              title: "总导演 / 请求失败",
              body: detail
            }
          ]
        }));
        return;
      }

      if (payload?.pending && payload?.jobId) {
        setTask({
          status: "submitting",
          message: "后端已转入后台执行，正在等待 Agent 接力完成...",
          meta: `job ${payload.jobId}`
        });
        payload = await waitForFilmTaskJob(payload.jobId, projectId, nextPrompt, requestStartedAt);
      }

      const degraded = isDegradedPayload(payload);
      const providerError = payloadProviderError(payload);
      const agentError = payloadAgentError(payload);
      setTask({
        status: degraded ? "error" : "success",
        message: degraded
          ? providerError ? "模型调用失败，run 已归档。" : "部分 Agent 未完成，run 已归档。"
          : payload?.text || "任务已提交成功。",
        meta: [
          `${payload?.provider || "provider"} / ${payload?.model || "model"}`,
          payload?.runId ? `run ${payload.runId}` : "",
          providerError || agentError || (Array.isArray(payload?.files) ? payload.files.map((file: { relativePath: string }) => file.relativePath).join(" · ") : "")
        ].filter(Boolean).join(" · ")
      });
      setWorkbench(createCompletedWorkbench(nextPrompt, payload, previousMessages));
      await reloadRuntime(projectId);
    } catch (error) {
      const errorPayload = (error as { payload?: any })?.payload;
      if (errorPayload?.run) {
        setTask({
          status: "error",
          message: "后台任务失败，但 run 已归档。",
          meta: payloadErrorDetail(errorPayload) || (error instanceof Error ? error.message : String(error))
        });
        setWorkbench(createWorkbenchFromRun(errorPayload.run));
        await reloadRuntime(projectId);
        return;
      }
      const detail = describeFetchFailure(error);
      const recoveredRun = await recoverArchivedRun(projectId, nextPrompt, requestStartedAt).catch(() => null);
      if (recoveredRun) {
        setTask({
          status: "error",
          message: "后端连接中断，但 run 已归档。",
          meta: payloadErrorDetail(recoveredRun) || detail
        });
        setWorkbench(createWorkbenchFromRun(recoveredRun));
        await reloadRuntime(projectId);
        return;
      }
      setTask({
        status: "error",
        message: "无法连接后端服务。",
        meta: detail
      });
      setWorkbench((current) => ({
        ...current,
        status: "error",
        messages: [
          ...current.messages,
          {
            speaker: "director",
            title: "总导演 / 后端连接失败",
            body: detail
          }
        ]
      }));
    }
  }

  async function runAssetAction(asset: ProjectAsset | null, action: "regenerate" | "edit" | "generate-image" | "generate-video", promptOverride = "") {
    const projectId = currentProjectId;
    if (!projectId) {
      setTask({ status: "error", message: "请先选择项目。" });
      return;
    }
    const requestedType = action === "generate-video" || asset?.type === "video" ? "video" : "image";
    const generationPrompt = promptOverride.trim()
      || (selectedFileIsKeyframe ? selectedFileGenerationPrompt : "")
      || prompt.trim();
    setTask({ status: "submitting", message: "正在创建资产新版本...", meta: action });
    const idempotencyKey = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    try {
      const response = await apiFetch(`/api/film/projects/${encodeURIComponent(projectId)}/assets/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          action,
          type: requestedType,
          relativePath: asset?.relativePath || "",
          prompt: generationPrompt,
          background: true
        })
      });
      let payload = await response.json().catch(() => ({}));
      if (response.status === 202 && payload?.jobId) {
        setActiveAssetJobId(payload.jobId);
        payload = await waitForAssetTaskJob(payload.jobId, (job) => {
          setTask({
            status: "submitting",
            message: `资产任务：${job.progress?.phase || job.status}`,
            meta: `${job.progress?.percent || 0}% · ${job.jobId}`
          });
        });
      }
      if (!response.ok || !payload?.asset) {
        setTask({ status: "error", message: payload?.error || "资产版本创建失败。", meta: payload?.detail || `HTTP ${response.status}` });
        return;
      }
      await reloadRuntime(projectId);
      setTask({ status: "success", message: "资产新版本已写入项目资料库。", meta: payload.asset.relativePath });
    } catch (error) {
      setTask({ status: "error", message: "无法创建资产版本。", meta: error instanceof Error ? error.message : String(error) });
    } finally {
      setActiveAssetJobId("");
    }
  }

  async function cancelActiveAssetJob() {
    if (!activeAssetJobId) return;
    const response = await apiFetch(`/api/film/asset-jobs/${encodeURIComponent(activeAssetJobId)}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setTask({ status: "error", message: payload?.error || "无法取消资产任务。", meta: payload?.detail || `HTTP ${response.status}` });
      return;
    }
    setTask({ status: "submitting", message: "正在取消资产任务...", meta: activeAssetJobId });
  }

  async function openProjectFile(relativePath?: string) {
    const projectId = currentProjectId || workbench.projectId || runtime?.activeProject?.id;
    if (!projectId || !relativePath) return;
    try {
      const response = await apiFetch(`/api/film/projects/${encodeURIComponent(projectId)}/files/${relativePath.split("/").map(encodeURIComponent).join("/")}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.file) {
        setTask({ status: "error", message: payload?.error || "文件读取失败。", meta: payload?.detail || relativePath });
        return;
      }
      setSelectedFile(payload.file);
      setFileDraft(payload.file.content || "");
      setFileMode("preview");
    } catch (error) {
      setTask({ status: "error", message: "无法读取项目文件。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  async function saveSelectedFile() {
    const projectId = currentProjectId || workbench.projectId || runtime?.activeProject?.id;
    if (!projectId || !selectedFile) return;
    try {
      const response = await apiFetch(`/api/film/projects/${encodeURIComponent(projectId)}/files/${selectedFile.relativePath.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": selectedFile.contentHash },
        body: JSON.stringify({ content: fileDraft })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.file) {
        setTask({ status: "error", message: payload?.error || "文件保存失败。", meta: payload?.detail || selectedFile.relativePath });
        return;
      }
      setSelectedFile(payload.file);
      setFileDraft(payload.file.content || "");
      setFileMode("preview");
      setTask({ status: "success", message: "项目文件已保存。", meta: payload.file.relativePath });
    } catch (error) {
      setTask({ status: "error", message: "无法保存项目文件。", meta: error instanceof Error ? error.message : String(error) });
    }
  }

  if (!authChecked || !authUser) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">Film Studio</p>
            <h1>{authMode === "recover" ? "重设密码" : "账户登录"}</h1>
            <p>{authMode === "recover" ? "通过预先设置的验证问题重设密码。" : "模型接口、API key 和历史对话按账户保存。"}</p>
          </div>
          {authMode === "recover" ? (
            <button className="auth-back" type="button" onClick={() => { setAuthMode("login"); setRecoveryChallenge(null); }}>返回登录</button>
          ) : (
            <div className="auth-tabs">
              <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")} type="button">登录</button>
              {registrationEnabled && <button className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); void loadRecoveryQuestions(); }} type="button">注册</button>}
            </div>
          )}
          {authMode === "recover" ? (
            <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void (recoveryChallenge ? resetForgottenPassword() : requestRecoveryChallenge()); }}>
              <label>
                <span>账户邮箱</span>
                <input value={authEmail} onChange={(event) => { setAuthEmail(event.target.value); setRecoveryChallenge(null); }} type="email" autoComplete="email" required maxLength={254} disabled={Boolean(recoveryChallenge)} />
              </label>
              {recoveryChallenge ? (
                <>
                  <div className="recovery-question"><span>验证问题</span><strong>{recoveryChallenge.question}</strong></div>
                  <label><span>验证答案</span><input value={recoveryAnswer} onChange={(event) => setRecoveryAnswer(event.target.value)} type="text" autoComplete="off" required minLength={3} maxLength={200} /></label>
                  <label><span>新密码</span><input value={recoveryNextPassword} onChange={(event) => setRecoveryNextPassword(event.target.value)} type="password" autoComplete="new-password" required minLength={12} maxLength={1024} /></label>
                  <label><span>重复新密码</span><input value={recoveryNextPasswordRepeat} onChange={(event) => setRecoveryNextPasswordRepeat(event.target.value)} type="password" autoComplete="new-password" required minLength={12} maxLength={1024} /></label>
                </>
              ) : null}
              <button className="auth-submit" disabled={!authChecked || task.status === "submitting"} type="submit">{task.status === "submitting" ? "处理中..." : recoveryChallenge ? "验证并重设密码" : "下一步：验证问题"}</button>
              {task.message && <p className={`auth-message ${task.status === "error" ? "error" : ""}`}>{task.message}{task.meta ? ` · ${task.meta}` : ""}</p>}
            </form>
          ) : (
            <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submitAuth(); }}>
              <label><span>邮箱</span><input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" autoComplete="email" required maxLength={254} /></label>
              <label><span>密码</span><input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={authMode === "register" ? 12 : 1} maxLength={1024} /></label>
              {authMode === "register" && (
                <>
                  <label><span>重复密码</span><input value={authPasswordRepeat} onChange={(event) => setAuthPasswordRepeat(event.target.value)} type="password" autoComplete="new-password" required minLength={12} maxLength={1024} /></label>
                  <label>
                    <span>忘记密码验证问题</span>
                    <select value={recoveryQuestionId} onChange={(event) => setRecoveryQuestionId(event.target.value)} required>
                      {recoveryQuestions.map((item) => <option value={item.id} key={item.id}>{item.question}</option>)}
                    </select>
                  </label>
                  <label><span>验证答案</span><input value={recoveryAnswer} onChange={(event) => setRecoveryAnswer(event.target.value)} type="text" autoComplete="off" required minLength={8} maxLength={200} /></label>
                  <p className="muted">答案仅保存不可逆哈希；忘记密码时必须正确回答。</p>
                </>
              )}
              <button className="auth-submit" disabled={!authChecked || task.status === "submitting"} type="submit">{task.status === "submitting" ? "处理中..." : authMode === "register" ? "注册并进入" : "登录"}</button>
              {authMode === "login" && <button className="forgot-password-button" type="button" onClick={() => { setAuthMode("recover"); setRecoveryChallenge(null); setTask({ status: "idle", message: "请输入账户邮箱。" }); }}>忘记密码？</button>}
              {!registrationEnabled && <p className="muted">公开注册已关闭，请使用已有账户登录。</p>}
              {task.message && <p className={`auth-message ${task.status === "error" ? "error" : ""}`}>{task.message}{task.meta ? ` · ${task.meta}` : ""}</p>}
            </form>
          )}
        </section>
      </main>
    );
  }

  if (view === "workspace") {
    return (
      <main className="studio-workspace">
        <aside className="work-rail" aria-label="Workspace navigation">
          <div className="work-rail-top">
            <button className="brand-mark" onClick={() => setView("home")} title="返回首页">FS</button>
            <button className="rail-button active" title="当前工作区"><Command size={19} /></button>
            <button className="rail-button" title="新项目" onClick={openNewProject}><Plus size={19} /></button>
          </div>
          <div className="conversation-sidebar">
            <div className="conversation-sidebar-head">
              <p className="eyebrow">History</p>
              <h2>历史对话</h2>
            </div>
            <div className="conversation-list">
              {runHistoryEntries.length ? runHistoryEntries.map((conversation) => (
                <button
                  className={`conversation-item ${conversation.runs.some((run) => run.id === workbench.runId) || Boolean(conversation.projectId && conversation.projectId === workbench.projectId) ? "active" : ""}`}
                  key={conversation.id}
                  onClick={() => openHistoryConversation(conversation)}
                  title={conversation.prompt || conversation.latestRun.id}
                >
                  <span><MessageSquareText size={14} />{formatRunTime(conversation.updatedAt || conversation.createdAt || null)}</span>
                  <strong>{conversationHistoryTitle(conversation)}</strong>
                  {conversation.latestPrompt && conversation.latestPrompt !== conversation.prompt && (
                    <small>最近：{compactText(conversation.latestPrompt, 30)}</small>
                  )}
                  <em>{conversationHistoryMeta(conversation)}</em>
                </button>
              )) : (
                <p className="conversation-empty">当前项目还没有历史对话。</p>
              )}
            </div>
            <div className="agent-work-sidebar">
              <div className="conversation-sidebar-head compact">
                <p className="eyebrow">Agents</p>
                <h2>工作记录</h2>
              </div>
              <div className="agent-work-list">
                {workbench.agentWork.length ? workbench.agentWork.map((work) => (
                  <article className={`agent-work-item ${work.status}`} key={work.agentId}>
                    <div>
                      <strong>{work.name}</strong>
                      <span>{runStatusText(work.status || "pending")}</span>
                    </div>
                    <p>{compactText(work.summary || work.error || work.instruction || "等待本轮派发。", 86)}</p>
                    {work.writtenFiles?.length ? <em>{work.writtenFiles.slice(0, 3).join(" · ")}</em> : null}
                  </article>
                )) : (
                  <p className="conversation-empty">提交任务后，各岗位的文件写入和工具调用会显示在这里。</p>
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="director-chat">
          <header className="work-header">
            <div>
              <p className="eyebrow">Film Workspace</p>
              <h1>{workbench.projectTitle}</h1>
            </div>
            <div className="account-actions">
              <span>{authUser.email}</span>
              <button className="ghost-button" onClick={() => void openPasswordPanel()}><KeyRound size={15} />账户安全</button>
              <button className="ghost-button" onClick={() => setView("home")}>返回驾驶舱</button>
              <button className="ghost-button" onClick={logout}>退出</button>
            </div>
          </header>

          <div className="chat-stream" aria-label="总导演对话过程">
            {workbench.messages.map((message, index) => (
              <article className={`chat-bubble ${message.speaker}`} key={`${message.title}-${index}`}>
                <span>{message.title}</span>
                <p>{message.body}</p>
              </article>
            ))}
            {workbench.responseText && (
              <article className="chat-bubble director long">
                <span>总导演 / 本轮回复</span>
                <p>{workbench.responseText}</p>
              </article>
            )}
          </div>

          <div className="work-composer">
            <div className="model-toolbar">
              <label>
                <span>模型</span>
                <select
                  value={modelConfig?.activeProfileId || ""}
                  onChange={(event) => switchModelProfile(event.target.value)}
                  disabled={!modelConfig?.profiles.length}
                >
                  {(modelConfig?.profiles || []).map((profile) => (
                    <option value={profile.id} key={profile.id}>
                      {modelDisplayName(profile)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="model-config-button" onClick={() => openModelSettings()} type="button">
                <SlidersHorizontal size={15} />接口
              </button>
              <button className="model-config-button" onClick={startNewModelProfile} type="button">
                <Plus size={15} />新增接口
              </button>
              <em className={activeModelProfile?.hasApiKey ? "model-key-state ready" : "model-key-state"}>
                {activeModelProfile ? `${activeModelProfile.model} · ${activeModelProfile.hasApiKey ? "key 已保存" : "缺少 key"}` : "模型配置未加载"}
              </em>
            </div>
            {modelConfigOpen && (
              <div className="model-config-panel">
                <div className="model-profile-list">
                  <div>
                    <span>已配置接口</span>
                    <button type="button" onClick={startNewModelProfile}><Plus size={14} />新增接口</button>
                  </div>
                  <div className="model-profile-items">
                    {modelConnectionEntries.map((entry) => (
                      <button
                        type="button"
                        className={entry.key === profileConnectionKey(modelDraft) ? "active" : ""}
                        key={entry.key}
                        onClick={() => setModelEditorDraft(entry.profile, modelConfig?.profiles || [])}
                      >
                        <strong>{modelConnectionDisplayName(entry)}</strong>
                        <em>{entry.models.join(" / ")}</em>
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  <span>接口名称（可选）</span>
                  <input value={modelDraft.name} onChange={(event) => setModelDraft({ ...modelDraft, name: event.target.value })} placeholder="默认使用 model" />
                </label>
                <label>
                  <span>Provider</span>
                  <input value={modelDraft.provider} onChange={(event) => setModelDraft({ ...modelDraft, provider: event.target.value })} placeholder="custom" />
                </label>
                <label className="wide">
                  <span>base_url</span>
                  <input value={modelDraft.baseUrl} onChange={(event) => setModelDraft({ ...modelDraft, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" />
                </label>
                <div className="model-list-editor">
                  <div>
                    <span>Model list</span>
                    <button type="button" onClick={addModelListDraftRow} aria-label="添加模型">
                      <Plus size={14} />
                    </button>
                  </div>
                  {modelListDraft.map((modelName, index) => (
                    <div className="model-list-row" key={index}>
                      <input
                        value={modelName}
                        onChange={(event) => updateModelListDraft(index, event.target.value)}
                        placeholder={index === 0 ? "deepseek-v4-flash" : "deepseek-v4-pro"}
                      />
                      <button
                        type="button"
                        onClick={() => removeModelListDraftRow(index)}
                        disabled={modelListDraft.length <= 1}
                        aria-label="删除模型"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <label>
                  <span>api_key</span>
                  <input
                    type="password"
                    value={modelDraft.apiKey || ""}
                    onChange={(event) => setModelDraft({ ...modelDraft, apiKey: event.target.value })}
                    placeholder={modelDraft.hasApiKey ? "已保存，留空不变" : "输入 API key"}
                  />
                </label>
                <label>
                  <span>wire_api</span>
                  <select value={modelDraft.wireApi} onChange={(event) => setModelDraft({ ...modelDraft, wireApi: event.target.value as ModelProfile["wireApi"] })}>
                    <option value="responses">responses</option>
                    <option value="chat">chat/completions</option>
                    <option value="anthropic">anthropic/messages</option>
                  </select>
                </label>
                <label>
                  <span>auth</span>
                  <select value={modelDraft.authScheme} onChange={(event) => setModelDraft({ ...modelDraft, authScheme: event.target.value as ModelProfile["authScheme"] })}>
                    <option value="bearer">bearer</option>
                    <option value="x-api-key">x-api-key</option>
                    <option value="none">none</option>
                  </select>
                </label>
                <label>
                  <span>reasoning</span>
                  <select value={modelDraft.reasoningEffort} onChange={(event) => setModelDraft({ ...modelDraft, reasoningEffort: event.target.value })}>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="xhigh">xhigh</option>
                  </select>
                </label>
                <label className="toggle-line">
                  <input
                    type="checkbox"
                    checked={modelDraft.disableResponseStorage}
                    onChange={(event) => setModelDraft({ ...modelDraft, disableResponseStorage: event.target.checked })}
                  />
                  <span>disable response storage</span>
                </label>
                <div className="model-config-actions">
                  <button type="button" onClick={saveModelDraft}>保存并使用</button>
                  <button type="button" onClick={() => setModelConfigOpen(false)}>关闭</button>
                </div>
              </div>
            )}
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="告诉总导演你的创意、风格、角色、时长和具体要求"
            />
            <button aria-label="Send prompt" onClick={submitPrompt} disabled={task.status === "submitting"}>
              {task.status === "submitting" ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            </button>
          </div>
        </section>

        <section className="agent-board" aria-label="角色工作区">
          <header className="board-header">
            <div>
              <p className="eyebrow">Agent Work Board</p>
              <h2>角色工作与文件产物</h2>
            </div>
            <span className={`work-state ${workbench.status}`}>{workStatusText(workbench.status)}</span>
          </header>

          <div className="project-history-panel">
            <div className="section-title compact">
              <div>
                <p className="eyebrow">Library</p>
                <h2>历史子项目</h2>
              </div>
              <div className="new-project-inline">
                <input value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} placeholder="新项目名称" />
                <button className="ghost-button" onClick={openNewProject}><Plus size={16} />创建</button>
              </div>
            </div>
            <div className="library-list">
              {libraryEntries.length ? libraryEntries.map((entry) => (
                <article
                  className={`library-item ${entry.projectId === currentProjectId ? "active" : ""}`}
                  key={entry.key}
                >
                  <button className="library-main" onClick={() => selectProject(entry.projectId)}>
                    <em>{entry.historyCode}</em>
                    <strong>{entry.title}</strong>
                    <span>{entry.subtitle}</span>
                    <small>{entry.meta}</small>
                  </button>
                  {entry.projectId && renamingProjectId === entry.projectId ? (
                    <div className="rename-project-row">
                      <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} placeholder="只修改文字名称" />
                      <button onClick={() => submitProjectRename(entry.projectId)}>保存</button>
                      <button onClick={() => setRenamingProjectId("")}>取消</button>
                    </div>
                  ) : entry.projectId ? (
                    <button className="rename-project-button" onClick={() => beginRenameProject(entry.projectId)}>重命名</button>
                  ) : null}
                </article>
              )) : (
                <p className="muted">还没有历史子项目。先创建一个项目，后续工作会统一归档到这里。</p>
              )}
            </div>
          </div>

          <div className="timeline-panel">
            <div className="section-title compact">
              <div>
                <p className="eyebrow">Harness Timeline</p>
                <h2>当前工作过程</h2>
              </div>
              <span>
                {workbench.events.length
                  ? `${workbench.events.length} 当前阶段${workbench.historyEvents.length ? ` · ${timelineRunCount(workbench.historyEvents)} 历史轮次折叠` : ""}`
                  : "等待开始"}
              </span>
            </div>
            <div className="timeline-list">
              {workbench.events.length ? workbench.events.map((event) => (
                <article className={`timeline-item ${event.status}`} key={event.id}>
                  <div>
                    <strong>{event.label}</strong>
                    <span>{event.runLabel ? `${event.runLabel} · ` : ""}{event.owner} · {eventStatusText(event.status)}</span>
                  </div>
                  <p>{event.detail}</p>
                  {event.files?.length ? <em>{event.files.join(" · ")}</em> : null}
                </article>
              )) : (
                <p className="muted">提交任务后，这里按真实执行结果显示：需求确认、派发、总导演判断、各 Agent 交付、审查与归档。</p>
              )}
            </div>
            {workbench.historyEvents.length ? (
              <details className="timeline-history">
                <summary>
                  历史流程已折叠：{timelineRunCount(workbench.historyEvents)} 个历史轮次，
                  {workbench.historyEvents.length} 条阶段记录，
                  {timelineFailureCount(workbench.historyEvents)} 条异常
                </summary>
                <div className="timeline-history-list">
                  {compactHistoryEvents(workbench.historyEvents).map((event) => (
                    <article className={`timeline-history-item ${event.status}`} key={event.id}>
                      <strong>{event.label}</strong>
                      <span>{event.runLabel ? `${event.runLabel} · ` : ""}{event.owner} · {eventStatusText(event.status)}</span>
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <div className="document-workbench">
            <div className="document-list-panel">
              <div className="section-title compact">
                <div>
                  <p className="eyebrow">Project Files</p>
                  <h2>工作文件</h2>
                </div>
              </div>
              <div className="document-list">
                {docRows.map((doc) => (
                  <button className={`document-item ${selectedFile?.relativePath === documentRelativePath(doc) ? "active" : ""}`} key={doc.name} onClick={() => openProjectFile(documentRelativePath(doc))}>
                    <strong>{doc.name}</strong>
                    <span>{documentRelativePath(doc) || doc.folder}</span>
                    <em>{doc.owner} · {doc.state}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="file-preview-panel">
              <div className="section-title compact">
                <div>
                  <p className="eyebrow">Markdown Preview</p>
                  <h2>{selectedFile?.name || "选择一个工作文件"}</h2>
                </div>
                {selectedFile && (
                  <div className="file-actions">
                    {selectedFileIsKeyframe && (
                      <>
                        <button className="ghost-button" onClick={() => runAssetAction(null, "generate-image", selectedFileGenerationPrompt)} title="根据当前关键帧文件生成图片">
                          <ImageIcon size={14} />生成图
                        </button>
                        <button className="ghost-button" onClick={() => runAssetAction(null, "generate-video", selectedFileGenerationPrompt)} title="根据当前关键帧文件生成视频">
                          <Video size={14} />生成视频
                        </button>
                      </>
                    )}
                    <button className="ghost-button" onClick={() => setFileMode(fileMode === "preview" ? "edit" : "preview")}>
                      {fileMode === "preview" ? "编辑" : "预览"}
                    </button>
                    <button className="ghost-button" onClick={saveSelectedFile}>保存</button>
                  </div>
                )}
              </div>
              {selectedFile ? (
                fileMode === "edit" ? (
                  <textarea className="markdown-editor" value={fileDraft} onChange={(event) => setFileDraft(event.target.value)} />
                ) : (
                  <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: selectedFile.previewHtml }} />
                )
              ) : (
                <p className="muted">点击左侧 `WORLD_SETTING.md`、`PROJECT_BRIEF.md` 等文件后，这里会按 Markdown Preview Enhanced 类似方式展示，并可切换编辑保存。</p>
              )}
            </div>
          </div>

          <div className="asset-panel">
            <div className="section-title compact">
              <div>
                <p className="eyebrow">Assets</p>
                <h2>图片 / 视频产物</h2>
              </div>
              {activeAssetJobId && <button className="ghost-button" onClick={cancelActiveAssetJob}>取消当前任务</button>}
            </div>
            <div className="asset-grid">
              {projectAssets.length ? projectAssets.map((asset) => (
                <figure className="asset-card" key={asset.relativePath}>
                  {asset.type === "video" ? (
                    <video src={asset.url} controls />
                  ) : (
                    <img src={asset.url} alt={asset.name} />
                  )}
                  <figcaption>
                    <strong>{asset.name}</strong>
                    <span>{asset.relativePath}</span>
                    <div>
                      <button onClick={() => runAssetAction(asset, "regenerate")}>重新生成</button>
                      <button onClick={() => runAssetAction(asset, "edit")}>编辑</button>
                      {asset.type === "image" && <button onClick={() => runAssetAction(asset, "generate-video")}>转视频</button>}
                    </div>
                  </figcaption>
                </figure>
              )) : (
                <div className="asset-empty">
                  <p className="muted">角色样图、关键帧和镜头视频生成后，会按当前项目显示在这里。</p>
                  <div>
                    <button onClick={() => runAssetAction(null, "generate-image")}>生成图片版本</button>
                    <button onClick={() => runAssetAction(null, "generate-video")}>生成视频版本</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="agent-memory-panel">
            <div className="section-title compact">
              <div>
                <p className="eyebrow">Agent Memory / Skills</p>
                <h2>角色记忆与技能</h2>
              </div>
            </div>
            <div className="memory-grid">
              {agentMemoryRows.slice(0, 6).map((item) => (
                <article className="memory-card" key={item.agentId}>
                  <strong>{item.name}</strong>
                  <span>{item.memoryCount} memories · {item.skillCount} skills</span>
                  <em>{item.skillNames.length ? item.skillNames.join(" · ") : "等待角色整理自己的 skills"}</em>
                </article>
              ))}
            </div>
          </div>

          {workbench.approval?.entries?.length ? (
            <div className={`approval-panel ${workbench.approval.status}`}>
              <div className="section-title compact">
                <div>
                  <p className="eyebrow">Human Approval Gate</p>
                  <h2>{workbench.approval.required ? "Agent 草稿待审批" : `Agent 草稿：${runStatusText(workbench.approval.status)}`}</h2>
                  <p className="muted">批准前草稿只保存在 run 归档中，不会覆盖正式项目文件。</p>
                </div>
                <div className="approval-actions">
                  <button className="ghost-button" disabled={task.status === "submitting"} onClick={() => void refreshRunApproval()}>
                    <RefreshCw size={14} />刷新
                  </button>
                  {workbench.approval.rollback?.available ? (
                    <button className="ghost-button reject" disabled={task.status === "submitting"} onClick={rollbackLatestApproval}>回滚最近发布</button>
                  ) : null}
                  {workbench.approval.required ? (
                    <>
                      <label className="approval-select-all">
                        <input
                          type="checkbox"
                          checked={
                            workbench.approval.entries.filter((entry) => entry.status === "pending").length > 0
                            && selectedApprovalEntryIds.length === workbench.approval.entries.filter((entry) => entry.status === "pending").length
                          }
                          onChange={(event) => setSelectedApprovalEntryIds(event.target.checked
                            ? workbench.approval!.entries.filter((entry) => entry.status === "pending").map((entry) => entry.id)
                            : [])}
                        />
                        全选待审
                      </label>
                      <button className="ghost-button reject" disabled={task.status === "submitting" || !selectedApprovalEntryIds.length} onClick={() => decideRunApproval("reject")}>拒绝所选</button>
                      <button
                        className="primary-action"
                        disabled={
                          task.status === "submitting"
                          || !selectedApprovalEntryIds.length
                          || workbench.approval.entries.some((entry) => selectedApprovalEntryIds.includes(entry.id) && entry.conflicted)
                        }
                        onClick={() => decideRunApproval("approve")}
                      >
                        批准所选 ({selectedApprovalEntryIds.length})
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="approval-drafts">
                {workbench.approval.entries.map((entry) => (
                  <details className={`approval-draft ${entry.conflicted ? "conflicted" : ""}`} key={entry.id} open={workbench.approval?.required}>
                    <summary>
                      <input
                        type="checkbox"
                        aria-label={`选择 ${entry.targetPath}`}
                        checked={selectedApprovalEntryIds.includes(entry.id)}
                        disabled={entry.status !== "pending"}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setSelectedApprovalEntryIds((current) => event.target.checked
                          ? [...new Set([...current, entry.id])]
                          : current.filter((id) => id !== entry.id))}
                      />
                      <strong>{entry.agentName || agentName(entry.agentId)}</strong>
                      <code>{entry.targetPath}</code>
                      <span>{entry.mode === "append" ? "追加" : "替换"} · {runStatusText(entry.status)}{entry.conflicted ? " · 正式文件已变化" : ""}</span>
                    </summary>
                    {entry.conflicted ? (
                      <p className="approval-conflict-note">该正式文件在草稿生成后发生变化。系统已禁止批准，请刷新并通过继续 Run 重新生成草稿。</p>
                    ) : null}
                    {entry.diff ? (
                      <div className="approval-diff-summary">
                        <span>+{entry.diff.added}</span>
                        <span>-{entry.diff.removed}</span>
                        <em>{entry.diff.beforeLineCount} → {entry.diff.afterLineCount} 行{entry.diff.truncated ? " · 大文件仅展示前段差异" : ""}</em>
                      </div>
                    ) : null}
                    <div className="approval-diff">
                      <section>
                        <h3>当前正式版本</h3>
                        <pre>{entry.currentContent || "（当前文件不存在或这是目录接力记录）"}</pre>
                      </section>
                      <section>
                        <h3>Agent 草稿</h3>
                        <pre>{entry.draftContent || "（草稿内容为空）"}</pre>
                      </section>
                    </div>
                    {entry.diff?.lines?.length ? (
                      <div className="approval-unified-diff" aria-label={`${entry.targetPath} 结构化行差异`}>
                        {entry.diff.lines.map((line, index) => (
                          <div className={line.type} key={`${line.type}-${line.oldLine}-${line.newLine}-${index}`}>
                            <span>{line.oldLine ?? ""}</span>
                            <span>{line.newLine ?? ""}</span>
                            <code>{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}{line.text}</code>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {entry.status === "pending" ? (
                      <div className="approval-entry-actions">
                        <button className="ghost-button reject" disabled={task.status === "submitting"} onClick={() => decideRunApproval("reject", [entry.id])}>拒绝此文件</button>
                        <button className="primary-action" disabled={task.status === "submitting" || entry.conflicted} onClick={() => decideRunApproval("approve", [entry.id])}>批准此文件</button>
                      </div>
                    ) : null}
                  </details>
                ))}
              </div>
            </div>
          ) : null}

          <div className="run-files">
            <div className="section-title compact">
              <div>
                <p className="eyebrow">Generated Files</p>
                <h2>本次工作产生的文件</h2>
              </div>
              <Folder size={20} />
            </div>
            {workbench.files.length ? workbench.files.map((file) => (
              <div className="run-file-row" key={file.path}>
                <strong>{file.name}</strong>
                <code>{file.relativePath || file.path}</code>
              </div>
            )) : (
              <p className="muted">开始工作后，这里会显示 TASK.md、ROUTE.json、RESULT.md 以及后续项目资料库文件。</p>
            )}
          </div>
        </section>
        {renderPasswordPanel()}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="side-rail" aria-label="Primary navigation">
        <div className="brand-mark">FS</div>
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <a className="rail-button" href={`#${item.id}`} key={item.id} aria-label={item.label} title={item.label}>
              <Icon size={19} />
            </a>
          );
        })}
      </aside>

      <section className="workspace" id="cockpit">
        <header className="topbar">
          <div>
            <p className="eyebrow">{runtime?.activeProject?.id || "Film Studio"}</p>
            <h1>AI 电影公司生产驾驶舱</h1>
          </div>
          <div className="topbar-actions">
            <span className="account-label">{authUser.email}</span>
            <button className="icon-button" aria-label="账户安全" title="账户安全" onClick={() => void openPasswordPanel()}><KeyRound size={18} /></button>
            <button className="icon-button" aria-label="Search" title="Search"><Search size={18} /></button>
            <button className="icon-button" aria-label="Settings" title="Settings" onClick={() => { setView("workspace"); openModelSettings(); }}><SlidersHorizontal size={18} /></button>
            <button className="primary-action" onClick={openNewProject}><Plus size={18} />新项目</button>
            <button className="icon-button" aria-label="Logout" title="Logout" onClick={logout}><X size={18} /></button>
          </div>
        </header>

        <section className="project-strip" aria-label="项目列表">
          <div>
            <p className="eyebrow">Projects</p>
            <h2>{currentProject?.title || currentProjectId || "请选择项目"}</h2>
          </div>
          <div className="project-list horizontal">
            {projectRows.map((project) => (
              <button className={`project-pill ${project.id === currentProjectId ? "active" : ""}`} key={project.id} onClick={() => selectProject(project.id)}>
                <strong>{project.title || project.id}</strong>
                <span>{project.id}</span>
              </button>
            ))}
          </div>
          <div className="new-project-inline">
            <input value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} placeholder="新项目名称" />
            <button className="ghost-button" onClick={openNewProject}><Plus size={16} />创建</button>
          </div>
        </section>

        <section className="hero-grid">
          <div className="prompt-panel">
            <div className="panel-header">
              <span className="live-dot"><Radio size={14} />Agent Loop</span>
              <span>{runtime?.backend?.ready ? "Local Ready" : "Asia/Shanghai"}</span>
            </div>
            <h2>从一句创意，到可归档的影片工程。</h2>
            <p>
              参考 OiiOii 的沉浸式创作入口，将多 agent 路由、工作区、工具调用和双通道交付，组织成一个面向影视生产的控制台。
            </p>
            <div className="composer">
              <button className="shuffle-button" aria-label="换一换" title="换一换" onClick={rotatePrompt} type="button">
                <RefreshCw size={18} />
              </button>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              <button aria-label="Send prompt" onClick={submitPrompt} disabled={task.status === "submitting"}>
                {task.status === "submitting" ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
            <div className="prompt-module-table" aria-label="总导演需求模块">
              <div className="module-table-head">
                <strong>总导演可工作的需求点</strong>
                <span>固定格式，模块轮换</span>
              </div>
              {promptModules.map((module) => (
                <div className="module-row" key={module.name}>
                  <strong>{module.name}</strong>
                  <span>{module.description}</span>
                  <em>{module.examples.join(" / ")}</em>
                </div>
              ))}
            </div>
            <div className="quick-actions">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return <button key={action.label} onClick={() => setPrompt(`${action.label}：${defaultPrompt}`)}><Icon size={16} />{action.label}</button>;
              })}
            </div>
            <div className={`task-result ${task.status}`} role="status">
              <div className="task-result-head">
                <span><Server size={15} />Backend</span>
                <em>{task.status === "idle" ? "待提交" : task.status === "submitting" ? "提交中" : task.status === "success" ? "已返回" : "需要配置"}</em>
              </div>
              <p>{task.message}</p>
              {task.meta && <code>{task.meta}</code>}
            </div>
          </div>

          <div className="preview-stage" id="canvas">
            <img src={projectPreviewAsset?.url || "/assets/dino.png"} alt={currentProject ? `${currentProject.title} 项目视觉` : "项目关键视觉"} decoding="async" />
            <div className="preview-overlay">
              <span>Canvas Preview</span>
              <strong>{currentProject?.title || "尚未选择项目"}</strong>
            </div>
            <button className="play-button" aria-label="打开项目资产" title="打开项目资产" onClick={() => setView("workspace")}><Play size={24} fill="currentColor" /></button>
          </div>
        </section>

        <section className="loop-strip" aria-label="Agent loop">
          {loopSteps.map((step, index) => (
            <div className="loop-step" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
              {index < loopSteps.length - 1 && <ArrowRight size={16} />}
            </div>
          ))}
        </section>

        <section className="content-grid">
          <div className="panel agents-panel" id="agents">
            <div className="section-title">
              <div>
                <p className="eyebrow">Film Agents</p>
                <h2>岗位工位</h2>
              </div>
              <button className="ghost-button" onClick={() => { setView("workspace"); openModelSettings(); }}><Command size={16} />路由配置</button>
            </div>
            <div className="agent-grid">
              {agentCards.map((agent) => {
                const Icon = agent.icon;
                return (
                  <article className="agent-card" key={agent.id} style={{ "--agent-color": agent.color } as CSSProperties}>
                    <div className="agent-head">
                      <div className="agent-icon"><Icon size={20} /></div>
                      <span className={`status ${agent.status}`}>{statusText[agent.status]}</span>
                    </div>
                    <h3>{agent.name}</h3>
                    <p>{agent.role}</p>
                    <div className="io-row"><span>输入</span><strong>{agent.input}</strong></div>
                    <div className="io-row"><span>输出</span><strong>{agent.output}</strong></div>
                    <code>{agent.workspace}</code>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="panel production-panel">
            <div className="section-title compact">
              <div>
                <p className="eyebrow">Current Gate</p>
                <h2>{activeStage.title}</h2>
              </div>
              <CircleDot size={21} />
            </div>
            <p className="muted">当前重点是把剧本翻译为镜头级叙事，让场景美术、关键帧设计和摄影指导能直接接力。</p>
            <div className="gate-card">
              <span>负责人</span><strong>{activeStage.owner}</strong>
              <span>交付物</span><strong>{activeStage.artifact}</strong>
              <span>通过条件</span><strong>{activeStage.gate}</strong>
            </div>
            <div className="asset-stack">
              {assets.map((asset) => (
                <figure key={asset.src}>
                  <img src={asset.src} alt={asset.title} loading="lazy" decoding="async" />
                  <figcaption><span>{asset.tag}</span>{asset.title}</figcaption>
                </figure>
              ))}
            </div>
          </aside>
        </section>

        <section className="pipeline-section panel" id="pipeline">
          <div className="section-title">
            <div>
              <p className="eyebrow">Production Workflow</p>
              <h2>10 阶段生产流水线</h2>
            </div>
            <button className="ghost-button" onClick={() => setPrompt("检查当前项目所有正式文件与对话归档是否完成双通道同步，并列出缺失项。") }><FileCheck2 size={16} />双通道同步</button>
          </div>
          <div className="timeline">
            {stages.map((stage) => (
              <article className="stage-card" key={stage.id}>
                <div className="stage-top"><span>{stage.id}</span><strong>{stage.title}</strong></div>
                <p>{stage.owner}</p>
                <div className="progress"><i style={{ width: `${stage.progress}%` }} /></div>
                <small>{stage.artifact}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="docs-section" id="docs">
          <div className="panel doc-panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">Single Source of Truth</p>
                <h2>项目文档真相源</h2>
              </div>
              <Folder size={22} />
            </div>
            <div className="doc-list">
              {docRows.map((doc) => (
                <div className="doc-row" key={doc.name}>
                  <CheckCircle2 size={18} />
                  <div><strong>{doc.name}</strong><span>{doc.folder} / {doc.owner}</span></div>
                  <em>{doc.state}</em>
                </div>
              ))}
            </div>
          </div>
          <div className="panel handoff-panel">
            <p className="eyebrow">Handoff Rule</p>
            <h2>上一环节的输出，必须能直接成为下一环节的输入。</h2>
            <p>重要产出同时写入项目资料库，并在对话里同步核心内容。页面把这个规则做成显式检查点，减少口头接力和版本漂移。</p>
          </div>
        </section>
      </section>
      {renderPasswordPanel()}
    </main>
  );
}

function buildPromptIdea(index: number) {
  const duration = promptDurations[index % promptDurations.length];
  const type = promptTypes[(index * 3 + 1) % promptTypes.length];
  const style = promptStyles[(index * 5 + 2) % promptStyles.length];
  const story = promptStories[(index * 7 + 4) % promptStories.length];
  const requirementA = promptRequirements[(index * 11 + 3) % promptRequirements.length];
  const requirementB = promptRequirements[(index * 13 + 8) % promptRequirements.length];

  return `帮我做一支 ${duration} 秒的${type}：【风格】${style}，【故事内容】${story}，【具体要求】${requirementA}；${requirementB}。`;
}

function createDraftWorkbench(prompt: string, projectId?: string, projectTitle = "未命名项目"): WorkbenchState {
  return {
    status: "draft",
    projectTitle,
    prompt,
    projectId,
    files: [],
    events: [],
    historyEvents: [],
    agentWork: [],
    messages: [
      {
        speaker: "director",
        title: "总导演 / 项目初始化",
        body: "先把你的创意写进左下角输入框。总导演会先确认时长、类型、风格、故事内容和具体要求，再决定要拉起哪些角色。"
      }
    ]
  };
}

function createEmptyModelProfile(): ModelProfile {
  const id = `custom-${Date.now().toString(36)}`;
  return {
    id,
    name: "",
    provider: "custom",
    model: "",
    baseUrl: "",
    wireApi: "responses",
    authScheme: "bearer",
    reasoningEffort: "high",
    disableResponseStorage: true,
    apiKey: "",
    hasApiKey: false,
    apiKeyMasked: null
  };
}

function modelDisplayName(profile: ModelProfile) {
  return profile.model || profile.name || "未命名模型";
}

function profileConnectionKey(profile: Pick<ModelProfile, "provider" | "baseUrl" | "wireApi" | "authScheme" | "reasoningEffort" | "disableResponseStorage">) {
  return [
    profile.provider || "",
    normalizeBaseUrl(profile.baseUrl),
    profile.wireApi || "",
    profile.authScheme || "",
    profile.reasoningEffort || "",
    String(Boolean(profile.disableResponseStorage))
  ].join("|");
}

function sameModelConnection(a: ModelProfile, b: ModelProfile) {
  return profileConnectionKey(a) === profileConnectionKey(b);
}

function groupModelConnections(profiles: ModelProfile[]): ModelConnectionEntry[] {
  const entries = new Map<string, ModelConnectionEntry>();
  profiles.forEach((profile) => {
    const key = profileConnectionKey(profile);
    const entry = entries.get(key);
    if (entry) {
      entry.profiles.push(profile);
      entry.models = uniqueModelNames([...entry.models, profile.model]);
      return;
    }
    entries.set(key, {
      key,
      profile,
      profiles: [profile],
      models: uniqueModelNames([profile.model])
    });
  });
  return Array.from(entries.values());
}

function modelNamesForProfile(profile: ModelProfile, profiles: ModelProfile[]) {
  const models = profiles
    .filter((item) => sameModelConnection(item, profile))
    .map((item) => item.model);
  return uniqueModelNames([profile.model, ...models, ""]).filter((model, index, items) => model || items.length === 1);
}

function uniqueModelNames(models: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  models.forEach((model) => {
    const value = model.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    result.push(value);
  });
  return result;
}

function normalizeBaseUrl(baseUrl: string) {
  return String(baseUrl || "").trim().replace(/\/$/, "");
}

function modelConnectionDisplayName(entry: ModelConnectionEntry) {
  const label = entry.profile.name && entry.profile.name !== entry.profile.model
    ? entry.profile.name
    : entry.profile.provider || "custom";
  return `${label} · ${entry.models.length} model${entry.models.length > 1 ? "s" : ""}`;
}

function createProjectWorkbench(prompt: string, projectId: string, projectTitle: string, progress?: ProjectProgress | null): WorkbenchState {
  const next = progress?.nextStage;
  const body = next
    ? `已根据项目文件判断当前执行到阶段 ${next.order}「${next.name}」。缺少：${next.missingDeliverables?.length ? next.missingDeliverables.join("、") : "待细化交付物"}。输入“继续”后，总导演会按这个阶段继续派发给 ${next.owner}。`
    : "该项目的标准阶段文件已基本完成。输入“继续”后，总导演会进入审查、补强或按你的新要求追加执行。";

  return {
    status: "draft",
    projectTitle,
    prompt,
    projectId,
    files: [],
    events: [],
    historyEvents: [],
    agentWork: [],
    messages: [
      {
        speaker: "director",
        title: "总导演 / 子项目已选中",
        body
      }
    ]
  };
}

function createRunningWorkbench(prompt: string, projectId: string, parentRunId?: string, previousMessages: WorkMessage[] = []): WorkbenchState {
  const messages: WorkMessage[] = [
    ...previousMessages,
    { speaker: "user", title: parentRunId ? "用户 / 追加需求" : "用户 / 创作需求", body: prompt },
    {
      speaker: "director",
      title: "总导演 / 接收需求",
      body: "我先检查需求八要素：时长、类型、平台、风格、故事内容、角色约束、交付物和审核风险。随后会拉起对应角色进入工作。"
    },
    {
      speaker: "director",
      title: "总导演 / 调度中",
      body: "正在读取本项目的标准流程、项目资料库和岗位交付标准，并提交给后端 Agent Loop。"
    }
  ];

  return {
    status: "running",
    projectTitle: inferProjectTitle(prompt),
    prompt,
    projectId,
    parentRunId,
    files: [],
    events: [
      {
        id: "intake",
        label: "需求进入",
        owner: "director",
        status: "running",
        detail: "总导演正在接收需求并准备组装上下文。",
        files: ["TASK.md"]
      }
    ],
    historyEvents: [],
    agentWork: [],
    messages
  };
}

function eventRunKey(event: WorkEvent) {
  if (event.runId) return event.runId;
  const id = String(event.id || "");
  const separatorIndex = id.indexOf(":");
  return separatorIndex > 0 ? id.slice(0, separatorIndex) : "";
}

function eventBelongsToRun(event: WorkEvent, runId?: string) {
  return Boolean(runId && eventRunKey(event) === runId);
}

function normalizeCurrentEvent(event: WorkEvent, index: number): WorkEvent {
  const rawId = String(event.id || "");
  const localId = rawId.includes(":") ? rawId.slice(rawId.indexOf(":") + 1) : rawId;
  return {
    ...event,
    id: localId || `event-${index}`,
    runId: undefined,
    runLabel: undefined
  };
}

function currentTimelineEvents(runId: string | undefined, primaryEvents: any, statusEvents?: any): WorkEvent[] {
  const statusList = Array.isArray(statusEvents) ? statusEvents : [];
  if (statusList.length) return statusList.map((event, index) => normalizeCurrentEvent(event, index));

  const list = Array.isArray(primaryEvents) ? primaryEvents : [];
  if (!list.length) return [];
  const hasThreadEventIds = list.some((event) => event?.runId || String(event?.id || "").includes(":"));
  if (!hasThreadEventIds) return list.map((event, index) => normalizeCurrentEvent(event, index));

  const current = list.filter((event) => eventBelongsToRun(event, runId) || !eventRunKey(event));
  return (current.length ? current : list.slice(-8)).map((event, index) => normalizeCurrentEvent(event, index));
}

function historyTimelineEvents(runId: string | undefined, threadEvents: any): WorkEvent[] {
  const list = Array.isArray(threadEvents) ? threadEvents : [];
  return list
    .filter((event) => eventRunKey(event) && !eventBelongsToRun(event, runId))
    .slice(-60);
}

function timelineRunCount(events: WorkEvent[]) {
  return new Set(events.map(eventRunKey).filter(Boolean)).size;
}

function timelineFailureCount(events: WorkEvent[]) {
  return events.filter((event) => event.status === "error" || event.status === "degraded").length;
}

function compactHistoryEvents(events: WorkEvent[]) {
  const selected = new Set<string>();
  const indexed = events.map((event, index) => ({ event, index }));
  [...indexed.filter(({ event }) => event.status === "error" || event.status === "degraded").slice(-6), ...indexed.slice(-10)]
    .forEach(({ event }) => selected.add(event.id));
  return indexed
    .filter(({ event }) => selected.has(event.id))
    .sort((a, b) => a.index - b.index)
    .map(({ event }) => event);
}

function createCompletedWorkbench(prompt: string, payload: any, previousMessages: WorkMessage[] = []): WorkbenchState {
  const route = payload?.route as RouteInfo | undefined;
  const degraded = isDegradedPayload(payload);
  const providerError = payloadProviderError(payload);
  const agentError = payloadAgentError(payload);
  const events = currentTimelineEvents(payload?.runId, payload?.events, payload?.status?.events);
  const historyEvents = historyTimelineEvents(payload?.runId, payload?.threadEvents);
  const messages: WorkMessage[] = [
    ...previousMessages,
    { speaker: "user", title: payload?.parentRunId ? "用户 / 追加需求" : "用户 / 创作需求", body: prompt },
    {
      speaker: "director",
      title: "总导演 / 需求判断",
      body: `已创建 ${payload?.projectId || "当前项目"} 的工作请求。本轮采用 ${route?.mode || "single-orchestrator"}，先由总导演统一审查，再把任务拆给对应岗位。`
    },
    ...(route?.reasons || []).map((reason) => ({
      speaker: "agent" as const,
      title: `${agentName(reason.agentId)} / 工作要求`,
      agentId: reason.agentId,
      body: reason.reason
    })),
    {
      speaker: "director",
      title: degraded ? "总导演 / 异常已归档" : "总导演 / 审查与归档",
      body: degraded
        ? `${providerError ? `模型调用失败：${providerError}` : `部分 Agent 未完成：${agentError || "请查看工作记录"}`}。Run ${payload?.runId || "unknown"} 已归档，右侧可查看 STATUS.json、THREAD.md 和失败阶段。`
        : `本轮已归档 ${Array.isArray(payload?.files) ? payload.files.length : 0} 个 run 文件。右侧可以查看角色工作区、标准交付物和本次生成文件。`
    }
  ];

  return {
    status: degraded ? "error" : "done",
    projectTitle: inferProjectTitle(prompt),
    prompt,
    runId: payload?.runId,
    parentRunId: payload?.parentRunId || undefined,
    projectId: payload?.projectId,
    provider: payload?.provider,
    model: payload?.model,
    route,
    files: Array.isArray(payload?.files) ? payload.files : [],
    events,
    historyEvents,
    agentWork: Array.isArray(payload?.agentWork) ? payload.agentWork : [],
    approval: payload?.approval,
    responseText: degraded ? undefined : payload?.text,
    messages
  };
}

function createWorkbenchFromRun(run: any): WorkbenchState {
  const route = run?.route as RouteInfo | undefined;
  const threadMessages = messagesFromRunThread(run);
  const statusValue = run?.status?.status || run?.status || "done";
  const events = currentTimelineEvents(run?.id, run?.events, run?.status?.events);
  const historyEvents = historyTimelineEvents(run?.id, run?.threadEvents);
  return {
    status: statusValue === "error" || statusValue === "degraded" ? "error" : "done",
    projectTitle: inferProjectTitle(run?.prompt || "") || run?.projectId || "历史项目",
    prompt: run?.prompt || "",
    runId: run?.id,
    parentRunId: run?.parentRunId || undefined,
    projectId: run?.projectId,
    provider: run?.provider,
    model: run?.model,
    route,
    files: Array.isArray(run?.files) ? run.files : inferRunFiles(run?.id),
    events,
    historyEvents,
    agentWork: Array.isArray(run?.agentWork) ? run.agentWork : [],
    approval: run?.approval,
    responseText: threadMessages.length ? undefined : run?.resultText,
    messages: threadMessages.length ? threadMessages : [
      { speaker: "user", title: "用户 / 历史需求", body: run?.prompt || "历史 run 未记录 prompt。" },
      {
        speaker: "director",
        title: "总导演 / 历史回溯",
        body: `已载入历史 run：${run?.id || "unknown"}。你可以查看右侧文件和角色工作区，也可以在下方输入框继续追加要求。`
      },
      ...((route?.reasons || []).map((reason) => ({
        speaker: "agent" as const,
        title: `${agentName(reason.agentId)} / 历史工作要求`,
        agentId: reason.agentId,
        body: reason.reason
      })))
    ]
  };
}

function createWorkbenchFromConversation(conversation: ConversationEntry, runDetails: any[]): WorkbenchState {
  const sortedDetails = runDetails
    .slice()
    .sort((a, b) => String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || "")));
  const latest = sortedDetails[sortedDetails.length - 1] || conversation.latestRun;
  const base = createWorkbenchFromRun(latest);
  const selectedAgents = [...new Set(sortedDetails.flatMap((run) => run?.selectedAgents || run?.route?.selectedAgents || []))];
  const messages = messagesFromConversationDetails(sortedDetails.length ? sortedDetails : conversation.runs);
  return {
    ...base,
    projectTitle: conversationHistoryTitle(conversation),
    prompt: conversation.latestPrompt || latest?.prompt || conversation.prompt || "",
    runId: latest?.id || conversation.latestRun.id,
    parentRunId: latest?.parentRunId || undefined,
    projectId: latest?.projectId || conversation.projectId || undefined,
    route: latest?.route || base.route || {
      mode: "project-conversation",
      stepBudget: selectedAgents.length,
      selectedAgents,
      reasons: selectedAgents.filter((agentId) => agentId !== "director").map((agentId) => ({
        agentId,
        reason: "该岗位参与过此项目对话线程。"
      }))
    },
    messages: messages.length ? messages : base.messages
  };
}

function messagesFromRunThread(run: any): WorkMessage[] {
  const thread = Array.isArray(run?.thread) && run.thread.length
    ? run.thread
    : run?.prompt
      ? [{ id: run?.id, prompt: run.prompt, status: run?.status?.status || run?.status, resultText: run?.resultText, providerError: payloadProviderError(run) }]
      : [];
  if (!thread.length) return [];

  const messages: WorkMessage[] = [];
  for (const item of thread) {
    messages.push({
      speaker: "user",
      title: item.id === run?.id ? "用户 / 历史需求" : "用户 / 追加需求",
      body: item.prompt || "历史 run 未记录 prompt。"
    });
    if (item.resultText) {
      messages.push({
        speaker: "director",
        title: item.id === run?.id ? "总导演 / 本轮回复" : "总导演 / 历史回复",
        body: item.resultText
      });
    } else {
      const errorDetail = item.providerError ? `\n${item.providerError}` : "";
      messages.push({
        speaker: "director",
        title: "总导演 / 历史回溯",
        body: `Run ${shortRunId(item.id || "")} · ${runStatusText(item.status || "done")}${errorDetail}`
      });
    }
  }
  return messages;
}

function messagesFromConversationDetails(runDetails: any[]): WorkMessage[] {
  const messages: WorkMessage[] = [];
  for (const [index, item] of runDetails.entries()) {
    const runId = item?.id || "";
    const statusValue = item?.status?.status || item?.status || "done";
    const providerError = payloadProviderError(item);
    const resultText = item?.resultText || (!isDegradedPayload(item) ? item?.text : "");
    const selectedAgents = item?.selectedAgents || item?.route?.selectedAgents || [];
    messages.push({
      speaker: "user",
      title: `用户 / 第 ${index + 1} 轮`,
      body: item?.prompt || "本轮未记录用户输入。"
    });
    messages.push({
      speaker: "director",
      title: `总导演 / 第 ${index + 1} 轮${resultText ? "回复" : "状态"}`,
      body: resultText || [
        `Run ${shortRunId(runId)} · ${runStatusText(statusValue)}`,
        selectedAgents.length ? `参与岗位：${selectedAgents.map(agentName).join("、")}` : "",
        providerError ? `错误：${providerError}` : ""
      ].filter(Boolean).join("\n")
    });
  }
  return messages;
}

function createWorkbenchFromRunSummary(run: RuntimeRun): WorkbenchState {
  const route = {
    mode: "history-summary",
    stepBudget: 1,
    selectedAgents: run.selectedAgents || [],
    reasons: (run.selectedAgents || []).filter((agentId) => agentId !== "director").map((agentId) => ({
      agentId,
      reason: "历史摘要记录该角色参与了本轮工作。"
    }))
  };
  return {
    status: "done",
    projectTitle: inferProjectTitle(run.prompt || "") || run.projectId || "历史项目",
    prompt: run.prompt || "",
    runId: run.id,
    parentRunId: run.parentRunId || undefined,
    projectId: run.projectId || undefined,
    route,
    files: inferRunFiles(run.id),
    events: [],
    historyEvents: [],
    agentWork: [],
    messages: [
      { speaker: "user", title: "用户 / 历史需求", body: run.prompt || "历史 run 未记录 prompt。" },
      {
        speaker: "director",
        title: "总导演 / 历史摘要",
        body: "已从 runs 列表恢复这次工作。若后端已重启到新版，会自动读取 RESULT.md 全文；当前仍可基于这次历史继续追加需求。"
      }
    ]
  };
}

function inferRunFiles(runId?: string): RunFile[] {
  if (!runId) return [];
  return ["TASK.md", "ROUTE.json", "STATUS.json", "AGENT_WORK.json", "AGENT_EVENTS.json", "RESULT.md"].map((name) => ({
    name,
    path: `agent/workspace-film-company/runs/${runId}/${name}`,
    relativePath: `runs/${runId}/${name}`
  }));
}

function shortRunId(runId: string) {
  return runId.length > 12 ? `${runId.slice(0, 10)}...${runId.slice(-6)}` : runId;
}

function compactText(text: string, maxLength: number) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function isContinuationPrompt(text: string) {
  return /^(请继续|继续|继续。|继续吧|go on|continue)$/i.test(String(text || "").trim());
}

function groupConversationEntries(runs: RuntimeRun[]): ConversationEntry[] {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const rootCache = new Map<string, string>();

  function rootRunId(run: RuntimeRun) {
    if (rootCache.has(run.id)) return rootCache.get(run.id) as string;
    let cursor: RuntimeRun | undefined = run;
    const seen = new Set<string>();
    while (cursor?.parentRunId && byId.has(cursor.parentRunId) && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      cursor = byId.get(cursor.parentRunId);
    }
    const rootId = cursor?.id || run.parentRunId || run.id;
    rootCache.set(run.id, rootId);
    return rootId;
  }

  const groups = new Map<string, RuntimeRun[]>();
  for (const run of runs) {
    const groupId = run.projectId ? `project:${run.projectId}` : `thread:${rootRunId(run)}`;
    groups.set(groupId, [...(groups.get(groupId) || []), run]);
  }

  return Array.from(groups.entries()).map(([groupId, groupRuns]) => {
    const sorted = groupRuns
      .slice()
      .sort((a, b) => String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || "")));
    const latestRun = sorted
      .slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0] || sorted[0];
    const projectId = latestRun?.projectId || sorted.find((run) => run.projectId)?.projectId || null;
    const rootId = sorted.find((run) => !run.parentRunId)?.id || rootRunId(latestRun || sorted[0]) || groupId;
    const rootRun = byId.get(rootId) || sorted[0] || latestRun;
    const titleRun = sorted.find((run) => run.prompt && !isContinuationPrompt(run.prompt)) || rootRun || latestRun;
    const selectedAgents = [...new Set(sorted.flatMap((run) => run.selectedAgents || []))];
    return {
      id: groupId,
      rootRunId: rootId,
      projectId,
      latestRun,
      runs: sorted,
      createdAt: rootRun?.createdAt || sorted[0]?.createdAt || null,
      updatedAt: latestRun?.updatedAt || latestRun?.createdAt || null,
      prompt: titleRun?.prompt || rootRun?.prompt || latestRun?.prompt || "",
      latestPrompt: latestRun?.prompt || "",
      status: latestRun?.status,
      selectedAgents,
      runCount: sorted.length
    };
  }).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

function inferProjectTitle(prompt: string) {
  const match = prompt.match(/的([^：:【]+)[：:]/);
  return match?.[1]?.trim() || "未命名项目";
}

function agentName(agentId: string) {
  const names: Record<string, string> = {
    director: "总导演",
    story_novelist: "故事小说家",
    screenwriter: "编剧",
    casting: "选角导演",
    storyboard: "分镜导演",
    scene: "场景美术",
    art_designer: "视觉风格导演",
    keyframe: "关键帧设计",
    cinematographer: "摄影指导"
  };
  return names[agentId] || agentId;
}

function workStatusText(status: WorkbenchState["status"]) {
  return {
    draft: "草稿",
    running: "工作中",
    done: "已归档",
    error: "异常"
  }[status];
}

function eventStatusText(status: WorkEvent["status"]) {
  return {
    pending: "待执行",
    running: "运行中",
    done: "已完成",
    degraded: "失败",
    error: "失败",
    awaiting_approval: "待审批",
    rejected: "已拒绝"
  }[status] || status;
}

function runStatusText(status: string) {
  return {
    done: "完成",
    running: "运行中",
    pending: "待执行",
    degraded: "失败",
    error: "失败",
    awaiting_approval: "待审批",
    approved: "已批准",
    rejected: "已拒绝",
    mixed: "部分批准",
    rolled_back: "已回滚",
    pending_approval: "待审批"
  }[status] || status;
}

function projectProgressText(progress?: ProjectProgress | null) {
  if (!progress) return "阶段状态待读取";
  if (!progress.nextStage) return `全阶段完成 · ${progress.doneStageCount}/${progress.totalStageCount}`;
  const next = progress.nextStage;
  return `阶段 ${next.order}/${progress.totalStageCount} · ${next.name} · ${next.completedDeliverables}/${next.deliverableCount}`;
}

function documentRelativePath(doc: { name: string; folder?: string; relativePath?: string }) {
  return doc.relativePath || [doc.folder, doc.name].filter(Boolean).join("/");
}

function userWorkbenchStorageKey(userId?: string) {
  return userId ? `${workbenchStorageKey}:${userId}` : workbenchStorageKey;
}

function loadSavedWorkbench(userId?: string): WorkbenchState | null {
  try {
    const raw = window.localStorage.getItem(userWorkbenchStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkbenchState;
    if (!parsed || typeof parsed !== "object" || !parsed.prompt) return null;
    const savedEvents = Array.isArray(parsed.events) ? parsed.events : [];
    const savedHistoryEvents = Array.isArray(parsed.historyEvents) && parsed.historyEvents.length
      ? parsed.historyEvents
      : historyTimelineEvents(parsed.runId, savedEvents);
    return {
      ...parsed,
      files: Array.isArray(parsed.files) ? parsed.files : [],
      events: currentTimelineEvents(parsed.runId, savedEvents),
      historyEvents: savedHistoryEvents,
      agentWork: Array.isArray(parsed.agentWork) ? parsed.agentWork : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    };
  } catch {
    return null;
  }
}

function saveWorkbench(workbench: WorkbenchState, userId?: string) {
  try {
    window.localStorage.setItem(userWorkbenchStorageKey(userId), JSON.stringify(workbench));
  } catch {
    // Ignore storage failures; server-side run history remains the source of truth.
  }
}

function formatRunTime(value: string | null) {
  if (!value) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function runHistoryTitle(run: RuntimeRun) {
  const text = String(run.prompt || "").replace(/\s+/g, " ").trim();
  if (!text) return shortRunId(run.id);
  return text.length > 32 ? `${text.slice(0, 32)}...` : text;
}

function conversationHistoryTitle(conversation: ConversationEntry) {
  return compactText(conversation.prompt || conversation.latestPrompt || conversation.latestRun.id, 36);
}

function conversationHistoryMeta(conversation: ConversationEntry) {
  return [
    conversation.runCount > 1 ? `连续 ${conversation.runCount} 轮` : "单轮对话",
    conversation.selectedAgents.length ? `${conversation.selectedAgents.length} 个岗位` : "",
    conversation.status ? runStatusText(conversation.status) : ""
  ].filter(Boolean).join(" · ");
}

function runHistoryMeta(run: RuntimeRun) {
  return [
    run.parentRunId ? "续写" : "新对话",
    run.selectedAgents?.length ? `${run.selectedAgents.length} 个岗位` : "",
    run.status ? runStatusText(run.status) : ""
  ].filter(Boolean).join(" · ");
}

function payloadProviderError(payload: any) {
  return String(
    payload?.providerError ||
    payload?.status?.providerError ||
    payload?.run?.status?.providerError ||
    ""
  ).trim();
}

function payloadAgentError(payload: any) {
  const agentWork = Array.isArray(payload?.agentWork)
    ? payload.agentWork
    : Array.isArray(payload?.run?.agentWork)
      ? payload.run.agentWork
      : [];
  const failed = agentWork.find((item: AgentWork) => item.status === "error" || item.error);
  return String(failed?.error || failed?.summary || "").trim();
}

function payloadErrorDetail(payload: any) {
  return String(
    payloadProviderError(payload) ||
    payloadAgentError(payload) ||
    payload?.detail ||
    payload?.nextStep ||
    payload?.error ||
    ""
  ).trim();
}

function isDegradedPayload(payload: any) {
  const status = payload?.status?.status || payload?.run?.status?.status || payload?.status;
  return Boolean(payload?.degraded || payloadProviderError(payload) || status === "error" || status === "degraded");
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function recoverArchivedRun(projectId: string, prompt: string, startedAt: Date) {
  const startedMs = startedAt.getTime();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt > 0) await delay(1500);
    const response = await apiFetch(`/api/film/runs?project=${encodeURIComponent(projectId)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(payload?.runs)) continue;
    const candidate = payload.runs
      .filter((run: RuntimeRun) => {
        const runTime = Date.parse(String(run.createdAt || run.updatedAt || ""));
        const samePrompt = String(run.prompt || "").trim() === prompt.trim();
        return samePrompt && (!Number.isFinite(runTime) || runTime >= startedMs - 5000);
      })
      .sort((a: RuntimeRun, b: RuntimeRun) => String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")))[0];
    if (!candidate?.id) continue;
    const detailResponse = await apiFetch(`/api/film/runs/${encodeURIComponent(candidate.id)}`);
    const detailPayload = await detailResponse.json().catch(() => ({}));
    if (detailResponse.ok && detailPayload?.run) return detailPayload.run;
    return candidate;
  }
  return null;
}

async function waitForFilmTaskJob(jobId: string, projectId: string, prompt: string, startedAt: Date) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (attempt > 0) await delay(2500);
    const response = await apiFetch(`/api/film/jobs/${encodeURIComponent(jobId)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const recoveredRun = await recoverArchivedRun(projectId, prompt, startedAt).catch(() => null);
      if (recoveredRun) return {
        ok: true,
        ...recoveredRun,
        run: recoveredRun,
        runId: recoveredRun.id,
        projectId: recoveredRun.projectId,
        parentRunId: recoveredRun.parentRunId,
        route: recoveredRun.route,
        files: recoveredRun.files,
        status: recoveredRun.status,
        events: recoveredRun.events,
        thread: recoveredRun.thread,
        threadEvents: recoveredRun.threadEvents,
        agentWork: recoveredRun.agentWork,
        text: recoveredRun.resultText
      };
      throw Object.assign(new Error(payloadErrorDetail(payload) || `Job ${jobId} is not available.`), { payload });
    }
    if (payload?.status === "done" && payload?.result) return payload.result;
    if (payload?.status === "error") {
      throw Object.assign(new Error(payloadErrorDetail(payload?.errorPayload || payload) || "后台任务失败。"), {
        payload: payload?.errorPayload || payload
      });
    }
  }
  const recoveredRun = await recoverArchivedRun(projectId, prompt, startedAt).catch(() => null);
  if (recoveredRun) return {
    ok: true,
    ...recoveredRun,
    run: recoveredRun,
    runId: recoveredRun.id,
    projectId: recoveredRun.projectId,
    parentRunId: recoveredRun.parentRunId,
    route: recoveredRun.route,
    files: recoveredRun.files,
    status: recoveredRun.status,
    events: recoveredRun.events,
    thread: recoveredRun.thread,
    threadEvents: recoveredRun.threadEvents,
    agentWork: recoveredRun.agentWork,
    text: recoveredRun.resultText
  };
  throw new Error(`后台任务 ${jobId} 等待超时。`);
}

async function waitForAssetTaskJob(jobId: string, onProgress?: (job: any) => void) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (attempt > 0) await delay(2500);
    const response = await apiFetch(`/api/film/asset-jobs/${encodeURIComponent(jobId)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.detail || payload?.error || `Asset job ${jobId} is not available.`);
    onProgress?.(payload);
    if (payload?.status === "done" && payload?.result) return { ok: true, asset: payload.result };
    if (payload?.status === "cancelled") throw new Error("资产任务已取消。");
    if (payload?.status === "error") {
      throw new Error(payload?.error?.message || "资产后台任务失败。");
    }
  }
  throw new Error(`资产后台任务 ${jobId} 等待超时。`);
}

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: "include"
  });
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event("film-auth-expired"));
  }
  return response;
}

function describeFetchFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch/i.test(message)) {
    return "浏览器未收到后端 HTTP 响应。优先检查跨域凭证/CORS、HTTPS 代理中断、后端进程重启或长请求超时。";
  }
  return message;
}

function findFallbackAgent(id: string): (typeof agents)[number] | undefined {
  const aliases: Record<string, string> = {
    story_novelist: "novelist",
    casting_director: "casting",
    storyboard_director: "storyboard",
    scene_art: "scene",
    keyframe_designer: "keyframe"
  };
  const normalized = aliases[id] || id;
  return agents.find((agent) => agent.id === normalized || agent.workspace.includes(id) || agent.workspace.includes(normalized));
}
