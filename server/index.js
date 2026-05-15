import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

const app = express();
app.set("trust proxy", 1);
const serviceName = "film-studio-api";
const port = Number(process.env.PORT || 4080);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "https://film.odelialan.space";
const distPath = path.resolve(__dirname, "..", "dist");
const repoRoot = path.resolve(__dirname, "..");
const localAgentRoot = path.join(repoRoot, "agent");
const packagedFilmWorkspace = path.join(localAgentRoot, "workspace-film-company");
const requestedFilmWorkspace = process.env.FILM_WORKSPACE_ROOT
  ? path.resolve(process.env.FILM_WORKSPACE_ROOT)
  : packagedFilmWorkspace;
if (requestedFilmWorkspace !== repoRoot && !requestedFilmWorkspace.startsWith(`${repoRoot}${path.sep}`)) {
  throw new Error("FILM_WORKSPACE_ROOT must stay inside /home/honeycake/project/film-company.");
}
const filmWorkspacePath = requestedFilmWorkspace;
const legacyProjectsRoot = path.join(filmWorkspacePath, "projects");
const legacyRunsRoot = path.join(filmWorkspacePath, "runs");
const projectTemplateRoot = path.join(legacyProjectsRoot, "_PROJECT_TEMPLATE");
const projectsRoot = path.join(repoRoot, "projects");
const migrationMapPath = path.join(projectsRoot, "_migration_map.json");
const modelConfigPath = path.join(__dirname, "model-config.json");
const usersPath = path.join(__dirname, "users.json");
const userDataRoot = path.join(__dirname, "user-data");
const authCookieName = "film_studio_session";
const defaultOwnerEmail = String(process.env.FILM_DEFAULT_OWNER_EMAIL || "lanhanyue1994@163.com").toLowerCase();
const dreaminaBin = process.env.DREAMINA_BIN || "/home/honeycake/.local/bin/dreamina";
const dreaminaPollSeconds = Number(process.env.DREAMINA_POLL_SECONDS || 180);
const defaultProjectName = "未命名新项目";
const runRecordFileNames = ["TASK.md", "ROUTE.json", "STATUS.json", "AGENT_WORK.json", "AGENT_EVENTS.json", "RESULT.md", "THREAD.json", "THREAD.md"];
const modelRequestTimeoutMs = positiveNumberEnv("FILM_MODEL_TIMEOUT_MS", 300_000);
const modelMaxOutputTokens = positiveNumberEnv("FILM_MODEL_MAX_OUTPUT_TOKENS", 4096);
const conversationContextMaxChars = positiveNumberEnv("FILM_CONVERSATION_CONTEXT_MAX_CHARS", 7000);
const taskContextMaxChars = positiveNumberEnv("FILM_TASK_CONTEXT_MAX_CHARS", 12000);
const agentBatchSize = positiveNumberEnv("FILM_AGENT_BATCH_SIZE", 3);
const modelProfileFailoverEnabled = process.env.FILM_MODEL_PROFILE_FAILOVER !== "0";

const allowedOrigins = new Set([
  frontendOrigin,
  "http://127.0.0.1:5173",
  "http://localhost:5173"
].filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true
}));
app.use((req, res, next) => {
  const host = String(req.headers.host || "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "");
  const isLocalHost = /^(127\.0\.0\.1|localhost|\[::1\])(?::|$)/.test(host);
  if (process.env.NODE_ENV === "production" && !isLocalHost && forwardedProto && !forwardedProto.includes("https")) {
    res.redirect(308, `https://${host}${req.originalUrl}`);
    return;
  }
  next();
});
app.use(express.json({ limit: "1mb" }));

await Promise.all([
  fsp.mkdir(projectsRoot, { recursive: true }),
  fsp.mkdir(userDataRoot, { recursive: true })
]);

const filmAgents = [
  {
    id: "director",
    workspaceName: "workspace-director",
    name: "总导演",
    role: "需求澄清、视觉顶层、流程推进与变更同步",
    input: "用户需求、参考链接、平台约束、IP 限制",
    output: "PROJECT_BRIEF、PROJECT_STATUS、视觉顶层定义"
  },
  {
    id: "story_novelist",
    workspaceName: "workspace-story-novelist",
    name: "故事小说家",
    role: "世界观、故事原型、人物动机和情绪弧线",
    input: "项目简报、角色目标、受众与主题",
    output: "WORLD_SETTING、STORY_OUTLINE、STORY_NOTES"
  },
  {
    id: "screenwriter",
    workspaceName: "workspace-screenwriter",
    name: "编剧",
    role: "剧本、节拍、对白和可分镜文本",
    input: "故事大纲、人物关系、平台时长和情绪目标",
    output: "SCRIPT、BEAT_SHEET、DIALOGUE_NOTES"
  },
  {
    id: "casting",
    workspaceName: "workspace-casting-director",
    name: "选角导演",
    role: "角色识别锚点、造型稳定性和视觉匹配",
    input: "剧本角色、视觉风格、已有角色资产",
    output: "CHARACTER_BIBLE、CASTING_NOTES、角色参考图"
  },
  {
    id: "storyboard",
    workspaceName: "workspace-storyboard-director",
    name: "分镜导演",
    role: "把剧本文字翻译成镜头级叙事方案",
    input: "SCRIPT、BEAT_SHEET、视觉风格与角色设定",
    output: "STORYBOARD_MASTER、SHOTLIST、RHYTHM_NOTES"
  },
  {
    id: "scene",
    workspaceName: "workspace-scene-art",
    name: "场景美术",
    role: "场景、布景、材质、灯光氛围与穿帮检查",
    input: "分镜、视觉风格、角色位置和空间关系",
    output: "SCENE_BIBLE、LIGHTING_GUIDE、LOCATION_NOTES"
  },
  {
    id: "art_designer",
    workspaceName: "workspace-art-designer",
    name: "视觉风格导演",
    role: "统一角色、场景、色彩、质感与参考方向",
    input: "故事主题、角色设定、目标平台、参考图",
    output: "VISUAL_STYLE_GUIDE、COLOR_SCRIPT、REFERENCE_BOARD"
  },
  {
    id: "keyframe",
    workspaceName: "workspace-keyframe-designer",
    name: "关键帧设计",
    role: "核心画面、关键动作定格与 Seedream 提示词",
    input: "分镜、场景圣经、角色参考与镜头目标",
    output: "KEYFRAME_PLAN、SEEDREAM_KEYFRAMES、KEYFRAMES"
  },
  {
    id: "cinematographer",
    workspaceName: "workspace-cinematographer",
    name: "摄影指导",
    role: "镜头语言、运镜、焦段、光影和视频生成决策",
    input: "关键帧、SHOTLIST、场景与光影方案",
    output: "CAMERA_LANGUAGE、MOVEMENT_PLAN、LENS_NOTES"
  }
];

const keyDocuments = [
  { name: "USER.md", relativePath: "USER.md", owner: "总导演" },
  { name: "PROJECT_BRIEF.md", relativePath: "00_admin/PROJECT_BRIEF.md", owner: "总导演" },
  { name: "PROJECT_STATUS.md", relativePath: "00_admin/PROJECT_STATUS.md", owner: "总导演" },
  { name: "WORLD_SETTING.md", relativePath: "01_story/WORLD_SETTING.md", owner: "故事小说家" },
  { name: "STORY_OUTLINE.md", relativePath: "01_story/STORY_OUTLINE.md", owner: "故事小说家" },
  { name: "CHARACTER_BIBLE.md", relativePath: "02_characters/CHARACTER_BIBLE.md", owner: "选角导演" },
  { name: "CASTING_NOTES.md", relativePath: "02_characters/CASTING_NOTES.md", owner: "选角导演" },
  { name: "SCRIPT_V1.md", relativePath: "03_script/SCRIPT_V1.md", owner: "编剧" },
  { name: "BEAT_SHEET.md", relativePath: "03_script/BEAT_SHEET.md", owner: "编剧" },
  { name: "STORYBOARD_MASTER.md", relativePath: "04_storyboard/STORYBOARD_MASTER.md", owner: "分镜导演" },
  { name: "SHOTLIST.csv", relativePath: "04_storyboard/SHOTLIST.csv", owner: "分镜导演" },
  { name: "VISUAL_STYLE_GUIDE.md", relativePath: "05_visual/VISUAL_STYLE_GUIDE.md", owner: "视觉风格导演" },
  { name: "COLOR_SCRIPT.md", relativePath: "05_visual/COLOR_SCRIPT.md", owner: "视觉风格导演" },
  { name: "REFERENCE_BOARD.md", relativePath: "05_visual/REFERENCE_BOARD.md", owner: "视觉风格导演" },
  { name: "SCENE_BIBLE.md", relativePath: "06_scene/SCENE_BIBLE.md", owner: "场景美术" },
  { name: "LIGHTING_GUIDE.md", relativePath: "06_scene/LIGHTING_GUIDE.md", owner: "场景美术" },
  { name: "KEYFRAME_PLAN.md", relativePath: "07_keyframes/KEYFRAME_PLAN.md", owner: "关键帧设计" },
  { name: "SEEDREAM_KEYFRAMES.md", relativePath: "07_keyframes/SEEDREAM_KEYFRAMES.md", owner: "关键帧设计" },
  { name: "CAMERA_LANGUAGE.md", relativePath: "08_cinematography/CAMERA_LANGUAGE.md", owner: "摄影指导" },
  { name: "MOVEMENT_PLAN.md", relativePath: "08_cinematography/MOVEMENT_PLAN.md", owner: "摄影指导" },
  { name: "LENS_NOTES.md", relativePath: "08_cinematography/LENS_NOTES.md", owner: "摄影指导" }
];

const agentDeliverables = {
  director: ["USER.md", "00_admin/PROJECT_BRIEF.md", "00_admin/PROJECT_STATUS.md"],
  story_novelist: ["01_story/WORLD_SETTING.md", "01_story/STORY_OUTLINE.md"],
  screenwriter: ["03_script/SCRIPT_V1.md", "03_script/BEAT_SHEET.md"],
  casting: ["02_characters/CHARACTER_BIBLE.md", "02_characters/CASTING_NOTES.md", "02_characters/CHARACTER_REFERENCES/"],
  storyboard: ["04_storyboard/STORYBOARD_MASTER.md", "04_storyboard/SHOTLIST.csv"],
  scene: ["06_scene/SCENE_BIBLE.md", "06_scene/LIGHTING_GUIDE.md"],
  art_designer: ["05_visual/VISUAL_STYLE_GUIDE.md", "05_visual/COLOR_SCRIPT.md"],
  keyframe: ["07_keyframes/KEYFRAME_PLAN.md", "07_keyframes/SEEDREAM_KEYFRAMES.md", "07_keyframes/KEYFRAMES/"],
  cinematographer: ["08_cinematography/CAMERA_LANGUAGE.md", "08_cinematography/MOVEMENT_PLAN.md", "08_cinematography/LENS_NOTES.md", "09_assets/asset_manifest.md"]
};

const agentStageMap = {
  director: ["intake", "context", "route", "archive"],
  story_novelist: ["handoff"],
  screenwriter: ["handoff"],
  casting: ["handoff"],
  storyboard: ["handoff"],
  scene: ["handoff"],
  art_designer: ["handoff"],
  keyframe: ["handoff"],
  cinematographer: ["handoff"]
};

const filmWorkflowStages = [
  {
    id: "stage_1",
    order: 1,
    name: "需求定义与视觉顶层设计",
    ownerAgentId: "director",
    owner: "总导演",
    deliverables: ["USER.md", "00_admin/PROJECT_BRIEF.md", "05_visual/VISUAL_STYLE_GUIDE.md", "05_visual/COLOR_SCRIPT.md", "05_visual/REFERENCE_BOARD.md"],
    completionStandard: "必须在所有执行前完成；目标、平台、时长、风格、分辨率、IP、约束全部明确；视觉风格顶层定义完成。",
    tools: ["chat_requirements", "markdown_write", "reference_board"]
  },
  {
    id: "stage_2",
    order: 2,
    name: "故事编写",
    ownerAgentId: "story_novelist",
    owner: "故事小说家",
    deliverables: ["01_story/WORLD_SETTING.md", "01_story/STORY_OUTLINE.md"],
    completionStandard: "有起承转合、教学目标清晰、角色动机明确。",
    tools: ["markdown_write"]
  },
  {
    id: "stage_3",
    order: 3,
    name: "剧本",
    ownerAgentId: "screenwriter",
    owner: "编剧",
    deliverables: ["03_script/SCRIPT_V1.md", "03_script/BEAT_SHEET.md"],
    completionStandard: "对白自然、与故事大纲一致。",
    tools: ["markdown_write"]
  },
  {
    id: "stage_4",
    order: 4,
    name: "选角与角色定义",
    ownerAgentId: "casting",
    owner: "选角导演",
    deliverables: ["02_characters/CHARACTER_BIBLE.md", "02_characters/CASTING_NOTES.md", "02_characters/CHARACTER_REFERENCES/"],
    completionStandard: "角色形象、色彩、性格、识别锚点明确，与视觉风格统一；确认角色后调用 seedream 工具生成角色样图并保存到公司项目文件夹。",
    tools: ["markdown_write", "seedream_image_generate", "image_reference_save"]
  },
  {
    id: "stage_5",
    order: 5,
    name: "分镜设计",
    ownerAgentId: "storyboard",
    owner: "分镜导演",
    deliverables: ["04_storyboard/STORYBOARD_MASTER.md", "04_storyboard/SHOTLIST.csv"],
    completionStandard: "符合 6 条强制技术规则：1 镜头不超过 2 个关键帧、中文景别、准确方位、关键帧只描述静态画面。",
    tools: ["markdown_write", "shotlist_validate"]
  },
  {
    id: "stage_6",
    order: 6,
    name: "场景美术落地",
    ownerAgentId: "scene",
    owner: "场景美术",
    deliverables: ["06_scene/SCENE_BIBLE.md", "06_scene/LIGHTING_GUIDE.md", "06_scene/LOCATION_OR_SET_NOTES.md"],
    completionStandard: "逐镜头细化与穿帮检查；无穿帮、场景细节完整、空间连续性一致。",
    tools: ["markdown_write", "continuity_check"]
  },
  {
    id: "stage_7",
    order: 7,
    name: "关键帧设计",
    ownerAgentId: "keyframe",
    owner: "镜头关键帧设计",
    deliverables: ["07_keyframes/KEYFRAME_PLAN.md", "07_keyframes/SEEDREAM_KEYFRAMES.md", "07_keyframes/KEYFRAMES/"],
    completionStandard: "按 2 个关键帧/镜头做基础；视觉风格统一、符合分镜、关键动作定格准确；确认后调用 Dreamina（即梦）CLI 生成关键帧。",
    tools: ["markdown_write", "dreamina_text2image", "dreamina_image2image", "dreamina_image2video"]
  },
  {
    id: "stage_8",
    order: 8,
    name: "镜头生成",
    ownerAgentId: "cinematographer",
    owner: "摄影指导",
    deliverables: ["08_cinematography/CAMERA_LANGUAGE.md", "08_cinematography/MOVEMENT_PLAN.md", "08_cinematography/LENS_NOTES.md", "09_assets/asset_manifest.md", "09_assets/raw/", "09_assets/processed/", "09_assets/selects/"],
    completionStandard: "优化判断关键帧数量；根据不同需求调用不同工具生成镜头；镜头语言清晰、运镜节奏明确、光影与情绪匹配。",
    tools: ["markdown_write", "video_generate", "shot_review"]
  }
];

const markdownPreviewCss = [
  "body { font-family: Inter, 'Noto Sans SC', system-ui, sans-serif; line-height: 1.72; color: #f6f2f4; background: transparent; }",
  "h1, h2, h3 { line-height: 1.25; }",
  "table { width: 100%; border-collapse: collapse; margin: 1em 0; }",
  "th, td { border: 1px solid rgba(255,255,255,.16); padding: .55em .7em; vertical-align: top; }",
  "code { color: #70e7ff; }",
  "pre { padding: 1em; overflow: auto; background: rgba(0,0,0,.3); border-radius: 12px; }",
  "blockquote { margin-left: 0; padding-left: 1em; border-left: 3px solid #ef319f; color: rgba(246,242,244,.75); }"
].join("\n");

function envModelProfile() {
  return {
    id: "env-default",
    name: "Default",
    apiKey: process.env.OPENAI_API_KEY || "",
    provider: process.env.MODEL_PROVIDER || "aicodewith",
    model: process.env.MODEL || "gpt-5.5",
    reasoningEffort: process.env.MODEL_REASONING_EFFORT || "high",
    baseUrl: (process.env.MODEL_BASE_URL || "https://api.aicodewith.com/chatgpt/v1").replace(/\/$/, ""),
    wireApi: process.env.WIRE_API || "responses",
    authScheme: process.env.MODEL_AUTH_SCHEME || "bearer",
    disableResponseStorage: String(process.env.DISABLE_RESPONSE_STORAGE || "true") === "true"
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function userIdFromEmail(email) {
  return `user-${createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 18)}`;
}

function readUsersSync() {
  try {
    const record = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    return {
      users: Array.isArray(record?.users) ? record.users : [],
      sessions: Array.isArray(record?.sessions) ? record.sessions : []
    };
  } catch {
    return { users: [], sessions: [] };
  }
}

async function writeUsers(record) {
  await writeJson(usersPath, {
    users: Array.isArray(record?.users) ? record.users : [],
    sessions: Array.isArray(record?.sessions) ? record.sessions : []
  });
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password || ""), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const candidate = Buffer.from(hashPassword(password, user.passwordSalt).hash, "hex");
  const stored = Buffer.from(user.passwordHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function publicUser(user) {
  return user ? {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt || null
  } : null;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      if (index === -1) return [part, ""];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
}

function sessionHash(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function cookieOptions(req, maxAgeSeconds = 30 * 24 * 60 * 60) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "");
  const secure = req.secure || forwardedProto.includes("https") || process.env.COOKIE_SECURE === "true";
  const origin = String(req.headers.origin || "");
  const requestOrigin = `${secure ? "https" : "http"}://${req.headers.host || ""}`;
  const crossOriginCredentials = origin && allowedOrigins.has(origin) && origin !== requestOrigin && secure;
  return [
    `${authCookieName}=`,
    "HttpOnly",
    "Path=/",
    crossOriginCredentials ? "SameSite=None" : "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : ""
  ].filter(Boolean);
}

function setSessionCookie(req, res, token) {
  const parts = cookieOptions(req);
  parts[0] = `${authCookieName}=${encodeURIComponent(token)}`;
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req, res) {
  const parts = cookieOptions(req, 0);
  parts[0] = `${authCookieName}=`;
  res.setHeader("Set-Cookie", parts.join("; "));
}

async function createUserSession(req, res, userId) {
  const record = readUsersSync();
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  record.sessions = [
    {
      tokenHash: sessionHash(token),
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt
    },
    ...record.sessions.filter((session) => new Date(session.expiresAt || 0).getTime() > now)
  ].slice(0, 200);
  await writeUsers(record);
  setSessionCookie(req, res, token);
}

async function authenticateRequest(req) {
  const token = parseCookies(req)[authCookieName];
  if (!token) return null;
  const record = readUsersSync();
  const now = Date.now();
  const tokenHash = sessionHash(token);
  const session = record.sessions.find((item) => item.tokenHash === tokenHash && new Date(item.expiresAt || 0).getTime() > now);
  if (!session) return null;
  const user = record.users.find((item) => item.id === session.userId);
  return user || null;
}

async function requireAuth(req, res, next) {
  const user = await authenticateRequest(req).catch(() => null);
  if (!user) {
    res.status(401).json({ ok: false, error: "Authentication required." });
    return;
  }
  req.user = user;
  next();
}

function userModelConfigPath(user) {
  return path.join(userDataRoot, user.id, "model-config.json");
}

function normalizeModelProfile(profile = {}, existingProfile = null, credentialProfile = null) {
  const fallback = existingProfile || envModelProfile();
  const id = sanitizeProjectName(profile.id || fallback.id || `model-${Date.now().toString(36)}-${cryptoRandom(4)}`) || `model-${cryptoRandom(6)}`;
  const wireApi = ["responses", "chat", "anthropic"].includes(profile.wireApi) ? profile.wireApi : "responses";
  const authScheme = ["bearer", "x-api-key", "none"].includes(profile.authScheme) ? profile.authScheme : "bearer";
  const model = String(profile.model || fallback.model || "gpt-5.5").trim();
  const rawName = String(profile.name || fallback.name || "").trim();
  const apiKey = typeof profile.apiKey === "string" && profile.apiKey.trim()
    ? profile.apiKey.trim()
    : credentialProfile?.apiKey
      ? credentialProfile.apiKey
    : existingProfile?.apiKey || "";
  return {
    id,
    name: (rawName && rawName !== "Custom" ? rawName : model || "Model").slice(0, 80),
    provider: String(profile.provider || fallback.provider || "custom").trim().slice(0, 60),
    model,
    reasoningEffort: String(profile.reasoningEffort || fallback.reasoningEffort || "high").trim(),
    baseUrl: String(profile.baseUrl || fallback.baseUrl || "").trim().replace(/\/$/, ""),
    wireApi,
    authScheme,
    apiKey,
    disableResponseStorage: Boolean(profile.disableResponseStorage ?? fallback.disableResponseStorage ?? true)
  };
}

function readModelSettingsSync(user = null) {
  const envProfile = envModelProfile();
  const configPath = user ? userModelConfigPath(user) : modelConfigPath;
  if (!fs.existsSync(configPath)) {
    if (user) {
      const userProfile = {
        ...envProfile,
        id: "user-default",
        name: "Default",
        apiKey: ""
      };
      return { activeProfileId: userProfile.id, profiles: [userProfile] };
    }
    return { activeProfileId: envProfile.id, profiles: [envProfile] };
  }
  try {
    const record = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const existingProfiles = Array.isArray(record?.profiles) ? record.profiles : [];
    const normalizedProfiles = existingProfiles.length
      ? existingProfiles.map((profile) => normalizeModelProfile(profile))
      : [envProfile];
    const activeProfileId = normalizedProfiles.some((profile) => profile.id === record?.activeProfileId)
      ? record.activeProfileId
      : normalizedProfiles[0].id;
    return { activeProfileId, profiles: normalizedProfiles };
  } catch {
    return { activeProfileId: envProfile.id, profiles: [envProfile] };
  }
}

function publicModelSettings(settings = readModelSettingsSync()) {
  return {
    activeProfileId: settings.activeProfileId,
    profiles: settings.profiles.map((profile) => ({
      ...profile,
      apiKey: "",
      apiKeyMasked: maskKey(profile.apiKey),
      hasApiKey: Boolean(profile.apiKey)
    }))
  };
}

async function writeModelSettings(input = {}, user = null) {
  const existing = readModelSettingsSync(user);
  const existingById = new Map(existing.profiles.map((profile) => [profile.id, profile]));
  const rawProfiles = Array.isArray(input.profiles) && input.profiles.length ? input.profiles : existing.profiles;
  const profiles = rawProfiles.map((profile) => {
    const credentialProfile = existingById.get(profile.copyApiKeyFromProfileId);
    return normalizeModelProfile(profile, existingById.get(profile.id), credentialProfile);
  });
  if (!profiles.length) profiles.push(envModelProfile());
  const activeProfileId = profiles.some((profile) => profile.id === input.activeProfileId)
    ? input.activeProfileId
    : profiles[0].id;
  const settings = { activeProfileId, profiles };
  const configPath = user ? userModelConfigPath(user) : modelConfigPath;
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await writeJson(configPath, settings);
  return settings;
}

function getAiConfig(user = null) {
  const settings = readModelSettingsSync(user);
  const active = settings.profiles.find((profile) => profile.id === settings.activeProfileId) || settings.profiles[0] || envModelProfile();
  return active;
}

function getCallableAiConfigs(user = null) {
  const settings = readModelSettingsSync(user);
  const active = settings.profiles.find((profile) => profile.id === settings.activeProfileId) || settings.profiles[0] || envModelProfile();
  const ordered = [active];
  if (modelProfileFailoverEnabled) {
    const fallbackProfiles = settings.profiles
      .filter((profile) => profile.id !== active.id)
      .map((profile, index) => ({ profile, index }))
      .sort((a, b) => {
        const score = (item) => {
          const profile = item.profile;
          let value = item.index;
          if (profile.baseUrl === active.baseUrl) value -= 100;
          if (profile.provider === active.provider) value -= 30;
          if (profile.wireApi === active.wireApi) value -= 10;
          if (profile.id === "env-default") value += 100;
          return value;
        };
        return score(a) - score(b);
      })
      .map((item) => item.profile);
    ordered.push(...fallbackProfiles);
  }

  const seen = new Set();
  const callable = [];
  for (const profile of ordered) {
    if (!profile?.id || seen.has(profile.id)) continue;
    seen.add(profile.id);
    if (!profile.apiKey && profile.authScheme !== "none") continue;
    callable.push(profile);
  }
  return callable.length ? callable : [active];
}

function maskKey(key) {
  if (!key) return null;
  if (key.length <= 10) return "configured";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function positiveNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeText(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function truncate(text, max = 4000) {
  const value = normalizeText(text).trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n\n[...truncated ${value.length - max} chars]`;
}

async function readTextIfExists(filePath, max = 4000) {
  try {
    const text = await fsp.readFile(filePath, "utf8");
    return truncate(text, max);
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function readJsonIfExists(filePath) {
  const text = await readTextIfExists(filePath, 2_000_000);
  if (!text) return null;
  return JSON.parse(normalizeText(text));
}

function shanghaiDateKey(offsetDays = 0) {
  const date = new Date(Date.now() + (offsetDays * 24 * 60 * 60 * 1000) + (8 * 60 * 60 * 1000));
  return date.toISOString().slice(0, 10);
}

function shanghaiTimeKey() {
  const date = new Date(Date.now() + (8 * 60 * 60 * 1000));
  return date.toISOString().slice(11, 16);
}

async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdownPreview(markdown) {
  const lines = normalizeText(markdown).split(/\r?\n/);
  const html = [];
  let inCode = false;
  let inList = false;
  let inTable = false;
  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      html.push("</tbody></table>");
      inTable = false;
    }
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      closeList();
      closeTable();
      html.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && !/^\s*\|?\s*:?-{3,}:?\s*\|/.test(line)) {
      closeList();
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => `<td>${escapeHtml(cell.trim())}</td>`).join("");
      if (!inTable) {
        html.push("<table><tbody>");
        inTable = true;
      }
      html.push(`<tr>${cells}</tr>`);
      continue;
    }
    if (/^\s*\|?\s*:?-{3,}:?\s*\|/.test(line)) continue;
    closeTable();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) {
      html.push("<br />");
    } else {
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  closeList();
  closeTable();
  if (inCode) html.push("</code></pre>");
  return `<style>${markdownPreviewCss}</style>${html.join("\n")}`;
}

async function pathStats(filePath) {
  try {
    return await fsp.stat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function resolveInside(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Path escapes the configured workspace root.");
  }
  return resolved;
}

function projectRunsPath(projectId) {
  return resolveInside(projectsRoot, projectId, "_runs");
}

function runIdPattern() {
  return "\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z-[a-z0-9]+";
}

function parseProjectFolderName(projectId) {
  const match = String(projectId || "").match(new RegExp(`^(${runIdPattern()})-(.+)$`));
  if (!match) {
    return {
      runIdPrefix: "",
      editableName: String(projectId || "")
    };
  }
  return {
    runIdPrefix: match[1],
    editableName: match[2]
  };
}

function sanitizeProjectName(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 40);
}

function projectIdFromParts(runIdPrefix, name) {
  return `${runIdPrefix}-${sanitizeProjectName(name) || defaultProjectName}`;
}

function isProjectDirectoryName(name) {
  return new RegExp(`^${runIdPattern()}-.+`).test(String(name || ""));
}

function resolveAgentWorkspace(agent) {
  return path.join(localAgentRoot, agent.workspaceName);
}

function extractTitle(markdown, fallback) {
  const match = normalizeText(markdown).match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

async function getStudioStatus() {
  const [workspace, projects] = await Promise.all([
    pathStats(filmWorkspacePath),
    pathStats(projectsRoot)
  ]);
  return {
    ok: Boolean(workspace?.isDirectory()),
    ready: Boolean(workspace?.isDirectory() && projects?.isDirectory()),
    status: workspace?.isDirectory() ? "local" : "missing-workspace",
    workspace: filmWorkspacePath,
    projectStorage: projectsRoot,
    projectsReady: Boolean(projects?.isDirectory()),
    runsReady: Boolean(projects?.isDirectory())
  };
}

async function getAgentSummaries(includeContext = false, user = null) {
  return Promise.all(filmAgents.map(async (agent) => {
    const workspace = resolveAgentWorkspace(agent);
    const workspaceStat = await pathStats(workspace);
    const [soul, rules, tools, memory, todayMemory, yesterdayMemory] = await Promise.all([
      readTextIfExists(path.join(workspace, "SOUL.md"), includeContext ? 1800 : 300),
      readTextIfExists(path.join(workspace, "AGENTS.md"), includeContext ? 1600 : 300),
      readTextIfExists(path.join(workspace, "TOOLS.md"), includeContext ? 1200 : 200),
      readTextIfExists(path.join(workspace, "MEMORY.md"), includeContext ? 1000 : 200),
      readTextIfExists(path.join(workspace, "memory", `${shanghaiDateKey(0)}.md`), includeContext ? 1400 : 200),
      readTextIfExists(path.join(workspace, "memory", `${shanghaiDateKey(-1)}.md`), includeContext ? 1000 : 120)
    ]);
    const recentMemory = [
      todayMemory && `TODAY_MEMORY:\n${todayMemory}`,
      yesterdayMemory && `YESTERDAY_MEMORY:\n${yesterdayMemory}`
    ].filter(Boolean).join("\n\n");

    return {
      ...agent,
      workspace,
      configured: Boolean(workspaceStat?.isDirectory()),
      model: getAiConfig(user).model,
      identity: null,
      title: extractTitle(soul || rules, agent.name),
      hasSoul: Boolean(soul),
      hasRules: Boolean(rules),
      hasTools: Boolean(tools),
      hasMemory: Boolean(memory || recentMemory),
      contextPreview: includeContext ? truncate([
        soul && `SOUL:\n${soul}`,
        rules && `AGENTS:\n${rules}`,
        tools && `TOOLS:\n${tools}`,
        memory && `MEMORY:\n${memory}`,
        recentMemory
      ].filter(Boolean).join("\n\n"), 2200) : undefined
    };
  }));
}

async function listProjectFiles(projectPath) {
  const files = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  await walk(projectPath);
  return files;
}

async function readMigrationMap() {
  const record = await readJsonIfExists(migrationMapPath).catch(() => null);
  return record && typeof record === "object"
    ? { projects: record.projects || {} }
    : { projects: {} };
}

async function writeMigrationMap(map) {
  await writeJson(migrationMapPath, map);
}

function legacyNameFromProjectId(projectId) {
  return sanitizeProjectName(
    String(projectId || "")
      .replace(/^P\d{3}-/, "")
      .replace(/-\d{4}$/, "")
  ) || "项目一";
}

async function resolveProjectId(projectId) {
  const value = String(projectId || "").trim();
  if (!value) return "";
  const migration = await readMigrationMap();
  let current = value;
  const seen = new Set([current]);

  for (let index = 0; index < 10; index += 1) {
    const mapped = migration.projects?.[current];
    if (!mapped || mapped === current || seen.has(mapped)) break;
    const mappedStat = await pathStats(resolveInside(projectsRoot, mapped));
    if (!mappedStat?.isDirectory()) break;
    current = mapped;
    seen.add(current);
  }

  const direct = await pathStats(resolveInside(projectsRoot, current));
  if (direct?.isDirectory()) return current;
  if (current !== value) {
    const fallback = await pathStats(resolveInside(projectsRoot, value));
    if (fallback?.isDirectory()) return value;
  }
  return current;
}

async function requireProjectDirectory(projectId) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const stat = resolvedProjectId ? await pathStats(resolveInside(projectsRoot, resolvedProjectId)) : null;
  if (!stat?.isDirectory()) {
    const error = new Error(`Project not found: ${projectId || "(empty)"}`);
    error.status = 404;
    throw error;
  }
  return resolvedProjectId;
}

async function patchRunProjectReferences(runPath, projectId) {
  const jsonFiles = ["ROUTE.json", "AGENT_WORK.json", "AGENT_EVENTS.json", "CHILD_RUNS.json", "THREAD.json"];
  for (const name of jsonFiles) {
    const filePath = path.join(runPath, name);
    const record = await readJsonIfExists(filePath).catch(() => null);
    if (!record) continue;
    if ("projectId" in record) record.projectId = projectId;
    if (Array.isArray(record.children)) {
      record.children = record.children.map((child) => ({ ...child, projectId }));
    }
    await writeJson(filePath, record);
  }

  const taskPath = path.join(runPath, "TASK.md");
  const task = await readTextIfExists(taskPath, 500_000);
  if (task) {
    const next = task.replace(/^- Project: .+$/m, `- Project: ${projectId}`);
    await fsp.writeFile(taskPath, next, "utf8");
  }
}

async function patchProjectRunReferences(projectId) {
  const runsPath = projectRunsPath(projectId);
  const entries = await fsp.readdir(runsPath, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => patchRunProjectReferences(path.join(runsPath, entry.name), projectId)));
}

async function patchProjectConversationReferences(projectId) {
  const conversationPath = path.join(projectsRoot, projectId, "_conversations");
  const entries = await fsp.readdir(conversationPath, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map(async (entry) => {
      const filePath = path.join(conversationPath, entry.name);
      const record = await readJsonIfExists(filePath).catch(() => null);
      if (!record) return;
      record.projectId = projectId;
      if (Array.isArray(record.turns)) {
        record.turns = record.turns.map((turn) => ({ ...turn, projectId }));
      }
      await writeJson(filePath, record);
      await fsp.writeFile(path.join(conversationPath, entry.name.replace(/\.json$/, ".md")), `${conversationArchiveMarkdown(record)}\n`, "utf8");
    }));
}

async function copyMissingTemplateStructure(templatePath, projectPath) {
  const entries = await fsp.readdir(templatePath, { withFileTypes: true }).catch(() => []);
  await fsp.mkdir(projectPath, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(templatePath, entry.name);
    const targetPath = path.join(projectPath, entry.name);
    if (entry.isDirectory()) {
      await copyMissingTemplateStructure(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      const targetStat = await pathStats(targetPath);
      if (!targetStat) {
        await fsp.mkdir(path.dirname(targetPath), { recursive: true });
        await fsp.writeFile(targetPath, "", "utf8");
      }
    }
  }
}

async function normalizeProjectStructure(projectId) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const stat = await pathStats(projectPath);
  if (!stat?.isDirectory()) return;
  await copyMissingTemplateStructure(projectTemplateRoot, projectPath);
  await fsp.mkdir(projectRunsPath(resolvedProjectId), { recursive: true });
}

async function normalizeAllProjectStructures() {
  const entries = await fsp.readdir(projectsRoot, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && isProjectDirectoryName(entry.name))
    .map((entry) => normalizeProjectStructure(entry.name)));
}

async function migrateLegacyProjectStorage() {
  const migration = await readMigrationMap();
  const legacyProjectEntries = await fsp.readdir(legacyProjectsRoot, { withFileTypes: true }).catch(() => []);

  for (const entry of legacyProjectEntries) {
    if (!entry.isDirectory() || entry.name === "_PROJECT_TEMPLATE") continue;
    const existing = migration.projects[entry.name];
    if (existing && await pathStats(resolveInside(projectsRoot, existing))) continue;

    const newProjectId = projectIdFromParts(createRunId(), legacyNameFromProjectId(entry.name));
    await fsp.cp(path.join(legacyProjectsRoot, entry.name), resolveInside(projectsRoot, newProjectId), { recursive: true });
    await fsp.mkdir(projectRunsPath(newProjectId), { recursive: true });
    await normalizeProjectStructure(newProjectId);
    migration.projects[entry.name] = newProjectId;
  }

  const fallbackProjectId = Object.values(migration.projects)[0] || "";
  const legacyRunEntries = await fsp.readdir(legacyRunsRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of legacyRunEntries) {
    if (!entry.isDirectory()) continue;
    const legacyRunPath = path.join(legacyRunsRoot, entry.name);
    const route = await readJsonIfExists(path.join(legacyRunPath, "ROUTE.json")).catch(() => null);
    const mappedProjectId = migration.projects[route?.projectId] || route?.projectId || fallbackProjectId;
    const projectId = await resolveProjectId(mappedProjectId);
    if (!projectId) continue;
    await fsp.mkdir(projectRunsPath(projectId), { recursive: true });
    const targetRunPath = path.join(projectRunsPath(projectId), entry.name);
    if (!(await pathStats(targetRunPath))) {
      await fsp.cp(legacyRunPath, targetRunPath, { recursive: true });
    }
    await patchRunProjectReferences(targetRunPath, projectId);
  }

  await writeMigrationMap(migration);
}

async function sameFileContent(leftPath, rightPath) {
  const [left, right] = await Promise.all([
    fsp.readFile(leftPath),
    fsp.readFile(rightPath)
  ]);
  return left.equals(right);
}

async function moveFilePreservingDirectories(sourcePath, targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await fsp.rename(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    await fsp.copyFile(sourcePath, targetPath);
    await fsp.rm(sourcePath, { force: true });
  }
}

async function mergeProjectDirectory(sourceProjectId, targetProjectId) {
  if (!sourceProjectId || !targetProjectId || sourceProjectId === targetProjectId) return false;
  const sourcePath = resolveInside(projectsRoot, sourceProjectId);
  const targetPath = resolveInside(projectsRoot, targetProjectId);
  if (sourcePath === targetPath) return false;

  const [sourceStat, targetStat] = await Promise.all([pathStats(sourcePath), pathStats(targetPath)]);
  if (!sourceStat?.isDirectory() || !targetStat?.isDirectory()) return false;

  const conflictRoot = path.join(targetPath, "_renamed_conflicts", sanitizeProjectName(sourceProjectId) || createRunId());
  const files = await listProjectFiles(sourcePath).catch(() => []);
  for (const filePath of files) {
    const relativePath = path.relative(sourcePath, filePath);
    const targetFilePath = path.join(targetPath, relativePath);
    const targetFileStat = await pathStats(targetFilePath);
    if (!targetFileStat) {
      await moveFilePreservingDirectories(filePath, targetFilePath);
      continue;
    }
    if (targetFileStat.isFile() && await sameFileContent(filePath, targetFilePath)) {
      await fsp.rm(filePath, { force: true });
      continue;
    }
    await moveFilePreservingDirectories(filePath, path.join(conflictRoot, relativePath));
  }

  await fsp.rm(sourcePath, { recursive: true, force: true });
  await patchProjectRunReferences(targetProjectId).catch(() => {});
  return true;
}

async function chooseCanonicalProjectId(projectIds, migration) {
  const projectIdSet = new Set(projectIds);
  const mappedTargets = uniqueValues(Object.values(migration.projects || {})
    .filter((projectId) => projectIdSet.has(projectId)));
  if (mappedTargets.length) return mappedTargets[0];

  const scored = await Promise.all(projectIds.map(async (projectId) => {
    const projectPath = resolveInside(projectsRoot, projectId);
    const files = await listProjectFiles(projectPath).catch(() => []);
    const stat = await pathStats(projectPath);
    return {
      projectId,
      fileCount: files.length,
      updatedAt: stat?.mtimeMs || 0
    };
  }));

  return scored
    .sort((a, b) => b.fileCount - a.fileCount || b.updatedAt - a.updatedAt || a.projectId.localeCompare(b.projectId))[0]?.projectId || projectIds[0];
}

async function reconcileProjectAliases() {
  const migration = await readMigrationMap();
  migration.projects = migration.projects || {};
  let changed = false;

  for (const [sourceProjectId, targetProjectId] of Object.entries(migration.projects)) {
    if (!sourceProjectId || !targetProjectId || sourceProjectId === targetProjectId) continue;
    const targetStat = await pathStats(resolveInside(projectsRoot, targetProjectId));
    const sourceStat = await pathStats(resolveInside(projectsRoot, sourceProjectId));
    if (targetStat?.isDirectory() && sourceStat?.isDirectory() && isProjectDirectoryName(sourceProjectId)) {
      changed = await mergeProjectDirectory(sourceProjectId, targetProjectId) || changed;
    }
  }

  const entries = await fsp.readdir(projectsRoot, { withFileTypes: true }).catch(() => []);
  const byRunIdPrefix = new Map();
  for (const entry of entries) {
    if (!entry.isDirectory() || !isProjectDirectoryName(entry.name)) continue;
    const parsed = parseProjectFolderName(entry.name);
    if (!parsed.runIdPrefix) continue;
    const group = byRunIdPrefix.get(parsed.runIdPrefix) || [];
    group.push(entry.name);
    byRunIdPrefix.set(parsed.runIdPrefix, group);
  }

  for (const projectIds of byRunIdPrefix.values()) {
    if (projectIds.length < 2) continue;
    const canonicalProjectId = await chooseCanonicalProjectId(projectIds, migration);
    for (const projectId of projectIds) {
      if (projectId === canonicalProjectId) continue;
      if (migration.projects[projectId] !== canonicalProjectId) {
        migration.projects[projectId] = canonicalProjectId;
        changed = true;
      }
      changed = await mergeProjectDirectory(projectId, canonicalProjectId) || changed;
    }
  }

  if (changed) await writeMigrationMap(migration);
}

async function isTemplateOnlyFile(relativePath, filePath) {
  const templatePath = resolveInside(projectTemplateRoot, relativePath);
  const templateStat = await pathStats(templatePath);
  if (!templateStat?.isFile()) return false;
  const [content, templateContent] = await Promise.all([
    readTextIfExists(filePath, 500_000),
    readTextIfExists(templatePath, 500_000)
  ]);
  return normalizeText(content).trim() === normalizeText(templateContent).trim();
}

const mediaDeliverableDirectories = new Set([
  "02_characters/CHARACTER_REFERENCES/",
  "07_keyframes/KEYFRAMES/",
  "09_assets/raw/",
  "09_assets/processed/",
  "09_assets/selects/"
]);
const mediaFileExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".webm"]);
const minimumDeliverableChars = {
  "USER.md": 500,
  "00_admin/PROJECT_BRIEF.md": 800,
  "05_visual/VISUAL_STYLE_GUIDE.md": 1200,
  "05_visual/COLOR_SCRIPT.md": 900,
  "05_visual/REFERENCE_BOARD.md": 700,
  "01_story/WORLD_SETTING.md": 1000,
  "01_story/STORY_OUTLINE.md": 1200,
  "02_characters/CHARACTER_BIBLE.md": 1500,
  "02_characters/CASTING_NOTES.md": 1000,
  "03_script/SCRIPT_V1.md": 1600,
  "03_script/BEAT_SHEET.md": 900,
  "04_storyboard/STORYBOARD_MASTER.md": 2400,
  "06_scene/SCENE_BIBLE.md": 1600,
  "06_scene/LIGHTING_GUIDE.md": 900,
  "06_scene/LOCATION_OR_SET_NOTES.md": 700,
  "07_keyframes/KEYFRAME_PLAN.md": 1600,
  "07_keyframes/SEEDREAM_KEYFRAMES.md": 1400,
  "08_cinematography/CAMERA_LANGUAGE.md": 1000,
  "08_cinematography/MOVEMENT_PLAN.md": 900,
  "08_cinematography/LENS_NOTES.md": 700,
  "09_assets/asset_manifest.md": 250
};
const requiredTermsByDeliverable = {
  "02_characters/CHARACTER_BIBLE.md": ["角色", "识别", "色彩"],
  "02_characters/CASTING_NOTES.md": ["角色", "参考", "生成"],
  "04_storyboard/STORYBOARD_MASTER.md": ["镜头", "景别", "关键帧"],
  "06_scene/SCENE_BIBLE.md": ["场景", "空间", "连续"],
  "06_scene/LIGHTING_GUIDE.md": ["灯光", "色温", "情绪"],
  "07_keyframes/KEYFRAME_PLAN.md": ["关键帧", "镜头", "画面"],
  "07_keyframes/SEEDREAM_KEYFRAMES.md": ["prompt", "关键帧", "生成"],
  "08_cinematography/CAMERA_LANGUAGE.md": ["镜头", "焦段", "机位"],
  "08_cinematography/MOVEMENT_PLAN.md": ["运镜", "节奏", "镜头"],
  "08_cinematography/LENS_NOTES.md": ["焦段", "景深", "镜头"]
};

async function listFilesRecursive(dirPath) {
  const files = [];
  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  await walk(dirPath);
  return files;
}

function isMediaDeliverableDirectory(relativePath) {
  return mediaDeliverableDirectories.has(relativePath);
}

async function analyzeDirectoryDeliverable(relativePath, targetPath, stat) {
  if (!stat?.isDirectory()) {
    return {
      exists: false,
      itemCount: 0,
      substantiveItemCount: 0,
      requiresTool: isMediaDeliverableDirectory(relativePath),
      quality: "missing",
      reason: "目录缺失"
    };
  }

  const files = await listFilesRecursive(targetPath);
  const mediaFiles = files.filter((filePath) => mediaFileExtensions.has(path.extname(filePath).toLowerCase()));
  const requiresTool = isMediaDeliverableDirectory(relativePath);
  const substantiveItemCount = requiresTool ? mediaFiles.length : files.length;
  const exists = substantiveItemCount > 0;
  return {
    exists,
    itemCount: files.length,
    substantiveItemCount,
    requiresTool,
    quality: exists ? "complete" : "missing-assets",
    reason: exists
      ? ""
      : requiresTool
        ? "缺少真实图片/视频素材；仅有 handoff.md 不算完成"
        : "目录内没有有效文件"
  };
}

function analyzeShotlistCsv(text) {
  const lines = normalizeText(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines[0] || "";
  const columns = header.split(",").map((column) => column.trim());
  const required = ["shot_id", "scene", "景别", "画面", "方位", "关键帧", "状态", "source_run"];
  const missingColumns = required.filter((column) => !columns.includes(column));
  const dataRows = lines.slice(1).filter((line) => !/^shot_id\s*,/i.test(line));
  const issues = [];
  if (missingColumns.length) issues.push(`缺少字段 ${missingColumns.join("、")}`);
  if (dataRows.length < 3) issues.push("镜头行数少于 3");
  return issues;
}

function deliverableQualityIssues(relativePath, text) {
  if (relativePath === "04_storyboard/SHOTLIST.csv") return analyzeShotlistCsv(text);
  const normalized = normalizeText(text).trim();
  const issues = [];
  const minChars = minimumDeliverableChars[relativePath] || 300;
  if (normalized.length < minChars) issues.push(`正文不足 ${minChars} 字符`);
  const unresolvedMarkers = (normalized.match(/待填写|TODO|TBD|\|\s*\|\s*\||-\s*$/g) || []).length;
  if (unresolvedMarkers >= 2 && normalized.length < 2000) issues.push("仍含明显模板占位内容");
  const requiredTerms = requiredTermsByDeliverable[relativePath] || [];
  const missingTerms = requiredTerms.filter((term) => !normalized.includes(term));
  if (missingTerms.length) issues.push(`缺少关键内容：${missingTerms.join("、")}`);
  return issues;
}

async function analyzeFileDeliverable(relativePath, targetPath, stat, templateOnly) {
  if (!stat?.isFile()) {
    return {
      exists: false,
      quality: "missing",
      reason: "文件缺失"
    };
  }
  if (stat.size <= 0) {
    return {
      exists: false,
      quality: "empty",
      reason: "文件为空"
    };
  }
  if (templateOnly) {
    return {
      exists: false,
      quality: "template",
      reason: "仍是模板内容"
    };
  }

  const text = await readTextIfExists(targetPath, 500_000);
  const issues = deliverableQualityIssues(relativePath, text);
  return {
    exists: issues.length === 0,
    quality: issues.length ? "incomplete" : "complete",
    reason: issues.join("；"),
    textLength: normalizeText(text).trim().length
  };
}

async function getWorkflowStageState(projectPath, stage) {
  const deliverables = await Promise.all(stage.deliverables.map(async (relativePath) => {
    const isDirectory = relativePath.endsWith("/");
    const targetPath = resolveInside(projectPath, relativePath);
    const stat = await pathStats(targetPath);
    const templateOnly = !isDirectory && stat?.isFile()
      ? await isTemplateOnlyFile(relativePath, targetPath).catch(() => false)
      : false;
    const analysis = isDirectory
      ? await analyzeDirectoryDeliverable(relativePath, targetPath, stat)
      : await analyzeFileDeliverable(relativePath, targetPath, stat, templateOnly);
    return {
      relativePath,
      name: path.basename(relativePath.replace(/\/$/, "")),
      type: isDirectory ? "directory" : path.extname(relativePath).replace(".", "") || "file",
      exists: analysis.exists,
      templateOnly,
      quality: analysis.quality,
      reason: analysis.reason,
      requiresTool: Boolean(analysis.requiresTool),
      physicalExists: Boolean(stat),
      itemCount: analysis.itemCount || 0,
      substantiveItemCount: analysis.substantiveItemCount || 0,
      textLength: analysis.textLength || 0,
      size: stat?.size || 0,
      updatedAt: stat?.mtime ? stat.mtime.toISOString() : null
    };
  }));
  const doneCount = deliverables.filter((item) => item.exists).length;
  return {
    ...stage,
    status: doneCount === deliverables.length ? "done" : doneCount > 0 ? "working" : "pending",
    completedDeliverables: doneCount,
    deliverableState: deliverables
  };
}

function summarizeProjectProgress(workflow) {
  const nextStage = workflow.find((stage) => stage.status !== "done") || null;
  const doneCount = workflow.filter((stage) => stage.status === "done").length;
  const stageMissingDeliverables = (stage) => stage.deliverableState.filter((item) => !item.exists);
  const missingDeliverables = nextStage ? stageMissingDeliverables(nextStage).map((item) => item.relativePath) : [];
  const incompleteStages = workflow
    .filter((stage) => stage.status !== "done")
    .map((stage) => {
      const missing = stageMissingDeliverables(stage);
      return {
        id: stage.id,
        order: stage.order,
        name: stage.name,
        ownerAgentId: stage.ownerAgentId,
        owner: stage.owner,
        status: stage.status,
        completedDeliverables: stage.completedDeliverables,
        deliverableCount: stage.deliverables.length,
        missingDeliverables: missing.map((item) => item.relativePath),
        actionableMissingDeliverables: missing.filter((item) => !item.requiresTool).map((item) => item.relativePath),
        toolMissingDeliverables: missing.filter((item) => item.requiresTool).map((item) => item.relativePath),
        failedDeliverables: missing.map((item) => ({
          relativePath: item.relativePath,
          reason: item.reason || "未完成",
          requiresTool: Boolean(item.requiresTool)
        }))
      };
    });
  return {
    status: nextStage ? nextStage.status : "done",
    doneStageCount: doneCount,
    totalStageCount: workflow.length,
    incompleteStageCount: incompleteStages.length,
    incompleteStages,
    nextStage: nextStage ? {
      id: nextStage.id,
      order: nextStage.order,
      name: nextStage.name,
      ownerAgentId: nextStage.ownerAgentId,
      owner: nextStage.owner,
      status: nextStage.status,
      completedDeliverables: nextStage.completedDeliverables,
      deliverableCount: nextStage.deliverables.length,
      missingDeliverables,
      actionableMissingDeliverables: stageMissingDeliverables(nextStage).filter((item) => !item.requiresTool).map((item) => item.relativePath),
      toolMissingDeliverables: stageMissingDeliverables(nextStage).filter((item) => item.requiresTool).map((item) => item.relativePath),
      failedDeliverables: stageMissingDeliverables(nextStage).map((item) => ({
        relativePath: item.relativePath,
        reason: item.reason || "未完成",
        requiresTool: Boolean(item.requiresTool)
      }))
    } : null
  };
}

async function getProjectProgress(projectId) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const workflow = await Promise.all(filmWorkflowStages.map((stage) => getWorkflowStageState(projectPath, stage)));
  return {
    workflow,
    summary: summarizeProjectProgress(workflow)
  };
}

function projectMetaPath(projectId) {
  return path.join(projectsRoot, projectId, "_project_meta.json");
}

async function readProjectMeta(projectId) {
  return await readJsonIfExists(projectMetaPath(projectId)).catch(() => null);
}

async function writeProjectMeta(projectId, meta) {
  await writeJson(projectMetaPath(projectId), {
    ...meta,
    projectId,
    updatedAt: new Date().toISOString()
  });
}

async function projectBelongsToUser(projectId, user) {
  if (!user?.id) return false;
  const meta = await readProjectMeta(projectId);
  if (!meta?.ownerUserId) return normalizeEmail(user.email) === defaultOwnerEmail;
  return meta.ownerUserId === user.id;
}

async function requireProjectAccess(projectId, user) {
  const resolvedProjectId = await requireProjectDirectory(projectId);
  if (!(await projectBelongsToUser(resolvedProjectId, user))) {
    const error = new Error("Project is not available for this account.");
    error.status = 403;
    throw error;
  }
  return resolvedProjectId;
}

async function getProjectSummary(projectId) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const stat = await pathStats(projectPath);
  if (!stat?.isDirectory()) return null;
  const parsed = parseProjectFolderName(resolvedProjectId);

  const [brief, status, files, progress] = await Promise.all([
    readTextIfExists(path.join(projectPath, "00_admin", "PROJECT_BRIEF.md"), 1800),
    readTextIfExists(path.join(projectPath, "00_admin", "PROJECT_STATUS.md"), 1200),
    listProjectFiles(projectPath).catch(() => []),
    getProjectProgress(projectId).catch(() => null)
  ]);
  const latestMtime = files.reduce((latest, file) => {
    const value = fs.statSync(file).mtimeMs;
    return Math.max(latest, value);
  }, stat.mtimeMs);

  return {
    id: resolvedProjectId,
    path: projectPath,
    title: parsed.editableName || extractTitle(brief || status, resolvedProjectId),
    runIdPrefix: parsed.runIdPrefix,
    editableName: parsed.editableName,
    brief: truncate(brief || status, 1000),
    progress: progress?.summary || null,
    fileCount: files.length,
    updatedAt: new Date(latestMtime).toISOString()
  };
}

async function listProjects(user = null) {
  const entries = await fsp.readdir(projectsRoot, { withFileTypes: true }).catch(() => []);
  const ownedEntries = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isProjectDirectoryName(entry.name)) continue;
    if (user && !(await projectBelongsToUser(entry.name, user))) continue;
    ownedEntries.push(entry);
  }
  const summaries = await Promise.all(entries
    .filter((entry) => ownedEntries.some((owned) => owned.name === entry.name))
    .map((entry) => getProjectSummary(entry.name)));
  const uniqueById = new Map();
  for (const summary of summaries.filter(Boolean)) {
    const existing = uniqueById.get(summary.id);
    if (!existing || new Date(summary.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      uniqueById.set(summary.id, summary);
    }
  }

  return [...uniqueById.values()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function getActiveProjectId(explicitProjectId, user = null) {
  if (explicitProjectId) {
    const resolved = await resolveProjectId(explicitProjectId);
    if (user && !(await projectBelongsToUser(resolved, user))) return null;
    const candidate = await getProjectSummary(resolved);
    if (candidate) return candidate.id;
    return null;
  }
  if (process.env.FILM_ACTIVE_PROJECT) {
    const resolved = await resolveProjectId(process.env.FILM_ACTIVE_PROJECT);
    if (user && !(await projectBelongsToUser(resolved, user))) return null;
    const candidate = await getProjectSummary(resolved);
    if (candidate) return candidate.id;
  }
  const projects = await listProjects(user);
  return projects[0]?.id || null;
}

async function getProjectDocuments(projectId) {
  if (!projectId) return [];
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  return Promise.all(keyDocuments.map(async (doc) => {
    const filePath = resolveInside(projectPath, doc.relativePath);
    const stat = await pathStats(filePath);
    const text = stat ? await readTextIfExists(filePath, 900) : "";
    return {
      ...doc,
      folder: path.dirname(doc.relativePath),
      path: filePath,
      state: !stat ? "缺失" : stat.size === 0 ? "空文件" : "已连接",
      size: stat?.size || 0,
      updatedAt: stat?.mtime ? stat.mtime.toISOString() : null,
      excerpt: truncate(text, 600)
    };
  }));
}

async function getProjectWorkflowState(projectId) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  return Promise.all(filmWorkflowStages.map((stage) => getWorkflowStageState(projectPath, stage)));
}

async function getProjectFile(projectId, relativePath) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const filePath = resolveInside(projectPath, relativePath);
  const stat = await pathStats(filePath);
  if (!stat || !stat.isFile()) {
    const error = new Error("Project file not found.");
    error.status = 404;
    throw error;
  }
  const content = await readTextIfExists(filePath, 500_000);
  return {
    projectId: resolvedProjectId,
    name: path.basename(filePath),
    relativePath: path.relative(projectPath, filePath),
    path: filePath,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
    content,
    previewHtml: renderMarkdownPreview(content)
  };
}

async function saveProjectFile(projectId, relativePath, content) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const filePath = resolveInside(projectPath, relativePath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, normalizeText(content), "utf8");
  return getProjectFile(resolvedProjectId, relativePath);
}

async function getProjectAssets(projectId) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const assetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".mov", ".webm"]);
  const assets = [];

  async function walk(dirPath) {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!assetExtensions.has(ext)) continue;
      const stat = await pathStats(entryPath);
      const relativePath = path.relative(projectPath, entryPath);
      assets.push({
        name: entry.name,
        relativePath,
        path: entryPath,
        type: [".mp4", ".mov", ".webm"].includes(ext) ? "video" : "image",
        size: stat?.size || 0,
        updatedAt: stat?.mtime ? stat.mtime.toISOString() : null,
        url: `/api/film/projects/${encodeURIComponent(resolvedProjectId)}/assets/${relativePath.split(path.sep).map(encodeURIComponent).join("/")}`
      });
    }
  }

  await walk(projectPath);
  return assets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 80);
}

async function getAgentMemoryAndSkills() {
  return Promise.all(filmAgents.map(async (agent) => {
    const workspace = resolveAgentWorkspace(agent);
    const memoryPath = path.join(workspace, "memory");
    const skillsPath = path.join(workspace, "skills");
    const memoryEntries = await fsp.readdir(memoryPath, { withFileTypes: true }).catch(() => []);
    const skillEntries = await fsp.readdir(skillsPath, { withFileTypes: true }).catch(() => []);
    const topLevelMemory = await readTextIfExists(path.join(workspace, "MEMORY.md"), 2000);
    return {
      agentId: agent.id,
      name: agent.name,
      workspace,
      memoryPath,
      skillsPath,
      memoryCount: memoryEntries.filter((entry) => entry.isFile()).length + (topLevelMemory ? 1 : 0),
      skillCount: skillEntries.filter((entry) => entry.isDirectory() || entry.isFile()).length,
      memoryIndex: topLevelMemory || await readTextIfExists(path.join(memoryPath, "MEMORY.md"), 2000),
      skillNames: skillEntries.slice(0, 12).map((entry) => entry.name)
    };
  }));
}

async function getRecentRuns(limit = 20, projectId = "", user = null) {
  const resolvedProjectId = projectId ? await resolveProjectId(projectId) : "";
  const projectEntries = resolvedProjectId
    ? [{ name: resolvedProjectId, isDirectory: () => true }]
    : (await fsp.readdir(projectsRoot, { withFileTypes: true }).catch(() => []))
        .filter((entry) => entry.isDirectory() && isProjectDirectoryName(entry.name));
  const allowedProjectEntries = [];
  for (const projectEntry of projectEntries) {
    if (user && !(await projectBelongsToUser(projectEntry.name, user))) continue;
    allowedProjectEntries.push(projectEntry);
  }
  const runs = (await Promise.all(allowedProjectEntries.map(async (projectEntry) => {
    const runEntries = await fsp.readdir(projectRunsPath(projectEntry.name), { withFileTypes: true }).catch(() => []);
    return Promise.all(runEntries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const runPath = path.join(projectRunsPath(projectEntry.name), entry.name);
        const stat = await pathStats(runPath);
        const route = await readJsonIfExists(path.join(runPath, "ROUTE.json")).catch(() => null);
        const status = await readJsonIfExists(path.join(runPath, "STATUS.json")).catch(() => null);
        const children = await getRunChildren(entry.name);
        return {
          id: entry.name,
          path: runPath,
          createdAt: status?.createdAt || stat?.birthtime?.toISOString() || stat?.ctime?.toISOString() || null,
          updatedAt: status?.updatedAt || stat?.mtime?.toISOString() || null,
          status: status?.status || "done",
          currentStage: status?.currentStage || "archive",
          prompt: route?.prompt || "",
          projectId: route?.projectId || projectEntry.name,
          parentRunId: route?.parentRunId || status?.parentRunId || null,
          childRunCount: children.length,
          selectedAgents: route?.selectedAgents || []
        };
      }));
  }))).flat();

  return runs
    .filter((run) => !resolvedProjectId || run.projectId === resolvedProjectId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

async function findRunLocation(runId) {
  const projects = await fsp.readdir(projectsRoot, { withFileTypes: true }).catch(() => []);
  for (const projectEntry of projects) {
    if (!projectEntry.isDirectory() || !isProjectDirectoryName(projectEntry.name)) continue;
    const runPath = path.join(projectRunsPath(projectEntry.name), runId);
    const stat = await pathStats(runPath);
    if (stat?.isDirectory()) {
      return { projectId: projectEntry.name, runPath };
    }
  }
  const legacyRunPath = path.join(legacyRunsRoot, runId);
  const legacyStat = await pathStats(legacyRunPath);
  if (legacyStat?.isDirectory()) {
    return { projectId: "", runPath: legacyRunPath };
  }
  return null;
}

async function getRunChildren(runId) {
  const located = await findRunLocation(runId);
  if (!located) return [];
  const filePath = path.join(located.runPath, "CHILD_RUNS.json");
  const record = await readJsonIfExists(filePath).catch(() => null);
  return Array.isArray(record?.children) ? record.children : [];
}

function formatThreadRunLabel(runId) {
  return String(runId || "").slice(0, 19);
}

function prefixThreadEvents(events, runId) {
  return (events || []).map((event, index) => ({
    ...event,
    id: `${runId}:${event.id || index}`,
    runId,
    runLabel: formatThreadRunLabel(runId)
  }));
}

function compactThreadRun(run) {
  const statusValue = run.status?.status || run.status || "done";
  return {
    id: run.id,
    projectId: run.projectId || null,
    parentRunId: run.parentRunId || null,
    createdAt: run.createdAt || null,
    updatedAt: run.updatedAt || null,
    prompt: truncate(run.prompt || "", 360),
    status: statusValue,
    providerError: run.status?.providerError || run.providerError || null,
    resultText: truncate(run.resultText || "", 8000),
    selectedAgents: run.selectedAgents || [],
    events: prefixThreadEvents(run.events || run.status?.events || [], run.id)
  };
}

function threadFromParentRun(parentRun) {
  if (!parentRun) return [];
  if (Array.isArray(parentRun.thread) && parentRun.thread.length) return parentRun.thread;
  return [compactThreadRun(parentRun)];
}

function formatConversationForContext(thread, currentPrompt = "") {
  const priorTurns = (thread || []).slice(-4).map((item, index) => [
    `## 历史轮次 ${index + 1}`,
    `- Run: ${item.id || ""}`,
    item.parentRunId ? `- Parent: ${item.parentRunId}` : "",
    `- Status: ${item.status || "done"}`,
    item.selectedAgents?.length ? `- Agents: ${item.selectedAgents.join(", ")}` : "",
    item.providerError ? `- Error: ${item.providerError}` : "",
    "",
    "### 用户输入",
    truncate(item.prompt || "", 900),
    "",
    "### 总导演回复",
    item.resultText ? truncate(item.resultText, 1400) : "(本轮没有可用模型回复；仅保留状态和错误信息。)"
  ].filter(Boolean).join("\n"));

  return truncate([
    priorTurns.length ? "# 连续对话历史" : "",
    ...priorTurns,
    currentPrompt ? ["# 本轮用户输入", currentPrompt].join("\n") : ""
  ].filter(Boolean).join("\n\n"), conversationContextMaxChars);
}

function buildConversationArchiveRecord(runDetail) {
  const thread = Array.isArray(runDetail?.thread) && runDetail.thread.length
    ? runDetail.thread
    : runDetail ? [compactThreadRun(runDetail)] : [];
  const rootRunId = thread[0]?.id || runDetail?.id || "";
  const latest = thread[thread.length - 1] || null;
  return {
    id: rootRunId,
    rootRunId,
    latestRunId: latest?.id || null,
    projectId: latest?.projectId || runDetail?.projectId || null,
    updatedAt: latest?.updatedAt || new Date().toISOString(),
    turnCount: thread.length,
    turns: thread.map((item) => ({
      runId: item.id,
      parentRunId: item.parentRunId || null,
      projectId: item.projectId || null,
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
      status: item.status || "done",
      providerError: item.providerError || null,
      selectedAgents: item.selectedAgents || [],
      prompt: item.prompt || "",
      resultText: item.resultText || ""
    }))
  };
}

function conversationArchiveMarkdown(record) {
  return [
    `# Conversation ${record.rootRunId}`,
    "",
    `- Project: ${record.projectId || ""}`,
    `- Latest Run: ${record.latestRunId || ""}`,
    `- Updated: ${record.updatedAt || ""}`,
    `- Turns: ${record.turnCount || 0}`,
    "",
    ...record.turns.map((turn, index) => [
      `## Turn ${index + 1} · ${turn.runId}`,
      "",
      `- Parent: ${turn.parentRunId || "-"}`,
      `- Status: ${turn.status}`,
      turn.selectedAgents.length ? `- Agents: ${turn.selectedAgents.join(", ")}` : "",
      turn.providerError ? `- Error: ${turn.providerError}` : "",
      "",
      "### User",
      turn.prompt || "",
      "",
      "### Assistant",
      turn.resultText || "(empty)"
    ].filter(Boolean).join("\n"))
  ].filter(Boolean).join("\n\n");
}

async function writeConversationArchive(runDetail) {
  if (!runDetail?.projectId || !runDetail?.id) return null;
  const projectId = await requireProjectDirectory(runDetail.projectId);
  const record = buildConversationArchiveRecord({ ...runDetail, projectId });
  if (!record.rootRunId) return null;

  const conversationPath = resolveInside(path.join(projectsRoot, projectId), "_conversations");
  await fsp.mkdir(conversationPath, { recursive: true });
  const jsonPath = path.join(conversationPath, `${record.rootRunId}.json`);
  const markdownPath = path.join(conversationPath, `${record.rootRunId}.md`);
  await Promise.all([
    writeJson(jsonPath, record),
    fsp.writeFile(markdownPath, `${conversationArchiveMarkdown(record)}\n`, "utf8")
  ]);

  const located = await findRunLocation(runDetail.id);
  if (located?.runPath) {
    await Promise.all([
      writeJson(path.join(located.runPath, "THREAD.json"), record),
      fsp.writeFile(path.join(located.runPath, "THREAD.md"), `${conversationArchiveMarkdown(record)}\n`, "utf8")
    ]);
  }

  return {
    id: record.rootRunId,
    rootRunId: record.rootRunId,
    latestRunId: record.latestRunId,
    jsonPath,
    markdownPath
  };
}

async function buildAncestorThread(detail) {
  const chain = [];
  let cursor = detail;
  const seen = new Set();

  while (cursor?.id && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(compactThreadRun(cursor));
    if (!cursor.parentRunId) break;
    cursor = await getRunDetail(cursor.parentRunId, false).catch(() => null);
  }

  return chain;
}

async function findThreadRootId(detail) {
  const chain = await buildAncestorThread(detail);
  return chain[0]?.id || detail?.id || "";
}

async function buildRunThread(detail) {
  const ancestorThread = await buildAncestorThread(detail);
  const rootRunId = ancestorThread[0]?.id || detail?.id || "";
  const projectId = detail?.projectId || "";
  if (!rootRunId || !projectId) return ancestorThread;

  const runEntries = await fsp.readdir(projectRunsPath(projectId), { withFileTypes: true }).catch(() => []);
  const related = [];
  for (const entry of runEntries) {
    if (!entry.isDirectory()) continue;
    const candidate = await getRunDetail(entry.name, false).catch(() => null);
    if (!candidate?.id) continue;
    const candidateRootId = await findThreadRootId(candidate).catch(() => candidate.id);
    if (candidateRootId === rootRunId) related.push(compactThreadRun(candidate));
  }

  if (related.length <= ancestorThread.length) return ancestorThread;
  return related.sort((a, b) => {
    const aTime = a.createdAt || a.updatedAt || a.id || "";
    const bTime = b.createdAt || b.updatedAt || b.id || "";
    return String(aTime).localeCompare(String(bTime));
  });
}

function flattenThreadEvents(thread) {
  return thread.flatMap((item) => item.events || []);
}

async function appendChildRunIndex(parentRunId, child) {
  if (!parentRunId) return;
  const parent = await findRunLocation(parentRunId);
  if (!parent) return;

  const filePath = path.join(parent.runPath, "CHILD_RUNS.json");
  const existing = await readJsonIfExists(filePath).catch(() => null);
  const children = Array.isArray(existing?.children) ? existing.children : [];
  const next = [
    {
      runId: child.runId,
      projectId: child.projectId,
      parentRunId,
      prompt: child.prompt,
      createdAt: child.createdAt,
      selectedAgents: child.selectedAgents || []
    },
    ...children.filter((item) => item.runId !== child.runId)
  ];
  await fsp.writeFile(filePath, `${JSON.stringify({ parentRunId, children: next }, null, 2)}\n`, "utf8");
}

async function getRunDetail(runId, includeThread = true) {
  const located = await findRunLocation(runId);
  const runPath = located?.runPath || "";
  const stat = await pathStats(runPath);
  if (!stat) {
    const error = new Error("Run not found.");
    error.status = 404;
    throw error;
  }

  const route = await readJsonIfExists(path.join(runPath, "ROUTE.json")).catch(() => null);
  const status = await readJsonIfExists(path.join(runPath, "STATUS.json")).catch(() => null);
  const agentWork = await readJsonIfExists(path.join(runPath, "AGENT_WORK.json")).catch(() => null);
  const agentEvents = await readJsonIfExists(path.join(runPath, "AGENT_EVENTS.json")).catch(() => null);
  const children = await getRunChildren(runId);
  const taskText = await readTextIfExists(path.join(runPath, "TASK.md"), 6000);
  const storedResultText = await readTextIfExists(path.join(runPath, "RESULT.md"), 12000);
  const fileNames = runRecordFileNames;
  const files = (await Promise.all(fileNames.map(async (name) => {
    const filePath = path.join(runPath, name);
    const fileStat = await pathStats(filePath);
    if (!fileStat) return null;
      return {
        name,
        path: filePath,
        relativePath: path.relative(repoRoot, filePath),
        size: fileStat?.size || 0,
        updatedAt: fileStat?.mtime ? fileStat.mtime.toISOString() : null
    };
  }))).filter(Boolean);
  const selectedAgents = route?.selectedAgents || [];
  let synthesizedStatus = status || buildRunStatus({
    prompt: route?.prompt || extractPromptFromTask(taskText),
    projectId: located?.projectId || route?.projectId || null,
    route: route || { selectedAgents, reasons: [], mode: "history", stepBudget: 1 },
    provider: route?.provider || null,
    model: route?.model || null,
    rawId: route?.rawId || null,
    degraded: false,
    providerError: null,
    parentRunId: route?.parentRunId || null,
    agentEvents: Array.isArray(agentEvents?.events) ? agentEvents.events : []
  });
  if (!status) {
    const createdAt = route?.createdAt || stat.birthtime?.toISOString() || stat.ctime?.toISOString() || null;
    const updatedAt = stat.mtime?.toISOString() || createdAt;
    synthesizedStatus = { ...synthesizedStatus, createdAt, updatedAt };
  }
  const resultText = synthesizedStatus?.degraded ? "" : storedResultText;

  const detail = {
    id: runId,
    path: runPath,
    createdAt: synthesizedStatus.createdAt || stat.birthtime?.toISOString() || stat.ctime?.toISOString() || null,
    updatedAt: synthesizedStatus.updatedAt || stat.mtime?.toISOString() || null,
    status: synthesizedStatus,
    events: synthesizedStatus.events || [],
    agentWork: Array.isArray(agentWork?.agents) ? agentWork.agents : buildAgentWork(route || { selectedAgents, reasons: [] }),
    agentEvents: Array.isArray(agentEvents?.events) ? agentEvents.events : [],
    prompt: route?.prompt || extractPromptFromTask(taskText),
    projectId: route?.projectId || located?.projectId || null,
    parentRunId: route?.parentRunId || status?.parentRunId || null,
    provider: route?.provider || null,
    model: route?.model || null,
    route,
    selectedAgents,
    children,
    files,
    taskText,
    resultText
  };
  if (!includeThread) return detail;

  const thread = await buildRunThread(detail);
  return {
    ...detail,
    thread,
    threadEvents: flattenThreadEvents(thread)
  };
}

async function getRunDetailForUser(runId, user, includeThread = true) {
  const detail = await getRunDetail(runId, includeThread);
  if (user && !(await projectBelongsToUser(detail.projectId, user))) {
    const error = new Error("Run is not available for this account.");
    error.status = 403;
    throw error;
  }
  return detail;
}

function extractPromptFromTask(taskText) {
  const match = normalizeText(taskText).match(/## Prompt\s+([\s\S]*)$/);
  return match?.[1]?.trim() || "";
}

function makeEvent({ id, label, owner, status = "done", detail = "", files = [], startedAt, endedAt }) {
  return {
    id,
    label,
    owner,
    status,
    detail,
    files,
    startedAt: startedAt || new Date().toISOString(),
    endedAt: endedAt || new Date().toISOString()
  };
}

function workflowStageForAgent(agentId) {
  return filmWorkflowStages.find((stage) => stage.ownerAgentId === agentId) || null;
}

function eventHasError(event) {
  return ["error", "degraded"].includes(String(event?.status || "").toLowerCase());
}

function buildRunStatus({
  prompt,
  projectId,
  route,
  provider,
  model,
  rawId,
  degraded,
  providerError,
  parentRunId,
  agentEvents = []
}) {
  const now = new Date().toISOString();
  const selectedAgents = route?.selectedAgents || ["director"];
  const target = route?.targetStage ? `目标阶段：${route.targetStage.order}「${route.targetStage.name}」。` : "";
  const failedAgents = (agentEvents || []).filter(eventHasError);
  const events = [
    makeEvent({
      id: "intake",
      label: "需求确认",
      owner: "director",
      status: "done",
      detail: `收到项目需求，项目：${projectId || "未指定"}，需求长度 ${prompt.length} 字。`,
      files: ["TASK.md"],
      startedAt: now,
      endedAt: now
    }),
    makeEvent({
      id: "route",
      label: "派发任务",
      owner: "director",
      status: "done",
      detail: `路由模式 ${route?.mode || "single-orchestrator"}，派发给 ${selectedAgents.length} 个岗位：${selectedAgents.join(", ")}。${target}`,
      files: ["ROUTE.json", "AGENT_WORK.json"],
      startedAt: now,
      endedAt: now
    }),
    makeEvent({
      id: "director-model",
      label: "总导演判断",
      owner: "director",
      status: degraded ? "error" : "done",
      detail: degraded
        ? `总导演模型调用失败：${providerError || "unknown"}`
        : `总导演完成调度判断：${provider || "provider"} / ${model || "model"}。`,
      files: degraded ? ["STATUS.json"] : ["RESULT.md"],
      startedAt: now,
      endedAt: now
    }),
    ...(agentEvents || []),
    makeEvent({
      id: "review",
      label: "完成标准审查",
      owner: "director",
      status: degraded || failedAgents.length ? "error" : "done",
      detail: degraded
        ? "总导演模型失败，未进入岗位交付审查。"
        : failedAgents.length
          ? `有 ${failedAgents.length} 个岗位未通过执行检查：${failedAgents.map((event) => event.owner).join(", ")}。`
          : route?.mode === "project-audit-continuation" || route?.continuation
            ? "已检查本轮派发岗位的完成标准；项目整体仍以全项目文件审计和下一批未完成阶段为准，不声明全流程已完成。"
            : "已按本轮派发岗位的完成标准检查正式交付物和工具调用记录。",
      files: ["STATUS.json", "AGENT_EVENTS.json"],
      startedAt: now,
      endedAt: now
    }),
    makeEvent({
      id: "archive",
      label: "归档",
      owner: "director",
      status: "done",
      detail: "已写入 TASK.md、ROUTE.json、STATUS.json、AGENT_WORK.json、AGENT_EVENTS.json、RESULT.md 和 THREAD.md。",
      files: ["TASK.md", "ROUTE.json", "STATUS.json", "AGENT_WORK.json", "AGENT_EVENTS.json", "RESULT.md", "THREAD.md"],
      startedAt: now,
      endedAt: now
    })
  ];
  const hasError = degraded || events.some(eventHasError);

  return {
    status: hasError ? "error" : "done",
    currentStage: "archive",
    createdAt: now,
    updatedAt: now,
    provider,
    model,
    rawId,
    parentRunId: parentRunId || null,
    degraded: Boolean(degraded || failedAgents.length),
    providerError,
    stageCount: events.length,
    completedStageCount: events.filter((event) => event.status === "done").length,
    events
  };
}

function buildAgentWork(route = {}) {
  const selected = new Set(route.selectedAgents || ["director"]);
  selected.add("director");
  const reasonsByAgent = new Map((route.reasons || []).map((item) => [item.agentId, item.reason]));

  return [...selected].map((agentId) => {
    const agent = filmAgents.find((item) => item.id === agentId);
    const stage = workflowStageForAgent(agentId);
    return {
      agentId,
      name: agent?.name || agentId,
      status: "done",
      stages: agentStageMap[agentId] || ["handoff"],
      role: agent?.role || "影视公司岗位 Agent",
      workspace: agent?.workspaceName || "",
      instruction: reasonsByAgent.get(agentId) || (agentId === "director"
        ? "负责需求澄清、上下文组装、岗位路由、审查和归档。"
        : "按总导演路由要求完成本岗位标准交付。"),
      inputs: agent?.input || "项目上下文",
      deliverables: agentDeliverables[agentId] || [agent?.output || "岗位交付物"],
      completionStandard: stage?.completionStandard || "",
      tools: stage?.tools || []
    };
  });
}

function isContinuationPrompt(prompt) {
  const text = String(prompt || "").trim().toLowerCase();
  return /^(继续|继续做|继续执行|接着做|接着执行|下一步|往后做|向后执行|按流程继续|continue|go on)[\s。.!！?？]*$/.test(text)
    || /^(继续|接着|下一步).*(项目|流程|工作|执行|做|完成|补齐|接力)/.test(text)
    || /继续.*(完成|工作|流程|执行|补齐|接力|agent|Agent)/.test(text);
}

function isWorkflowAuditPrompt(prompt) {
  return /查看所有.*文件|所有文件|事实查看|查漏|缺漏|缺失|未完成|没有完成|补齐|补全|接力|流程进度|阶段.*完成|继续完成/.test(String(prompt || ""));
}

function stageAgentIds(stage) {
  if (!stage) return [];
  if (stage.id === "stage_1") return ["director", "art_designer"];
  return [stage.ownerAgentId].filter(Boolean);
}

function buildStageReason(stage, missingDeliverables) {
  const failed = stage.failedDeliverables || [];
  const detail = failed.length
    ? `；未完成项：${failed.map((item) => `${item.relativePath}${item.reason ? `（${item.reason}）` : ""}`).join("、")}`
    : missingDeliverables?.length
      ? `；缺少 ${missingDeliverables.join("、")}`
      : "";
  const toolOnly = failed.length && failed.every((item) => item.requiresTool);
  const toolNote = toolOnly ? "；该阶段主要缺少图片/视频生成产物，文字 Agent 需补齐可生成提示词并提醒调用生成工具" : "";
  return `总导演已审计项目文件。根据真实交付物状态，本轮应推进阶段 ${stage.order}「${stage.name}」${detail}${toolNote}。`;
}

function routePrompt(prompt, projectProgress = null) {
  const text = prompt.toLowerCase();
  const selected = new Set(["director"]);
  const reasons = [];
  const continuation = isContinuationPrompt(prompt);
  const add = (id, reason) => {
    const isNew = !selected.has(id);
    selected.add(id);
    if (isNew || !reasons.some((item) => item.agentId === id)) reasons.push({ agentId: id, reason });
  };

  const nextStage = projectProgress?.summary?.nextStage || null;
  const auditPrompt = isWorkflowAuditPrompt(prompt);
  if ((continuation || auditPrompt) && Array.isArray(projectProgress?.summary?.incompleteStages) && projectProgress.summary.incompleteStages.length) {
    const incompleteStages = projectProgress.summary.incompleteStages;
    const actionableStages = incompleteStages.filter((stage) => (stage.actionableMissingDeliverables || []).length);
    const selectedStages = (actionableStages.length ? actionableStages : incompleteStages).slice(0, agentBatchSize);
    selectedStages.forEach((stage) => {
      const stageReason = buildStageReason(stage, stage.missingDeliverables);
      stageAgentIds(stage).forEach((agentId) => add(agentId, stageReason));
    });
    return {
      mode: auditPrompt ? "project-audit-continuation" : "project-continuation",
      stepBudget: selected.size,
      selectedAgents: [...selected],
      reasons,
      continuation: true,
      executeDirectorAgent: selectedStages.some((stage) => stage.ownerAgentId === "director"),
      targetStage: selectedStages[0] || nextStage,
      targetStages: selectedStages
    };
  }

  if (/故事|世界观|大纲|主题|人物动机|情绪弧线|小说/.test(prompt)) {
    add("story_novelist", "需要故事原型、人物动机或世界观。");
  }
  if (/剧本|对白|台词|beat|节拍|脚本/.test(text) || /编剧|对白|台词|剧本/.test(prompt)) {
    add("screenwriter", "需要剧本、对白或节拍表。");
  }
  if (/角色|选角|造型|人物|识别锚点|参考图/.test(prompt)) {
    add("casting", "需要角色设定、识别锚点和造型稳定性。");
  }
  if (/分镜|镜头|shot|storyboard|节奏/.test(text) || /分镜|镜头|节奏/.test(prompt)) {
    add("storyboard", "需要镜头级叙事和分镜表。");
  }
  if (/场景|布景|空间|灯光|穿帮|美术/.test(prompt)) {
    add("scene", "需要场景、空间连续性和灯光方案。");
  }
  if (/视觉|风格|色彩|参考|质感|美术风格/.test(prompt)) {
    add("art_designer", "需要统一视觉风格、色彩和参考方向。");
  }
  if (/关键帧|keyframe|seedream|画面|定格/.test(text) || /关键帧|画面|定格/.test(prompt)) {
    add("keyframe", "需要关键帧计划和生成提示词。");
  }
  if (/摄影|运镜|焦段|镜头语言|机位|视频生成/.test(prompt)) {
    add("cinematographer", "需要摄影语言、运镜和焦段决策。");
  }
  if (/多\s*agent|全流程|所有阶段|逐个调用|各个\s*agent|正式项目文件|接力执行|完整接力/.test(text) || /多\s*Agent|全流程|所有阶段|逐个调用|各个\s*Agent|正式项目文件|接力执行|完整接力/.test(prompt)) {
    [
      ["story_novelist", "全流程接力需要故事大纲和世界观先行。"],
      ["screenwriter", "全流程接力需要把故事转成正式剧本。"],
      ["casting", "全流程接力需要角色定义和参考图目录。"],
      ["art_designer", "全流程接力需要视觉顶层和色彩标准。"],
      ["storyboard", "全流程接力需要 STORYBOARD_MASTER 与 SHOTLIST.csv。"],
      ["scene", "全流程接力需要场景圣经、灯光和连续性。"],
      ["keyframe", "全流程接力需要关键帧计划和生成提示。"],
      ["cinematographer", "全流程接力需要镜头语言、运镜和视频生成方案。"]
    ].forEach(([id, reason]) => add(id, reason));
  }

  if (selected.size === 1) {
    if (nextStage) {
      const stageReason = buildStageReason(nextStage, nextStage.missingDeliverables);
      stageAgentIds(nextStage).forEach((agentId) => add(agentId, stageReason));
    } else {
      add("story_novelist", "默认先补齐故事层上下文。");
      add("screenwriter", "默认给出可进入剧本阶段的首轮交付。");
    }
  }

  return {
    mode: selected.size > 4 ? "orchestrator-workers" : "single-orchestrator",
    stepBudget: selected.size,
    selectedAgents: [...selected],
    reasons,
    continuation,
    executeDirectorAgent: Boolean(nextStage && nextStage.ownerAgentId === "director" && selected.has("director")),
    targetStage: continuation ? nextStage : null
  };
}

async function buildTaskContext({ prompt, route, projectId, parentRun = null, projectProgress = null, user = null }) {
  const [agents, project, documents, teamWorkflow, teamRules, projectTemplate] = await Promise.all([
    getAgentSummaries(true, user),
    projectId ? getProjectSummary(projectId) : null,
    projectId ? getProjectDocuments(projectId) : [],
    readTextIfExists(path.join(filmWorkspacePath, "TEAM_WORKFLOW.md"), 2500),
    readTextIfExists(path.join(filmWorkspacePath, "TEAM_RULES.md"), 2200),
    readTextIfExists(path.join(filmWorkspacePath, "PROJECT_LIBRARY_TEMPLATE.md"), 2200)
  ]);
  const selectedAgents = agents.filter((agent) => route.selectedAgents.includes(agent.id));
  const docContext = documents
    .filter((doc) => doc.state === "已连接" && doc.excerpt)
    .slice(0, 5)
    .map((doc) => `## ${doc.relativePath}\n${doc.excerpt}`)
    .join("\n\n");
  const agentContext = selectedAgents
    .map((agent) => `## ${agent.name} (${agent.id})\n${truncate(agent.contextPreview || "", 900)}`)
    .join("\n\n");
  const conversationThread = threadFromParentRun(parentRun);
  const conversationText = formatConversationForContext(conversationThread, prompt);
  const workflowAudit = formatWorkflowAuditForContext(projectProgress);

  return {
    prompt,
    project,
    documents,
    agents: selectedAgents,
    conversationThread,
    conversationText,
    text: truncate([
      `# 当前用户任务\n${prompt}`,
      project && `# 当前项目\n${project.id}\n${project.brief}`,
      projectProgress?.summary && `# 项目执行进度\n${JSON.stringify(projectProgress.summary, null, 2)}`,
      workflowAudit && `# 全项目文件审计\n${workflowAudit}`,
      conversationText,
      teamRules && `# 团队规则\n${teamRules}`,
      teamWorkflow && `# 团队流程\n${teamWorkflow}`,
      projectTemplate && `# 项目资料库模板\n${projectTemplate}`,
      parentRun && `# 父 run\n${parentRun.id}\n${truncate(parentRun.resultText || parentRun.prompt || "", 1400)}`,
      docContext && `# 当前项目关键文档摘录\n${docContext}`,
      agentContext && `# 被路由 Agent 工作区上下文\n${agentContext}`
    ].filter(Boolean).join("\n\n"), taskContextMaxChars)
  };
}

function formatWorkflowAuditForContext(projectProgress) {
  const workflow = Array.isArray(projectProgress?.workflow) ? projectProgress.workflow : [];
  if (!workflow.length) return "";
  const lines = [];
  for (const stage of workflow) {
    lines.push(`## 阶段 ${stage.order} ${stage.name} / ${stage.owner} / ${stage.status}`);
    for (const item of stage.deliverableState || []) {
      const mark = item.exists ? "OK" : "MISSING";
      const details = [
        item.reason,
        item.requiresTool ? "requires_tool" : "",
        item.textLength ? `text=${item.textLength}` : "",
        item.substantiveItemCount ? `items=${item.substantiveItemCount}` : ""
      ].filter(Boolean).join("；");
      lines.push(`- ${mark} ${item.relativePath}${details ? `：${details}` : ""}`);
    }
  }
  return truncate(lines.join("\n"), 7000);
}

function extractText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  if (typeof payload?.text === "string") return payload.text;
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const pieces = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") pieces.push(part.text);
      if (typeof part?.content === "string") pieces.push(part.content);
    }
  }
  return pieces.join("\n").trim();
}

function extractAnthropicText(payload) {
  const content = Array.isArray(payload?.content) ? payload.content : [];
  return content.map((part) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("\n").trim();
}

function modelEndpoint(config, wireApi = config.wireApi) {
  if (wireApi === "chat") return `${config.baseUrl}/chat/completions`;
  if (wireApi === "anthropic") {
    if (config.baseUrl.endsWith("/messages")) return config.baseUrl;
    if (config.baseUrl.endsWith("/v1")) return `${config.baseUrl}/messages`;
    return `${config.baseUrl}/v1/messages`;
  }
  return `${config.baseUrl}/responses`;
}

function modelHeaders(config, wireApi = config.wireApi) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (wireApi === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
  }
  if (config.authScheme === "x-api-key") {
    headers["x-api-key"] = config.apiKey;
  } else if (config.authScheme !== "none") {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  return headers;
}

function modelRequestBody(config, { system, user, wireApi = config.wireApi, jsonMode = false, omitReasoning = false, omitStore = false }) {
  if (wireApi === "chat") {
    const body = {
      model: config.model,
      max_tokens: modelMaxOutputTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    };
    if (jsonMode) body.response_format = { type: "json_object" };
    return body;
  }
  if (wireApi === "anthropic") {
    return {
      model: config.model,
      system,
      max_tokens: modelMaxOutputTokens,
      messages: [
        { role: "user", content: user }
      ]
    };
  }
  const body = {
    model: config.model,
    input: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };
  body.max_output_tokens = modelMaxOutputTokens;
  if (!omitReasoning && config.reasoningEffort) body.reasoning = { effort: config.reasoningEffort };
  if (!omitStore) body.store = !config.disableResponseStorage;
  return body;
}

function providerErrorMessage(payload, fallback = "Provider returned an error.") {
  const message = payload?.error?.message || payload?.message || payload?.error || payload?.detail || fallback;
  return typeof message === "string" ? message : JSON.stringify(message);
}

function safeEndpointForLog(endpoint) {
  try {
    const url = new URL(endpoint);
    return `${url.origin}${url.pathname}`;
  } catch {
    return endpoint;
  }
}

function attachSafeModelError(error, config, endpoint, wireApi) {
  error.config = {
    provider: config.provider,
    model: config.model,
    wireApi
  };
  error.endpoint = endpoint;
  return error;
}

function isTransientModelError(error) {
  const status = Number(error?.status || 0);
  if ([408, 409, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 529, 530].includes(status)) return true;
  const message = `${error?.name || ""} ${error?.message || ""}`;
  return /timeout|aborted|fetch failed|network|socket|terminated|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR/i.test(message);
}

function shouldRetryModelAttempt(error) {
  const status = Number(error?.status || 0);
  if ([401, 403].includes(status)) return false;
  if (isTransientModelError(error)) return false;
  if ([400, 404, 405, 415, 422].includes(status)) return true;
  const message = String(error?.message || "");
  return /reasoning|response_format|store|responses|chat\/completions|not found|unsupported|invalid/i.test(message);
}

function shouldFailoverModelProfile(error) {
  if (!modelProfileFailoverEnabled) return false;
  const status = Number(error?.status || 0);
  if ([401, 403].includes(status)) return false;
  if (isTransientModelError(error)) return true;
  return [400, 404, 405, 415, 422, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 529, 530].includes(status);
}

async function requestAiModel({ config, system, user, wireApi = config.wireApi, jsonMode = false, omitReasoning = false, omitStore = false }) {
  const endpoint = modelEndpoint(config, wireApi);
  const body = modelRequestBody(config, { system, user, wireApi, jsonMode, omitReasoning, omitStore });
  const headers = modelHeaders(config, wireApi);
  const startedAt = Date.now();
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(modelRequestTimeoutMs)
    });
  } catch (error) {
    const caught = attachSafeModelError(error instanceof Error ? error : new Error(String(error)), config, endpoint, wireApi);
    console.warn("[model] request failed", {
      provider: config.provider,
      model: config.model,
      wireApi,
      endpoint: safeEndpointForLog(endpoint),
      timeoutMs: modelRequestTimeoutMs,
      elapsedMs: Date.now() - startedAt,
      systemChars: String(system || "").length,
      userChars: String(user || "").length,
      error: caught.message
    });
    throw caught;
  }

  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${providerErrorMessage(payload)}`);
    error.status = response.status;
    error.payload = payload;
    attachSafeModelError(error, config, endpoint, wireApi);
    console.warn("[model] provider rejected request", {
      provider: config.provider,
      model: config.model,
      wireApi,
      endpoint: safeEndpointForLog(endpoint),
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      systemChars: String(system || "").length,
      userChars: String(user || "").length,
      error: error.message
    });
    throw error;
  }

  const text = wireApi === "chat"
    ? payload?.choices?.[0]?.message?.content || ""
    : wireApi === "anthropic"
      ? extractAnthropicText(payload)
      : extractText(payload);

  if (!String(text || "").trim()) {
    const error = new Error("Provider returned an empty text response.");
    error.status = 502;
    error.payload = payload;
    attachSafeModelError(error, config, endpoint, wireApi);
    console.warn("[model] empty response", {
      provider: config.provider,
      model: config.model,
      wireApi,
      endpoint: safeEndpointForLog(endpoint),
      elapsedMs: Date.now() - startedAt
    });
    throw error;
  }

  console.info("[model] request ok", {
    provider: config.provider,
    model: config.model,
    wireApi,
    endpoint: safeEndpointForLog(endpoint),
    elapsedMs: Date.now() - startedAt,
    outputChars: String(text || "").length
  });

  return {
    config: { ...config, wireApi },
    text,
    rawId: payload?.id || null
  };
}

function buildModelAttempts(config, expectJson = false) {
  const attempts = [];
  const push = (attempt) => {
    const key = JSON.stringify(attempt);
    if (!attempts.some((item) => JSON.stringify(item) === key)) attempts.push(attempt);
  };

  push({ wireApi: config.wireApi, jsonMode: expectJson, omitReasoning: false, omitStore: false });
  if (config.wireApi === "chat" && expectJson) {
    push({ wireApi: "chat", jsonMode: false, omitReasoning: false, omitStore: false });
  }
  if (config.wireApi === "responses") {
    push({ wireApi: "responses", jsonMode: false, omitReasoning: true, omitStore: false });
    push({ wireApi: "responses", jsonMode: false, omitReasoning: true, omitStore: true });
    push({ wireApi: "chat", jsonMode: expectJson, omitReasoning: false, omitStore: false });
    if (expectJson) push({ wireApi: "chat", jsonMode: false, omitReasoning: false, omitStore: false });
  }
  return attempts;
}

async function callAiModel({ system, user, account = null, expectJson = false }) {
  const configs = getCallableAiConfigs(account);
  let lastError = null;
  for (const config of configs) {
    if (!config.apiKey && config.authScheme !== "none") {
      const error = new Error("OPENAI_API_KEY is not configured on the backend.");
      error.code = "NO_API_KEY";
      error.config = {
        provider: config.provider,
        model: config.model,
        wireApi: config.wireApi
      };
      lastError = error;
      break;
    }

    for (const attempt of buildModelAttempts(config, expectJson)) {
      try {
        return await requestAiModel({ config, system, user, ...attempt });
      } catch (error) {
        lastError = error;
        if (!shouldRetryModelAttempt(error)) break;
      }
    }

    if (!shouldFailoverModelProfile(lastError)) {
      break;
    }
    console.warn("[model] trying fallback profile", {
      failedProvider: lastError?.config?.provider || config.provider,
      failedModel: lastError?.config?.model || config.model,
      error: lastError?.message || "unknown"
    });
  }

  if (lastError) {
    if (!lastError.config) {
      const active = configs[0] || getAiConfig(account);
      lastError.config = {
        provider: active.provider,
        model: active.model,
        wireApi: active.wireApi
      };
    }
  }

  throw lastError || new Error("Provider returned an unknown error.");
}

function buildSystemPrompt() {
  return [
    "你是 Film Studio 的后端总导演调度器。",
    "你的任务不是闲聊，而是把用户输入推进成可执行的影视公司多 Agent 工作流。",
    "架构约束：采用统一 Agent 循环：组装上下文 -> 路由 Agent -> 生成首轮交付 -> 校验输出 -> 持久化 run 记录。",
    "Harness 约束：本次 Web 请求只有 1 个执行步预算；不要声称已修改正式项目文件，除非上下文明确列出后端已写入的文件。",
    "团队约束：尊重 SOUL.md、AGENTS.md、TOOLS.md、TEAM_RULES.md 的岗位隔离、双通道同步和项目真相源规则。",
    "输出使用中文 Markdown，必须包含这些标题：总导演判断、需求八要素、Agent 路由、首轮交付物、已执行后端动作、下一步。",
    "Agent 路由中要说明每个被选 Agent 的输入、输出和接力关系。",
    "已执行后端动作只能写：读取工作区上下文、调用模型、写入 run 记录。不要编造正式项目文档已经更新。"
  ].join("\n");
}

function createRunId() {
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeTimestamp}-${cryptoRandom(6)}`;
}

function formatRunSection({ runId, agent, prompt, summary, source = "agent_model" }) {
  return [
    "",
    `## Agent 正式交付记录 ${new Date().toISOString()}`,
    "",
    `- Run: ${runId}`,
    `- Agent: ${agent.name}`,
    `- Source: ${source}`,
    `- 输入摘要：${truncate(prompt, 260).replace(/\n/g, " ")}`,
    "",
    summary
  ].join("\n");
}

function stripMarkdownCodeFence(text) {
  const value = normalizeText(text).trim();
  const match = value.match(/^```(?:json|csv|markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : value;
}

function extractJsonObject(text) {
  const value = normalizeText(text).trim();
  const candidates = [];
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  candidates.push(value);
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(value.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue with the next extraction strategy.
    }
  }
  return null;
}

function normalizeRelativeProjectPath(relativePath) {
  const value = String(relativePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!value || path.isAbsolute(value) || value.split("/").some((part) => part === "..")) {
    return "";
  }
  return path.posix.normalize(value).replace(/^\/+/, "");
}

function mapRequestedPathToAllowed(agentId, requestedPath) {
  const normalized = normalizeRelativeProjectPath(requestedPath);
  if (!normalized) return "";
  const { files, directories } = getAllowedAgentPaths(agentId);
  if (files.includes(normalized)) return normalized;
  if (directories.some((dir) => normalized.startsWith(dir))) return normalized;

  const requestedBaseName = path.posix.basename(normalized).toLowerCase();
  const byBasename = files.find((item) => path.posix.basename(item).toLowerCase() === requestedBaseName);
  if (byBasename) return byBasename;

  const suffixMatch = files.find((item) => normalized.endsWith(item));
  if (suffixMatch) return suffixMatch;

  return "";
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getWritableDeliverables(agentId) {
  return uniqueValues((agentDeliverables[agentId] || []).filter((item) => !item.endsWith("/")));
}

function getDirectoryDeliverables(agentId) {
  return uniqueValues((agentDeliverables[agentId] || []).filter((item) => item.endsWith("/")));
}

function getAllowedAgentPaths(agentId) {
  const extrasByAgent = {
    story_novelist: ["01_story/STORY_NOTES.md"],
    screenwriter: ["03_script/DIALOGUE_NOTES.md"],
    casting: ["02_characters/RELATIONSHIP_MAP.md"],
    storyboard: ["04_storyboard/RHYTHM_NOTES.md"],
    scene: ["06_scene/LOCATION_OR_SET_NOTES.md"],
    art_designer: ["05_visual/REFERENCE_BOARD.md"],
    keyframe: ["07_keyframes/KEYFRAME_FILE_STRUCTURE.md"],
    cinematographer: []
  };
  return {
    files: uniqueValues([...getWritableDeliverables(agentId), ...(extrasByAgent[agentId] || [])]),
    directories: getDirectoryDeliverables(agentId)
  };
}

function resolveAgentOutputPath(agentId, requestedPath) {
  return mapRequestedPathToAllowed(agentId, requestedPath);
}

function normalizeAgentFilePlan({ agent, runId, prompt, reason, directorText, rawText }) {
  const parsed = extractJsonObject(rawText);
  const writable = getWritableDeliverables(agent.id);
  const rawFiles = Array.isArray(parsed?.files)
    ? parsed.files
    : Array.isArray(parsed?.deliverables)
      ? parsed.deliverables
      : parsed?.file
        ? [parsed.file]
        : [];
  const summary = truncate(
    parsed?.summary || parsed?.handoffSummary || parsed?.notes || stripMarkdownCodeFence(rawText),
    1800
  );
  const files = [];
  const used = new Set();

  for (const [index, rawFile] of rawFiles.entries()) {
    const requestedPath = typeof rawFile === "string" ? rawFile : rawFile?.path || rawFile?.relativePath;
    const relativePath = resolveAgentOutputPath(agent.id, requestedPath);
    if (!relativePath || used.has(relativePath)) continue;
    used.add(relativePath);
    files.push({
      path: relativePath,
      mode: rawFile?.mode === "append" ? "append" : "replace",
      content: stripMarkdownCodeFence(rawFile?.content || rawFile?.body || summary)
    });
  }

  // Extract image_generation_requests from agent output for post-processing
  const imageGenerationRequests = Array.isArray(parsed?.image_generation_requests)
    ? parsed.image_generation_requests.filter((req) => req && typeof req === "object" && req.prompt)
    : [];

  return {
    parsed: Boolean(parsed),
    summary,
    files,
    imageGenerationRequests
  };
}

function buildAgentSystemPrompt(agent, deliverables) {
  const writable = deliverables.filter((item) => !item.endsWith("/"));
  const directories = deliverables.filter((item) => item.endsWith("/"));
  const stage = workflowStageForAgent(agent.id);
  const hasImageTools = stage?.tools?.some((t) => /seedream|dreamina|image/i.test(t));
  return [
    `你是 Film Studio 的岗位 Agent：${agent.name}。`,
    `职责：${agent.role}`,
    `输入：${agent.input}`,
    `标准输出：${agent.output}`,
    stage ? `当前阶段：阶段 ${stage.order}「${stage.name}」` : "",
    stage ? `完成标准：${stage.completionStandard}` : "",
    stage?.tools?.length ? `本阶段允许/需要记录的工具：${stage.tools.join(", ")}` : "",
    "你本轮只负责本岗位正式交付，不负责总导演路由，也不替其他岗位审稿。",
    "必须输出一个 JSON 对象，不要输出 Markdown 代码围栏，不要输出解释性前后缀。",
    "JSON schema：",
    hasImageTools
      ? '{"summary":"本岗位本轮完成内容摘要","files":[{"path":"项目内相对路径","mode":"replace","content":"完整正文"}],"image_generation_requests":[{"prompt":"图片生成提示词（中文，详细描述角色外观、服装、姿态、背景、风格）","action":"text2image","type":"image","relativePath":"可选，参考图路径"}],"notes":["可选注意事项"]}'
      : '{"summary":"本岗位本轮完成内容摘要","files":[{"path":"项目内相对路径","mode":"replace","content":"可直接写入该正式项目文件的完整正文"}],"notes":["可选注意事项"]}',
    hasImageTools
      ? "重要：image_generation_requests 是你直接触发图片生成的唯一方式。后端会自动调用 Dreamina/Seedream CLI 执行生成并保存图片。每个角色或关键帧必须提供一条独立的 image_generation_requests 条目，prompt 必须是完整的、可直接用于生图的中文描述（包含角色外观、服装、体态、表情、背景、风格、画幅等），不要只写角色名或抽象描述。如果有参考图可用，在 relativePath 中指定参考图的项目相对路径。"
      : "",
    `files.path 只能使用这些正式文件：${writable.join(", ") || "无"}`,
    directories.length ? `目录型交付物由后端建版本记录，可在 notes 中给出素材生成要求：${directories.join(", ")}` : "",
    "mode 默认使用 replace，表示把该正式文件更新为当前最新版本；只有 CHANGELOG、MEETING_NOTES、日志类文件才使用 append。",
    "content 必须是可直接进入项目资料库的中文正式内容；不要写占位提示，不要只写行动建议。",
    "content 必须按该文件职责给出稳定结构：标题、输入依据、正式结论、执行标准/验收项、工具调用或后续接力。",
    "如果写 SHOTLIST.csv，content 必须是 CSV 内容，字段至少包含 shot_id,scene,景别,画面,方位,关键帧,状态,source_run。",
    "如果写图片或视频生成相关文件，要明确工具、提示词、父版本、版本链和验收标准。"
  ].filter(Boolean).join("\n");
}

function buildAgentUserPrompt({ runId, projectId, agent, prompt, reason, context, directorText, upstreamNotes }) {
  const deliverables = agentDeliverables[agent.id] || [];
  const documentLines = (context.documents || [])
    .filter((doc) => doc.state === "已连接" && doc.excerpt)
    .slice(0, 6)
    .map((doc) => `## ${doc.relativePath}\n${doc.excerpt}`)
    .join("\n\n");

  return [
    `# Run\n- runId: ${runId}\n- projectId: ${projectId}\n- agentId: ${agent.id}\n- agentName: ${agent.name}`,
    `# 用户需求\n${prompt}`,
    `# 总导演路由原因\n${reason || "按项目阶段需要进入本岗位。"}`,
    `# 总导演审核与调度意见\n${truncate(directorText || "", 2000)}`,
    context.conversationText ? `# 连续对话记录\n${truncate(context.conversationText, 3500)}` : "",
    upstreamNotes.length ? `# 上游岗位接力摘要\n${upstreamNotes.join("\n\n")}` : "",
    `# 项目资料库关键摘录\n${documentLines || "当前没有可读取的正式项目文件摘录。"}`,
    `# 岗位工作区规则摘录\n${truncate(agent.contextPreview || "", 1600)}`,
    `# 标准项目模板和团队上下文\n${truncate(context.text || "", 4200)}`,
    `# 本岗位交付物白名单\n${deliverables.map((item) => `- ${item}`).join("\n")}`,
    "# 输出要求\n只返回 JSON。files 至少覆盖所有非目录型交付物；目录型交付物在 notes 中给出需要生成或整理的素材版本要求。每个 file 使用 mode=replace，content 是完整正式文件正文。"
  ].filter(Boolean).join("\n\n");
}

async function appendProjectFile(projectId, relativePath, content) {
  const resolvedProjectId = await requireProjectDirectory(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const filePath = resolveInside(projectPath, relativePath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readTextIfExists(filePath, 500_000);
  const prefix = existing ? "" : `# ${path.basename(relativePath)}\n`;
  await fsp.appendFile(filePath, `${prefix}${content}\n`, "utf8");
  return path.relative(projectPath, filePath);
}

async function replaceProjectFile(projectId, relativePath, content) {
  const resolvedProjectId = await requireProjectDirectory(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const filePath = resolveInside(projectPath, relativePath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const body = normalizeText(content).trim();
  const finalContent = body.startsWith("#") || relativePath.endsWith(".csv")
    ? body
    : `# ${path.basename(relativePath)}\n\n${body}`;
  await fsp.writeFile(filePath, `${finalContent}\n`, "utf8");
  return path.relative(projectPath, filePath);
}

async function writeDirectoryHandoff(projectId, relativePath, runId, agent, prompt, details = "") {
  if (!normalizeText(details).trim()) return null;
  const resolvedProjectId = await requireProjectDirectory(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const dirPath = resolveInside(projectPath, relativePath);
  await fsp.mkdir(dirPath, { recursive: true });
  const fileName = `${runId}_${agent.id}_handoff.md`;
  const content = [
    `# ${agent.name}素材接力记录`,
    "",
    `- Run: ${runId}`,
    `- Agent: ${agent.name}`,
    `- 创建时间：${new Date().toISOString()}`,
    `- 原始需求：${prompt}`,
    "",
    "## 素材生成要求",
    "",
    details
  ].join("\n");
  await fsp.writeFile(path.join(dirPath, fileName), `${content}\n`, "utf8");
  return path.relative(projectPath, path.join(dirPath, fileName));
}

async function ensureShotlistCsv(projectId, runId, prompt, content = "", mode = "append") {
  const resolvedProjectId = await requireProjectDirectory(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const filePath = resolveInside(projectPath, "04_storyboard/SHOTLIST.csv");
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const csvContent = stripMarkdownCodeFence(content);
  if (mode === "replace" && csvContent) {
    const hasHeader = /^shot_id\s*,/i.test(csvContent.trim());
    await fsp.writeFile(filePath, `${hasHeader ? csvContent.trim() : `shot_id,scene,景别,画面,方位,关键帧,状态,source_run\n${csvContent.trim()}`}\n`, "utf8");
    return path.relative(projectPath, filePath);
  }
  const exists = await pathStats(filePath);
  if (!exists || exists.size === 0) {
    await fsp.writeFile(filePath, "shot_id,scene,景别,画面,方位,关键帧,状态,source_run\n", "utf8");
  }
  if (csvContent) {
    const existing = await readTextIfExists(filePath, 500_000);
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^shot_id\s*,/i.test(line) || !existing.includes("shot_id,"));
    if (lines.length) {
      await fsp.appendFile(filePath, `${lines.join("\n")}\n`, "utf8");
    }
    return path.relative(projectPath, filePath);
  }
  return null;
}

async function ensureAssetManifest(projectId) {
  const resolvedProjectId = await requireProjectDirectory(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const manifestPath = resolveInside(projectPath, "09_assets/asset_manifest.md");
  await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
  const existing = await readTextIfExists(manifestPath, 500_000);
  if (!existing) {
    const header = [
      "# asset_manifest",
      "",
      "| 时间 | 类型 | 动作 | 文件 | 父版本 | 状态 | 工具 | 说明 |",
      "|---|---|---|---|---|---|---|---|"
    ].join("\n");
    await fsp.writeFile(manifestPath, `${header}\n`, "utf8");
  } else if (!existing.includes("| 时间 | 类型 | 动作 | 文件 | 父版本 | 状态 | 工具 | 说明 |")) {
    await fsp.appendFile(manifestPath, "\n| 时间 | 类型 | 动作 | 文件 | 父版本 | 状态 | 工具 | 说明 |\n|---|---|---|---|---|---|---|---|\n", "utf8");
  }
  return manifestPath;
}

async function appendAssetManifest(projectId, record) {
  const resolvedProjectId = await requireProjectDirectory(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const manifestPath = await ensureAssetManifest(resolvedProjectId);
  const row = [
    new Date().toISOString(),
    record.type,
    record.action,
    record.relativePath,
    record.parentRelativePath || "-",
    record.status,
    record.tool,
    String(record.prompt || "").replace(/\|/g, "/").replace(/\r?\n/g, " ").slice(0, 160)
  ];
  await fsp.appendFile(manifestPath, `| ${row.join(" | ")} |\n`, "utf8");
  return path.relative(projectPath, manifestPath);
}

async function writeAgentPlannedFile({ projectId, runId, agent, prompt, filePlan, source }) {
  const relativePath = normalizeRelativeProjectPath(filePlan.path);
  const content = normalizeText(filePlan.content || "").trim();
  const mode = filePlan.mode === "append" ? "append" : "replace";
  if (!relativePath) return null;
  if (!content) return null;

  if (relativePath.endsWith("/")) {
    return writeDirectoryHandoff(projectId, relativePath, runId, agent, prompt, content);
  }
  if (relativePath === "04_storyboard/SHOTLIST.csv") {
    return ensureShotlistCsv(projectId, runId, prompt, content, mode);
  }
  if (relativePath === "09_assets/asset_manifest.md") {
    return appendAssetManifest(projectId, {
      type: "production",
      action: "agent_handoff",
      relativePath,
      parentRelativePath: "",
      status: "planned",
      tool: agent.id === "cinematographer" ? "dreamina_video_generate" : "dreamina_image_generate",
      prompt: content
    });
  }

  if (mode === "replace") {
    return replaceProjectFile(projectId, relativePath, content);
  }

  return appendProjectFile(projectId, relativePath, formatRunSection({
    runId,
    agent,
    prompt,
    summary: content,
    source
  }));
}

async function runAgentModel({ runId, projectId, agent, prompt, reason, context, directorText, upstreamNotes, account = null }) {
  const deliverables = agentDeliverables[agent.id] || [];
  const system = buildAgentSystemPrompt(agent, deliverables);
  const baseUser = buildAgentUserPrompt({ runId, projectId, agent, prompt, reason, context, directorText, upstreamNotes });
  let ai = await callAiModel({
    system,
    user: baseUser,
    account,
    expectJson: true
  });
  let plan = normalizeAgentFilePlan({
    agent,
    runId,
    prompt,
    reason,
    directorText,
    rawText: ai.text || ""
  });
  if (!plan.parsed || !plan.files.length) {
    const repairUser = [
      baseUser,
      "# 上一次输出无效",
      "你上一次没有返回可写入的 JSON 文件计划。现在只返回 JSON 对象，不要解释。",
      `files.path 只能使用：${getWritableDeliverables(agent.id).join(", ")}`,
      "每个文件必须给出 mode=replace 和完整 content。",
      "",
      "## 上一次无效输出",
      truncate(ai.text || "", 2200)
    ].join("\n\n");
    ai = await callAiModel({
      system,
      user: repairUser,
      account,
      expectJson: true
    });
    plan = normalizeAgentFilePlan({
      agent,
      runId,
      prompt,
      reason,
      directorText,
      rawText: ai.text || ""
    });
  }
  if (!plan.parsed) {
    const error = new Error(`${agent.name} model output was not valid JSON.`);
    error.status = 502;
    error.rawText = ai.text || "";
    throw error;
  }
  if (!plan.files.length) {
    const error = new Error(`${agent.name} model output did not include writable project files.`);
    error.status = 502;
    error.rawText = ai.text || "";
    throw error;
  }
  return {
    status: "done",
    degraded: false,
    provider: ai.config.provider,
    model: ai.config.model,
    rawId: ai.rawId,
    error: null,
    summary: plan.summary,
    files: plan.files,
    imageGenerationRequests: plan.imageGenerationRequests || [],
    rawText: ai.text || ""
  };
}

/**
 * Post-process agent output to automatically trigger image generation.
 * When a casting or keyframe agent produces image_generation_requests in its JSON output,
 * this function calls createAssetVersion() for each request to generate actual images.
 * If no explicit requests are provided but the agent is casting and CHARACTER_REFERENCES/ is empty,
 * it falls back to auto-generating character images from CHARACTER_BIBLE.md content.
 */
async function postProcessAgentImageGeneration({ agentId, projectId, agentResult, runId }) {
  const generatedFiles = [];
  const stage = workflowStageForAgent(agentId);
  if (!stage) return generatedFiles;

  // Determine if this agent should trigger image generation
  const shouldGenerate = (agentId === "casting" || agentId === "keyframe") && agentResult.status === "done";
  if (!shouldGenerate) return generatedFiles;

  // Path 1: Agent explicitly provided image_generation_requests in its JSON output
  const requests = agentResult.imageGenerationRequests || [];
  if (requests.length > 0) {
    console.log(`[post-process] ${agentId} provided ${requests.length} image generation request(s) for project ${projectId}`);
    for (const req of requests) {
      try {
        const action = req.action || "text2image";
        const type = req.type || "image";
        const relativePath = req.relativePath || "";
        const secondRelativePath = req.secondRelativePath || "";
        const prompt = String(req.prompt || "").trim();
        if (!prompt) continue;

        const asset = await createAssetVersion({ projectId, action, type, relativePath, secondRelativePath, prompt });
        if (asset?.relativePath) generatedFiles.push(asset.relativePath);
        if (asset?.files) generatedFiles.push(...asset.files);
        console.log(`[post-process] Generated image: ${asset?.relativePath || "unknown"}`);
      } catch (error) {
        console.warn(`[post-process] Image generation failed for ${agentId}:`, error?.message || error);
      }
    }
    return [...new Set(generatedFiles)];
  }

  // Path 2: Fallback for casting agent - auto-generate character images from CHARACTER_BIBLE
  if (agentId === "casting") {
    const resolvedProjectId = await resolveProjectId(projectId);
    const projectPath = resolveInside(projectsRoot, resolvedProjectId);
    const refsDir = resolveInside(projectPath, "02_characters/CHARACTER_REFERENCES");

    // Check if there are already real image files in CHARACTER_REFERENCES/
    const existingFiles = await fsp.readdir(refsDir).catch(() => []);
    const hasImages = existingFiles.some((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
    if (hasImages) {
      console.log(`[post-process] casting: CHARACTER_REFERENCES/ already has images, skipping auto-generation.`);
      return generatedFiles;
    }

    // Read CHARACTER_BIBLE to extract character descriptions
    const biblePath = resolveInside(projectPath, "02_characters/CHARACTER_BIBLE.md");
    const bibleContent = await readTextIfExists(biblePath, 12000).catch(() => "");
    if (!bibleContent.trim()) return generatedFiles;

    // Read VISUAL_STYLE_GUIDE for style context
    const stylePath = resolveInside(projectPath, "05_visual/VISUAL_STYLE_GUIDE.md");
    const styleContent = await readTextIfExists(stylePath, 3000).catch(() => "");

    // Extract character sections from CHARACTER_BIBLE
    const characters = extractCharacterSections(bibleContent);
    if (!characters.length) {
      console.log(`[post-process] casting: No character sections found in CHARACTER_BIBLE.md`);
      return generatedFiles;
    }

    // Extract style keywords from VISUAL_STYLE_GUIDE
    const stylePrefix = extractStylePrefix(styleContent);

    console.log(`[post-process] casting: Auto-generating ${characters.length} character reference image(s) for project ${projectId}`);

    for (const character of characters) {
      try {
        const prompt = buildCharacterImagePrompt(character, stylePrefix);
        if (!prompt) continue;

        const asset = await createAssetVersion({
          projectId,
          action: "text2image",
          type: "image",
          relativePath: "",
          secondRelativePath: "",
          prompt
        });
        if (asset?.relativePath) generatedFiles.push(asset.relativePath);
        if (asset?.files) generatedFiles.push(...asset.files);
        console.log(`[post-process] Generated character image for "${character.name}": ${asset?.relativePath || "unknown"}`);
      } catch (error) {
        console.warn(`[post-process] Character image generation failed for "${character.name}":`, error?.message || error);
      }
    }
  }

  return [...new Set(generatedFiles)];
}

/**
 * Extract character sections from CHARACTER_BIBLE.md content.
 * Looks for ### headings that define individual characters.
 */
function extractCharacterSections(bibleContent) {
  const characters = [];
  const sections = bibleContent.split(/^###\s+/m).slice(1); // Split by ### headings

  for (const section of sections) {
    const lines = section.trim().split("\n");
    const heading = lines[0] || "";
    // Skip non-character headings (e.g. "执行标准", "统一要求")
    if (/执行标准|验收|统一要求|输入依据|工具调用/i.test(heading)) continue;

    const name = heading.replace(/^[\d.]+\s*/, "").replace(/[（(].*?[)）]/g, "").trim();
    if (!name) continue;

    const body = lines.slice(1).join("\n").trim();
    if (body.length < 50) continue; // Too short to be a real character description

    characters.push({ name, body, fullSection: section.trim() });
  }

  return characters;
}

/**
 * Extract a style prefix from VISUAL_STYLE_GUIDE for use in image prompts.
 */
function extractStylePrefix(styleContent) {
  if (!styleContent.trim()) return "";
  // Extract key style descriptors
  const keywords = [];
  if (/梦核|dreamcore/i.test(styleContent)) keywords.push("梦核风格");
  if (/阈限空间|liminal/i.test(styleContent)) keywords.push("阈限空间");
  if (/低饱和/i.test(styleContent)) keywords.push("低饱和色调");
  if (/雾蓝/i.test(styleContent)) keywords.push("雾蓝主调");
  if (/柔光/i.test(styleContent)) keywords.push("柔光");
  if (/颗粒感/i.test(styleContent)) keywords.push("颗粒感");
  if (/赛博朋克|cyberpunk/i.test(styleContent)) keywords.push("赛博朋克风格");
  if (/皮克斯|pixar/i.test(styleContent)) keywords.push("皮克斯风格");
  if (/写实|realistic/i.test(styleContent)) keywords.push("写实风格");
  if (/竖屏|9:16/i.test(styleContent)) keywords.push("竖屏9:16");
  return keywords.join("，");
}

/**
 * Build a seedream-compatible prompt for generating a character reference image.
 */
function buildCharacterImagePrompt(character, stylePrefix) {
  const { name, body } = character;

  // Extract visual details from the character description
  const visualDetails = [];

  // Extract age/body type
  const ageMatch = body.match(/视觉年龄[与和]?体态[：:]\s*([^\n]+)/);
  if (ageMatch) visualDetails.push(ageMatch[1].trim());

  // Extract facial features
  const faceMatch = body.match(/面部[与和]?[骨骼结构特征]*[：:]\s*([^\n]+)/);
  if (faceMatch) visualDetails.push(faceMatch[1].trim());

  // Extract hair
  const hairMatch = body.match(/发型[与和边缘处理]*[：:]\s*([^\n]+)/);
  if (hairMatch) visualDetails.push(hairMatch[1].trim());

  // Extract clothing
  const clothMatch = body.match(/服装[体系]*[：:]\s*([^\n]+)/);
  if (clothMatch) visualDetails.push(clothMatch[1].trim());

  // Extract unique identification elements
  const idMatch = body.match(/独特识别元素[：:]\s*([^\n]+)/);
  if (idMatch) visualDetails.push(idMatch[1].trim());

  // Extract temperament/aura
  const auraMatch = body.match(/气质[：:]\s*([^\n]+)/);
  if (auraMatch) visualDetails.push(auraMatch[1].trim());

  // If we couldn't extract structured details, use a condensed version of the body
  if (visualDetails.length < 2) {
    // Take the first 600 chars of the body as a fallback
    const condensed = body
      .replace(/\*\*/g, "")
      .replace(/^-\s*/gm, "")
      .replace(/\n+/g, "，")
      .slice(0, 600);
    visualDetails.push(condensed);
  }

  const characterDesc = visualDetails.join("，");

  // Build the final prompt
  const parts = [];
  if (stylePrefix) parts.push(stylePrefix);
  parts.push(`角色设计参考图，全身立绘`);
  parts.push(`角色名称：${name}`);
  parts.push(characterDesc);
  parts.push("白色简洁背景，角色居中，正面或四分之三侧面，高清细节，角色设计稿风格，竖屏9:16");

  return parts.join("，");
}

async function executeLocalAgentWork({ runId, projectId, route, context, prompt, directorText, account = null }) {
  const reasonsByAgent = new Map((route.reasons || []).map((item) => [item.agentId, item.reason]));
  const baseWork = buildAgentWork(route);
  const agentRuns = [];
  const agentEvents = [];
  const upstreamNotes = [];

  const executableAgentIds = route.selectedAgents.filter((id) => id !== "director" || route.executeDirectorAgent);
  for (const agentId of executableAgentIds) {
    const agent = filmAgents.find((item) => item.id === agentId);
    if (!agent) continue;

    const agentContext = (context.agents || []).find((item) => item.id === agentId) || {};
    const hydratedAgent = {
      ...agent,
      contextPreview: agentContext.contextPreview || ""
    };
    const reason = reasonsByAgent.get(agentId);
    const stage = workflowStageForAgent(agentId);
    let agentResult;
    try {
      agentResult = await runAgentModel({
        runId,
        projectId,
        agent: hydratedAgent,
        prompt,
        reason,
        context,
        directorText,
        upstreamNotes,
        account
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const event = makeEvent({
        id: `agent-${agentId}`,
        label: `${agent.name}执行`,
        owner: agentId,
        status: "error",
        detail: `${agent.name}未能完成正式交付：${message}`,
        files: ["AGENT_WORK.json", "AGENT_EVENTS.json"]
      });
      agentEvents.push(event);
      agentRuns.push({
        agentId,
        name: agent.name,
        status: "error",
        provider: getAiConfig(account).provider,
        model: getAiConfig(account).model,
        rawId: null,
        error: message,
        toolCalls: ["read_agent_workspace_context", "model_reasoning:error", "project_archive"],
        writtenFiles: [],
        summary: "",
        rawText: truncate(error?.rawText || "", 2500)
      });
      upstreamNotes.push([
        `## ${agent.name}`,
        "状态：error",
        `错误：${message}`
      ].join("\n"));
      continue;
    }
    const writtenFiles = [];

    for (const filePlan of agentResult.files) {
      const written = await writeAgentPlannedFile({
        projectId,
        runId,
        agent,
        prompt,
        filePlan,
        source: "agent_model"
      });
      if (written && !writtenFiles.includes(written)) writtenFiles.push(written);
    }

    for (const relativePath of getDirectoryDeliverables(agentId)) {
      const written = await writeDirectoryHandoff(
        projectId,
        relativePath,
        runId,
        agent,
        prompt,
        agentResult.summary
      );
      if (written && !writtenFiles.includes(written)) writtenFiles.push(written);
    }

    // Post-process: auto-trigger image generation for casting/keyframe agents
    try {
      const generatedImages = await postProcessAgentImageGeneration({
        agentId,
        projectId,
        agentResult,
        runId
      });
      for (const imgPath of generatedImages) {
        if (imgPath && !writtenFiles.includes(imgPath)) writtenFiles.push(imgPath);
      }
    } catch (postError) {
      console.warn(`[post-process] Image generation post-processing failed for ${agentId}:`, postError?.message || postError);
    }

    const event = makeEvent({
      id: `agent-${agentId}`,
      label: `${agent.name}执行`,
      owner: agentId,
      status: agentResult.status,
      detail: `${stage ? `阶段 ${stage.order}「${stage.name}」：` : ""}${agent.name}已独立调用模型并写回 ${writtenFiles.length} 个正式项目交付物。${stage?.completionStandard ? `完成标准：${stage.completionStandard}` : ""}`,
      files: writtenFiles
    });
    agentEvents.push(event);
    agentRuns.push({
      agentId,
      name: agent.name,
      status: agentResult.status,
      provider: agentResult.provider,
      model: agentResult.model,
      rawId: agentResult.rawId,
      error: agentResult.error,
      toolCalls: [
        "read_agent_workspace_context",
        `model_reasoning:${agentResult.provider}/${agentResult.model}`,
        "project_file_write",
        ...(writtenFiles.some((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)) ? ["dreamina_image_generate"] : []),
        "project_archive"
      ],
      writtenFiles,
      summary: agentResult.summary,
      rawText: truncate(agentResult.rawText, 2500)
    });
    upstreamNotes.push([
      `## ${agent.name}`,
      `状态：${agentResult.status}`,
      `写入：${writtenFiles.join(", ") || "无"}`,
      truncate(agentResult.summary, 900)
    ].join("\n"));
  }

  const agents = baseWork.map((work) => {
    const run = agentRuns.find((item) => item.agentId === work.agentId);
    if (!run) return work;
    return {
      ...work,
      status: run.status,
      provider: run.provider,
      model: run.model,
      rawId: run.rawId,
      error: run.error,
      writtenFiles: run.writtenFiles,
      toolCalls: run.toolCalls,
      summary: run.summary,
      rawText: run.rawText
    };
  });

  return { agents, events: agentEvents };
}

async function writeRunRecord({ runId, prompt, projectId, parentRunId, route, text, provider, model, rawId, degraded, providerError, agentWork, agentEvents }) {
  const resolvedProjectId = await requireProjectDirectory(projectId);
  const runsPath = projectRunsPath(resolvedProjectId);
  await fsp.mkdir(runsPath, { recursive: true });
  const runPath = resolveInside(runsPath, runId);
  await fsp.mkdir(runPath, { recursive: true });
  const status = buildRunStatus({ prompt, projectId: resolvedProjectId, route, provider, model, rawId, degraded, providerError, parentRunId, agentEvents });
  const agentWorkRecord = {
    runId,
    projectId: resolvedProjectId,
    parentRunId: parentRunId || null,
    mode: route.mode,
    agents: agentWork || buildAgentWork(route)
  };

  const routeRecord = {
    runId,
    prompt,
    projectId: resolvedProjectId,
    parentRunId: parentRunId || null,
    selectedAgents: route.selectedAgents,
    reasons: route.reasons,
    mode: route.mode,
    stepBudget: route.stepBudget,
    continuation: Boolean(route.continuation),
    targetStage: route.targetStage || null,
    executeDirectorAgent: Boolean(route.executeDirectorAgent),
    provider,
    model,
    rawId,
    degraded: Boolean(degraded),
    providerError,
    createdAt: new Date().toISOString()
  };
  const taskText = [
    "# Film Studio Run Task",
    "",
    `- Run: ${runId}`,
    `- Project: ${resolvedProjectId || "未指定"}`,
    parentRunId ? `- Parent Run: ${parentRunId}` : "",
    `- Mode: ${route.mode}`,
    `- Agents: ${route.selectedAgents.join(", ")}`,
    "",
    "## Prompt",
    prompt
  ].join("\n");

  await Promise.all([
    fsp.writeFile(path.join(runPath, "TASK.md"), taskText, "utf8"),
    fsp.writeFile(path.join(runPath, "ROUTE.json"), `${JSON.stringify(routeRecord, null, 2)}\n`, "utf8"),
    fsp.writeFile(path.join(runPath, "STATUS.json"), `${JSON.stringify(status, null, 2)}\n`, "utf8"),
    fsp.writeFile(path.join(runPath, "AGENT_WORK.json"), `${JSON.stringify(agentWorkRecord, null, 2)}\n`, "utf8"),
    fsp.writeFile(path.join(runPath, "AGENT_EVENTS.json"), `${JSON.stringify({ runId, projectId, parentRunId: parentRunId || null, events: agentEvents || [] }, null, 2)}\n`, "utf8"),
    fsp.writeFile(path.join(runPath, "RESULT.md"), normalizeText(text), "utf8")
  ]);
  if (parentRunId) {
    await appendChildRunIndex(parentRunId, {
      runId,
      projectId: resolvedProjectId,
      prompt,
      createdAt: status.createdAt,
      selectedAgents: route.selectedAgents
    });
  }

  const files = runRecordFileNames.map((name) => ({
    name,
    path: path.join(runPath, name),
    relativePath: path.relative(repoRoot, path.join(runPath, name))
  }));

  return {
    runId,
    runPath,
    files,
    status,
    agentWork: agentWorkRecord.agents
  };
}

function buildFailedAgentWork(route, providerError) {
  return buildAgentWork(route).map((work) => ({
    ...work,
    status: work.agentId === "director" ? "error" : "pending",
    error: work.agentId === "director"
      ? providerError
      : "Skipped because the upstream model call failed.",
    toolCalls: work.agentId === "director" ? ["model_reasoning:error", "run_archive"] : [],
    summary: ""
  }));
}

async function appendAgentRunMemory({ projectId, runId, route, prompt, directorText, agentWork, providerError }) {
  const selected = new Set(["director", ...(route?.selectedAgents || [])]);
  const timestamp = shanghaiTimeKey();
  const dateKey = shanghaiDateKey(0);
  const agentSummaries = new Map((agentWork || []).map((item) => [item.agentId, item.summary || item.error || ""]));
  const failedAgent = (agentWork || []).find((item) => item.status === "error" || item.error);
  const runError = providerError || failedAgent?.error || "";
  await Promise.all([...selected].map(async (agentId) => {
    const agent = filmAgents.find((item) => item.id === agentId);
    if (!agent) return;
    const workspace = resolveAgentWorkspace(agent);
    const memoryDir = path.join(workspace, "memory");
    await fsp.mkdir(memoryDir, { recursive: true });
    const memoryPath = path.join(memoryDir, `${dateKey}.md`);
    const content = [
      `## ${timestamp} · Run ${runId}`,
      `- Project: ${projectId}`,
      `- Status: ${runError ? "error" : "done"}`,
      `- User: ${truncate(prompt, 500).replace(/\r?\n/g, " ")}`,
      runError ? `- Error: ${runError}` : "",
      directorText ? `- Director: ${truncate(directorText, 700).replace(/\r?\n/g, " ")}` : "",
      agentSummaries.get(agentId) ? `- ${agent.name}: ${truncate(agentSummaries.get(agentId), 700).replace(/\r?\n/g, " ")}` : ""
    ].filter(Boolean).join("\n");
    await fsp.appendFile(memoryPath, `${content}\n\n`, "utf8");
  }));
}

function cryptoRandom(size) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(size);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function createProject({ title, prompt, ownerUserId = "" }) {
  const projectId = projectIdFromParts(createRunId(), title || defaultProjectName);
  const templatePath = projectTemplateRoot;
  const projectPath = resolveInside(projectsRoot, projectId);
  if (fs.existsSync(projectPath)) {
    throw new Error(`Project already exists: ${projectId}`);
  }

  await copyMissingTemplateStructure(templatePath, projectPath);
  if (ownerUserId) {
    await writeProjectMeta(projectId, {
      ownerUserId,
      createdAt: new Date().toISOString()
    });
  }
  await fsp.mkdir(projectRunsPath(projectId), { recursive: true });
  const briefPath = path.join(projectPath, "00_admin", "PROJECT_BRIEF.md");
  const brief = [
    `# ${parseProjectFolderName(projectId).editableName} 项目简报`,
    "",
    `创建时间：${new Date().toISOString()}`,
    `项目 ID：${projectId}`,
    "",
    "## 原始需求",
    prompt || "待填写",
    "",
    "## 后端动作",
    "- 已从标准项目模板初始化目录结构，模板正文不会计入项目进度。",
    "- 后续由 `/api/film/task` 继续进行总导演调度和 Agent 路由。"
  ].join("\n");
  await fsp.writeFile(briefPath, `${brief}\n`, "utf8");

  return getProjectSummary(projectId);
}

async function renameProject(projectId, nextName) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const current = parseProjectFolderName(resolvedProjectId);
  if (!current.runIdPrefix) {
    const error = new Error("Project id does not use the required <runId>-name format.");
    error.status = 400;
    throw error;
  }
  const newProjectId = projectIdFromParts(current.runIdPrefix, nextName || defaultProjectName);
  if (newProjectId === resolvedProjectId) return getProjectSummary(resolvedProjectId);

  const currentPath = resolveInside(projectsRoot, resolvedProjectId);
  const nextPath = resolveInside(projectsRoot, newProjectId);
  if (await pathStats(nextPath)) {
    const error = new Error(`Project already exists: ${newProjectId}`);
    error.status = 409;
    throw error;
  }

  await fsp.rename(currentPath, nextPath);
  await patchProjectRunReferences(newProjectId);
  await patchProjectConversationReferences(newProjectId);
  const migration = await readMigrationMap();
  for (const [legacyId, mappedId] of Object.entries(migration.projects || {})) {
    if (mappedId === resolvedProjectId) migration.projects[legacyId] = newProjectId;
  }
  migration.projects[resolvedProjectId] = newProjectId;
  await writeMigrationMap(migration);
  return getProjectSummary(newProjectId);
}

async function processFilmTask({ prompt, requestedProjectId, parentRunId = null, account = null }) {
  let parentRun = null;
  if (parentRunId) {
    parentRun = await getRunDetailForUser(parentRunId, account);
  }
  const resolvedRequestedProjectId = requestedProjectId ? await resolveProjectId(requestedProjectId) : "";
  if (parentRun && resolvedRequestedProjectId && parentRun.projectId && resolvedRequestedProjectId !== parentRun.projectId) {
    const error = new Error(`Continue run must stay in the parent project: ${parentRun.projectId}.`);
    error.status = 409;
    throw error;
  }

  const projectId = await getActiveProjectId(parentRun?.projectId || resolvedRequestedProjectId || "", account);
  if (!projectId) {
    const error = new Error("No project is available. Create a project first.");
    error.status = 400;
    throw error;
  }
  await requireProjectAccess(projectId, account);

  const projectProgress = await getProjectProgress(projectId).catch(() => null);
  const route = routePrompt(prompt, projectProgress);
  const context = await buildTaskContext({ prompt, route, projectId, parentRun, projectProgress, user: account });
  const runId = createRunId();
  const activeConfig = getAiConfig(account);
  const user = [
    context.text,
    "",
    "# 后端已选路由",
    JSON.stringify({
      runId,
      projectId,
      parentRunId: parentRunId || null,
      mode: route.mode,
      stepBudget: route.stepBudget,
      selectedAgents: route.selectedAgents,
      reasons: route.reasons,
      targetStage: route.targetStage || null,
      targetStages: route.targetStages || []
    }, null, 2)
  ].filter(Boolean).join("\n");

  try {
    const ai = await callAiModel({ system: buildSystemPrompt(), user, account });
    const text = ai.text;
    const localAgentWork = await executeLocalAgentWork({
      runId,
      projectId,
      route,
      context,
      prompt,
      directorText: text,
      account
    });

    const record = await writeRunRecord({
      runId,
      prompt,
      projectId,
      parentRunId,
      route,
      text,
      provider: ai.config.provider,
      model: ai.config.model,
      rawId: ai.rawId,
      degraded: false,
      providerError: null,
      agentWork: localAgentWork.agents,
      agentEvents: localAgentWork.events
    });
    let runDetail = await getRunDetail(record.runId);
    const conversation = await writeConversationArchive(runDetail);
    runDetail = await getRunDetail(record.runId);
    await appendAgentRunMemory({
      projectId,
      runId,
      route,
      prompt,
      directorText: text,
      agentWork: record.agentWork,
      providerError: null
    });
    const currentEvents = record.status.events;
    const threadEvents = Array.isArray(runDetail.threadEvents) && runDetail.threadEvents.length
      ? runDetail.threadEvents
      : currentEvents;

    return {
      ok: true,
      degraded: false,
      providerError: null,
      provider: ai.config.provider,
      model: ai.config.model,
      text,
      rawId: ai.rawId,
      projectId,
      parentRunId: parentRunId || null,
      route,
      runId: record.runId,
      conversation,
      files: record.files,
      status: record.status,
      events: currentEvents,
      thread: runDetail.thread || [],
      threadEvents,
      agentWork: record.agentWork
    };
  } catch (error) {
    const caught = error instanceof Error ? error : new Error(String(error));
    const providerError = caught.message;
    const failedConfig = caught.config || activeConfig;
    const failedAgentWork = buildFailedAgentWork(route, providerError);
    const failedEvent = makeEvent({
      id: "model-error",
      label: "模型调用失败",
      owner: "director",
      status: "error",
      detail: providerError,
      files: ["STATUS.json"]
    });
    const record = await writeRunRecord({
      runId,
      prompt,
      projectId,
      parentRunId,
      route,
      text: "",
      provider: failedConfig.provider,
      model: failedConfig.model,
      rawId: null,
      degraded: true,
      providerError,
      agentWork: failedAgentWork,
      agentEvents: [failedEvent]
    });
    let runDetail = await getRunDetail(record.runId);
    const conversation = await writeConversationArchive(runDetail);
    runDetail = await getRunDetail(record.runId);
    await appendAgentRunMemory({
      projectId,
      runId,
      route,
      prompt,
      directorText: "",
      agentWork: failedAgentWork,
      providerError
    });
    const currentEvents = record.status.events;
    const threadEvents = Array.isArray(runDetail.threadEvents) && runDetail.threadEvents.length
      ? runDetail.threadEvents
      : currentEvents;
    return {
      ok: true,
      degraded: true,
      providerError,
      provider: failedConfig.provider,
      model: failedConfig.model,
      text: "",
      rawId: null,
      projectId,
      parentRunId: parentRunId || null,
      route,
      runId: record.runId,
      conversation,
      files: record.files,
      status: record.status,
      events: currentEvents,
      thread: runDetail.thread || [],
      threadEvents,
      agentWork: record.agentWork,
      run: runDetail
    };
  }
}

const filmTaskJobs = new Map();
const filmTaskJobTtlMs = positiveNumberEnv("FILM_TASK_JOB_TTL_MS", 2 * 60 * 60 * 1000);

function createFilmTaskJobId() {
  return `job-${new Date().toISOString().replace(/[:.]/g, "-")}-${cryptoRandom(6)}`;
}

function cleanupFilmTaskJobs() {
  const now = Date.now();
  for (const [jobId, job] of filmTaskJobs.entries()) {
    if (now - new Date(job.updatedAt || job.createdAt || 0).getTime() > filmTaskJobTtlMs) {
      filmTaskJobs.delete(jobId);
    }
  }
}

function publicFilmTaskJob(job) {
  return {
    ok: true,
    pending: job.status === "queued" || job.status === "running",
    jobId: job.jobId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt || null,
    endedAt: job.endedAt || null,
    prompt: job.prompt,
    projectId: job.requestedProjectId,
    parentRunId: job.parentRunId || null,
    runId: job.result?.runId || null,
    provider: job.result?.provider || null,
    model: job.result?.model || null,
    result: job.status === "done" ? job.result : null,
    error: job.status === "error" ? job.error : null,
    errorPayload: job.status === "error" ? job.errorPayload : null
  };
}

function startFilmTaskJob({ prompt, requestedProjectId, parentRunId = null, account = null }) {
  cleanupFilmTaskJobs();
  const now = new Date().toISOString();
  const job = {
    jobId: createFilmTaskJobId(),
    ownerUserId: account?.id || null,
    status: "queued",
    prompt,
    requestedProjectId,
    parentRunId,
    account: account ? publicUser(account) : null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    endedAt: null,
    result: null,
    error: null,
    errorPayload: null
  };
  filmTaskJobs.set(job.jobId, job);

  queueMicrotask(async () => {
    job.status = "running";
    job.startedAt = new Date().toISOString();
    job.updatedAt = job.startedAt;
    try {
      job.result = await processFilmTask({
        prompt,
        requestedProjectId,
        parentRunId,
        account: job.account
      });
      job.status = "done";
      job.error = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.status = "error";
      job.error = message;
      job.errorPayload = {
        ok: false,
        error: "Film task failed.",
        detail: message,
        status: error?.status || 500,
        projectId: error?.filmTask?.projectId || requestedProjectId || null,
        runId: error?.filmTask?.runId || null,
        run: error?.filmRun || null,
        parentRunId: error?.filmTask?.parentRunId || parentRunId || null,
        route: error?.filmTask?.route || null,
        files: error?.filmTask?.files || [],
        statusRecord: error?.filmTask?.status || null,
        events: error?.filmTask?.events || [],
        thread: error?.filmTask?.thread || [],
        threadEvents: error?.filmTask?.threadEvents || [],
        agentWork: error?.filmTask?.agentWork || []
      };
      console.warn("[film-task-job] failed", {
        jobId: job.jobId,
        projectId: requestedProjectId,
        parentRunId,
        error: message
      });
    } finally {
      job.endedAt = new Date().toISOString();
      job.updatedAt = job.endedAt;
    }
  });

  return publicFilmTaskJob(job);
}

function sanitizeAssetBase(value) {
  return String(value || "asset")
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48) || "asset";
}

function dreaminaRuntimeEnv() {
  const pathParts = [
    path.dirname(dreaminaBin),
    "/home/honeycake/.local/bin",
    process.env.PATH || ""
  ].filter(Boolean);
  return {
    ...process.env,
    PATH: [...new Set(pathParts)].join(":")
  };
}

function runDreamina(args, { timeoutMs = 10 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(dreaminaBin, args, {
      cwd: repoRoot,
      env: dreaminaRuntimeEnv(),
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error(`Dreamina CLI timed out after ${Math.round(timeoutMs / 1000)}s.`);
      error.status = 504;
      reject(error);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => {
      clearTimeout(timer);
      error.status = error.code === "ENOENT" ? 503 : 500;
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (code === 0) {
        resolve({ stdout, stderr, output });
        return;
      }
      const error = new Error(output || `Dreamina CLI exited with code ${code}.`);
      error.status = /未检测到有效登录态|login/i.test(output) ? 401 : 502;
      error.output = output;
      reject(error);
    });
  });
}

function parseDreaminaOutput(output) {
  const parsed = extractJsonObject(output);
  return parsed || { raw: output };
}

function findDeepValue(value, names) {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeepValue(item, names);
      if (found) return found;
    }
    return "";
  }
  for (const name of names) {
    if (typeof value[name] === "string" && value[name].trim()) return value[name].trim();
  }
  for (const item of Object.values(value)) {
    const found = findDeepValue(item, names);
    if (found) return found;
  }
  return "";
}

function dreaminaSubmitId(payload, output = "") {
  return findDeepValue(payload, ["submit_id", "submitId", "task_id", "taskId"])
    || output.match(/submit[_-]?id["'\s:=]+([A-Za-z0-9_-]+)/i)?.[1]
    || "";
}

function dreaminaStatus(payload, output = "") {
  return (findDeepValue(payload, ["gen_status", "genStatus", "status"])
    || output.match(/gen[_-]?status["'\s:=]+([A-Za-z0-9_-]+)/i)?.[1]
    || "").toLowerCase();
}

function dreaminaFailReason(payload, output = "") {
  return findDeepValue(payload, ["fail_reason", "failReason", "error", "message"]) || output;
}

function isDreaminaSuccessStatus(status) {
  return ["success", "succeeded", "done", "completed"].includes(String(status || "").toLowerCase());
}

function isDreaminaFailureStatus(status) {
  return ["fail", "failed", "error"].includes(String(status || "").toLowerCase());
}

async function listMediaFiles(dirPath, allowedExtensions) {
  const files = [];
  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
        const stat = await pathStats(fullPath);
        files.push({ path: fullPath, stat });
      }
    }
  }
  await walk(dirPath);
  return files.sort((a, b) => (b.stat?.mtimeMs || 0) - (a.stat?.mtimeMs || 0)).map((item) => item.path);
}

async function queryDreaminaUntilDone(submitId, downloadDir, allowedExtensions) {
  const deadline = Date.now() + Math.max(30, dreaminaPollSeconds) * 1000;
  let lastPayload = null;
  let lastOutput = "";
  await fsp.mkdir(downloadDir, { recursive: true });

  while (Date.now() <= deadline) {
    const result = await runDreamina([
      "query_result",
      `--submit_id=${submitId}`,
      `--download_dir=${downloadDir}`
    ], { timeoutMs: 90_000 });
    lastOutput = result.output;
    lastPayload = parseDreaminaOutput(result.output);
    const status = dreaminaStatus(lastPayload, result.output);
    const downloaded = await listMediaFiles(downloadDir, allowedExtensions);

    if (downloaded.length && (!status || isDreaminaSuccessStatus(status))) {
      return { payload: lastPayload, output: result.output, downloaded };
    }
    if (isDreaminaSuccessStatus(status) && downloaded.length) {
      return { payload: lastPayload, output: result.output, downloaded };
    }
    if (isDreaminaFailureStatus(status)) {
      const error = new Error(`Dreamina task failed: ${dreaminaFailReason(lastPayload, result.output)}`);
      error.status = 502;
      error.payload = lastPayload;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const error = new Error(`Dreamina task did not finish before timeout. submit_id=${submitId}`);
  error.status = 504;
  error.payload = lastPayload;
  error.output = lastOutput;
  throw error;
}

function inferDreaminaRatio(text, fallback = "16:9") {
  const value = String(text || "");
  for (const ratio of ["21:9", "16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16"]) {
    if (value.includes(ratio)) return ratio;
  }
  if (/竖屏|竖构图|vertical|shorts|reels|tiktok/i.test(value)) return "9:16";
  return fallback;
}

function dreaminaCommandForAsset({ requestedType, sourcePath, lastPath, prompt }) {
  const ratio = inferDreaminaRatio(prompt, process.env.DREAMINA_DEFAULT_RATIO || "16:9");
  if (requestedType === "video") {
    if (sourcePath && lastPath) {
      return {
        command: "frames2video",
        args: [
          "frames2video",
          `--first=${sourcePath}`,
          `--last=${lastPath}`,
          `--prompt=${prompt}`,
          `--duration=${Number(process.env.DREAMINA_VIDEO_DURATION || 5)}`,
          `--model_version=${process.env.DREAMINA_FRAMES2VIDEO_MODEL || "seedance2.0fast"}`,
          "--poll=10"
        ],
        allowedExtensions: new Set([".mp4", ".mov", ".webm"])
      };
    }
    if (sourcePath) {
      return {
        command: "image2video",
        args: [
          "image2video",
          `--image=${sourcePath}`,
          `--prompt=${prompt}`,
          `--duration=${Number(process.env.DREAMINA_VIDEO_DURATION || 5)}`,
          `--model_version=${process.env.DREAMINA_IMAGE2VIDEO_MODEL || "seedance2.0fast"}`,
          "--poll=10"
        ],
        allowedExtensions: new Set([".mp4", ".mov", ".webm"])
      };
    }
    return {
      command: "text2video",
      args: [
        "text2video",
        `--prompt=${prompt}`,
        `--duration=${Number(process.env.DREAMINA_VIDEO_DURATION || 5)}`,
        `--ratio=${ratio}`,
        `--model_version=${process.env.DREAMINA_TEXT2VIDEO_MODEL || "seedance2.0fast"}`,
        "--poll=10"
      ],
      allowedExtensions: new Set([".mp4", ".mov", ".webm"])
    };
  }

  if (sourcePath) {
    return {
      command: "image2image",
      args: [
        "image2image",
        `--images=${sourcePath}`,
        `--prompt=${prompt}`,
        `--ratio=${ratio}`,
        `--resolution_type=${process.env.DREAMINA_IMAGE_RESOLUTION || "2k"}`,
        `--model_version=${process.env.DREAMINA_IMAGE_MODEL || "5.0"}`,
        "--poll=10"
      ],
      allowedExtensions: new Set([".png", ".jpg", ".jpeg", ".webp"])
    };
  }

  return {
    command: "text2image",
    args: [
      "text2image",
      `--prompt=${prompt}`,
      `--ratio=${ratio}`,
      `--resolution_type=${process.env.DREAMINA_IMAGE_RESOLUTION || "2k"}`,
      `--model_version=${process.env.DREAMINA_IMAGE_MODEL || "5.0"}`,
      "--poll=10"
    ],
    allowedExtensions: new Set([".png", ".jpg", ".jpeg", ".webp"])
  };
}

async function inferDreaminaPrompt({ projectId, requestedType, parentRelativePath }) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const candidates = requestedType === "video"
    ? [
        "08_cinematography/MOVEMENT_PLAN.md",
        "08_cinematography/CAMERA_LANGUAGE.md",
        "07_keyframes/SEEDREAM_KEYFRAMES.md",
        "07_keyframes/KEYFRAME_PLAN.md"
      ]
    : parentRelativePath.startsWith("02_characters/")
      ? [
          "02_characters/CASTING_NOTES.md",
          "02_characters/CHARACTER_BIBLE.md",
          "05_visual/VISUAL_STYLE_GUIDE.md"
        ]
      : [
          "07_keyframes/SEEDREAM_KEYFRAMES.md",
          "07_keyframes/KEYFRAME_PLAN.md",
          "05_visual/VISUAL_STYLE_GUIDE.md",
          "04_storyboard/STORYBOARD_MASTER.md"
        ];
  const sections = [];
  for (const relativePath of candidates) {
    const text = await readTextIfExists(resolveInside(projectPath, relativePath), 2400).catch(() => "");
    if (normalizeText(text).trim()) sections.push(`## ${relativePath}\n${text}`);
  }
  if (!sections.length) return "";
  const task = requestedType === "video"
    ? "请基于以下项目文件生成镜头视频，保持关键帧、角色、场景和运镜连续性。"
    : "请基于以下项目文件生成关键帧图片，保持角色识别锚点、画幅、风格和静态画面要求。";
  return truncate([task, ...sections].join("\n\n"), 6000);
}

async function moveDreaminaDownloads({ downloaded, projectPath, outputDir, sourceName, action, versionNumber, versionId }) {
  const outputPath = resolveInside(projectPath, outputDir);
  await fsp.mkdir(outputPath, { recursive: true });
  const moved = [];
  for (const [index, filePath] of downloaded.entries()) {
    const ext = path.extname(filePath).toLowerCase() || ".bin";
    const suffix = downloaded.length > 1 ? `_${String(index + 1).padStart(2, "0")}` : "";
    const fileName = `${sanitizeAssetBase(sourceName)}_${action}_v${String(versionNumber).padStart(2, "0")}_${versionId}${suffix}${ext}`;
    const target = resolveInside(outputPath, fileName);
    await fsp.rename(filePath, target).catch(async () => {
      await fsp.copyFile(filePath, target);
      await fsp.rm(filePath, { force: true });
    });
    moved.push({
      path: target,
      relativePath: path.relative(projectPath, target).split(path.sep).join("/"),
      name: fileName
    });
  }
  return moved;
}

async function readAssetVersions(projectId) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const filePath = resolveInside(projectPath, "09_assets/asset_versions.json");
  const versions = await readJsonIfExists(filePath).catch(() => null);
  return Array.isArray(versions?.versions) ? versions.versions : [];
}

async function writeAssetVersions(projectId, versions) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const filePath = resolveInside(projectPath, "09_assets/asset_versions.json");
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify({ versions }, null, 2)}\n`, "utf8");
  return path.relative(projectPath, filePath);
}

async function createAssetVersion({ projectId, action, type, relativePath, secondRelativePath = "", prompt }) {
  const resolvedProjectId = await resolveProjectId(projectId);
  const projectPath = resolveInside(projectsRoot, resolvedProjectId);
  const versions = await readAssetVersions(resolvedProjectId);
  const parentRelativePath = relativePath || "";
  const sourceName = parentRelativePath ? path.basename(parentRelativePath) : `${type || "image"}-request`;
  const versionNumber = versions.filter((item) => item.parentRelativePath === parentRelativePath).length + 1;
  const versionId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${cryptoRandom(4)}`;
  const requestedType = type === "video" || action.includes("video") ? "video" : "image";
  const generationPrompt = truncate(
    normalizeText(prompt).trim() || await inferDreaminaPrompt({ projectId: resolvedProjectId, requestedType, parentRelativePath }),
    6000
  );
  if (!generationPrompt) {
    const error = new Error("Dreamina generation requires a real prompt or a filled keyframe/cinematography file.");
    error.status = 400;
    throw error;
  }
  const outputDir = requestedType === "video"
    ? "09_assets/processed"
    : parentRelativePath.startsWith("02_characters/")
      ? "02_characters/CHARACTER_REFERENCES"
      : "07_keyframes/KEYFRAMES";

  let sourcePath = "";
  let lastPath = "";
  if (parentRelativePath) {
    const candidate = resolveInside(projectPath, parentRelativePath);
    const candidateStat = await pathStats(candidate);
    const candidateExt = path.extname(candidate).toLowerCase();
    if (candidateStat?.isFile() && [".png", ".jpg", ".jpeg", ".webp"].includes(candidateExt)) {
      sourcePath = candidate;
    }
  }
  const normalizedSecondRelativePath = normalizeRelativeProjectPath(secondRelativePath);
  if (normalizedSecondRelativePath) {
    const candidate = resolveInside(projectPath, normalizedSecondRelativePath);
    const candidateStat = await pathStats(candidate);
    const candidateExt = path.extname(candidate).toLowerCase();
    if (candidateStat?.isFile() && [".png", ".jpg", ".jpeg", ".webp"].includes(candidateExt)) {
      lastPath = candidate;
    }
  }

  const dreamina = dreaminaCommandForAsset({
    requestedType,
    sourcePath,
    lastPath,
    prompt: generationPrompt
  });
  const submitResult = await runDreamina(dreamina.args, { timeoutMs: 120_000 });
  const submitPayload = parseDreaminaOutput(submitResult.output);
  const submitId = dreaminaSubmitId(submitPayload, submitResult.output);
  if (!submitId) {
    const error = new Error(`Dreamina did not return submit_id. Output: ${truncate(submitResult.output, 800)}`);
    error.status = 502;
    error.payload = submitPayload;
    throw error;
  }
  const submitStatus = dreaminaStatus(submitPayload, submitResult.output);
  if (isDreaminaFailureStatus(submitStatus)) {
    const error = new Error(`Dreamina task failed: ${dreaminaFailReason(submitPayload, submitResult.output)}`);
    error.status = 502;
    error.payload = submitPayload;
    throw error;
  }

  const downloadDir = resolveInside(projectPath, path.join("09_assets", "raw", `dreamina-${versionId}`));
  const query = await queryDreaminaUntilDone(submitId, downloadDir, dreamina.allowedExtensions);
  const movedFiles = await moveDreaminaDownloads({
    downloaded: query.downloaded,
    projectPath,
    outputDir,
    sourceName,
    action,
    versionNumber,
    versionId
  });
  await fsp.rm(downloadDir, { recursive: true, force: true }).catch(() => {});
  if (!movedFiles.length) {
    const error = new Error(`Dreamina task succeeded but no media file was downloaded. submit_id=${submitId}`);
    error.status = 502;
    throw error;
  }
  const primary = movedFiles[0];

  const record = {
    versionId,
    projectId: resolvedProjectId,
    type: requestedType,
    action,
    relativePath: primary.relativePath,
    files: movedFiles.map((file) => file.relativePath),
    parentRelativePath,
    versionNumber,
    status: "success",
    tool: `dreamina:${dreamina.command}`,
    submitId,
    prompt: generationPrompt,
    command: dreamina.args.map((arg) => arg.startsWith("--prompt=") ? "--prompt=[redacted]" : arg),
    providerPayload: query.payload,
    createdAt: new Date().toISOString()
  };

  await appendAssetManifest(resolvedProjectId, record);
  await writeAssetVersions(resolvedProjectId, [record, ...versions]);

  return {
    ...record,
    path: primary.path,
    name: primary.name,
    url: `/api/film/projects/${encodeURIComponent(resolvedProjectId)}/assets/${primary.relativePath.split("/").map(encodeURIComponent).join("/")}`
  };
}

async function getRuntimeSnapshot(projectId, user = null) {
  const [backend, agents, projects, recentRuns] = await Promise.all([
    getStudioStatus(),
    getAgentSummaries(false, user),
    listProjects(user),
    getRecentRuns(100, projectId, user)
  ]);
  const activeProjectId = await getActiveProjectId(projectId, user);
  const [activeProject, documents, workflow, assets, agentMemory] = await Promise.all([
    activeProjectId ? getProjectSummary(activeProjectId) : null,
    activeProjectId ? getProjectDocuments(activeProjectId) : [],
    activeProjectId ? getProjectWorkflowState(activeProjectId) : [],
    activeProjectId ? getProjectAssets(activeProjectId) : [],
    getAgentMemoryAndSkills()
  ]);

  return {
    ok: true,
    service: serviceName,
    paths: {
      repoRoot,
      localAgentRoot,
      filmWorkspacePath,
      projectsRoot
    },
    backend,
    agents,
    projects,
    activeProject,
    documents,
    workflow,
    projectProgress: activeProject?.progress || null,
    assets,
    agentMemory,
    recentRuns
  };
}

async function migrateUserOwnedData() {
  const usersRecord = readUsersSync();
  const owner = usersRecord.users.find((user) => normalizeEmail(user.email) === defaultOwnerEmail);
  if (!owner) return;

  const ownerConfigPath = userModelConfigPath(owner);
  if (!fs.existsSync(ownerConfigPath) && fs.existsSync(modelConfigPath)) {
    await fsp.mkdir(path.dirname(ownerConfigPath), { recursive: true });
    await fsp.copyFile(modelConfigPath, ownerConfigPath);
  }

  const entries = await fsp.readdir(projectsRoot, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && isProjectDirectoryName(entry.name))
    .map(async (entry) => {
      const meta = await readProjectMeta(entry.name);
      if (meta?.ownerUserId) return;
      await writeProjectMeta(entry.name, {
        ownerUserId: owner.id,
        createdAt: meta?.createdAt || new Date().toISOString()
      });
    }));
}

await migrateLegacyProjectStorage();
await reconcileProjectAliases();
await normalizeAllProjectStructures();
await migrateUserOwnedData();

app.get("/api/health", async (req, res) => {
  const user = await authenticateRequest(req).catch(() => null);
  const config = getAiConfig(user);
  const backend = await getStudioStatus();
  res.json({
    ok: true,
    service: serviceName,
    scope: user ? "user" : "global",
    activeProfileId: config.id,
    provider: config.provider,
    model: config.model,
    wireApi: config.wireApi,
    hasApiKey: Boolean(config.apiKey),
    backend
  });
});

app.get("/api/auth/me", async (req, res) => {
  const user = await authenticateRequest(req).catch(() => null);
  if (!user) {
    res.status(401).json({ ok: false, user: null });
    return;
  }
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const repeatPassword = String(req.body?.repeatPassword || req.body?.passwordRepeat || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "Valid email is required." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ ok: false, error: "Password must be at least 6 characters." });
    return;
  }
  if (password !== repeatPassword) {
    res.status(400).json({ ok: false, error: "Passwords do not match." });
    return;
  }

  const record = readUsersSync();
  if (record.users.some((user) => normalizeEmail(user.email) === email)) {
    res.status(409).json({ ok: false, error: "Email is already registered." });
    return;
  }
  const passwordRecord = hashPassword(password);
  const user = {
    id: userIdFromEmail(email),
    email,
    passwordSalt: passwordRecord.salt,
    passwordHash: passwordRecord.hash,
    createdAt: new Date().toISOString()
  };
  record.users.push(user);
  await writeUsers(record);
  await fsp.mkdir(path.join(userDataRoot, user.id), { recursive: true });
  await createUserSession(req, res, user.id);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const record = readUsersSync();
  const user = record.users.find((item) => normalizeEmail(item.email) === email);
  if (!user || !verifyPassword(password, user)) {
    res.status(401).json({ ok: false, error: "Invalid email or password." });
    return;
  }
  await createUserSession(req, res, user.id);
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const token = parseCookies(req)[authCookieName];
  const record = readUsersSync();
  record.sessions = record.sessions.filter((session) => session.tokenHash !== sessionHash(token));
  await writeUsers(record);
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.use("/api/config", requireAuth);
app.use("/api/film", requireAuth);

app.get("/api/config/status", (req, res) => {
  const config = getAiConfig(req.user);
  res.json({
    activeProfileId: config.id,
    name: config.name,
    provider: config.provider,
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    baseUrl: config.baseUrl,
    wireApi: config.wireApi,
    authScheme: config.authScheme,
    disableResponseStorage: config.disableResponseStorage,
    apiKey: maskKey(config.apiKey),
    hasApiKey: Boolean(config.apiKey),
    workspace: filmWorkspacePath
  });
});

app.get("/api/config/models", (_req, res) => {
  res.json({ ok: true, ...publicModelSettings(readModelSettingsSync(_req.user)) });
});

app.put("/api/config/models", async (req, res) => {
  try {
    const settings = await writeModelSettings({
      activeProfileId: String(req.body?.activeProfileId || "").trim(),
      profiles: Array.isArray(req.body?.profiles) ? req.body.profiles : []
    }, req.user);
    res.json({ ok: true, ...publicModelSettings(settings) });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: "Unable to save model configuration.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.patch("/api/config/models/active", async (req, res) => {
  try {
    const current = readModelSettingsSync(req.user);
    const activeProfileId = String(req.body?.activeProfileId || "").trim();
    if (!current.profiles.some((profile) => profile.id === activeProfileId)) {
      res.status(404).json({ ok: false, error: "Model profile not found." });
      return;
    }
    const settings = await writeModelSettings({ ...current, activeProfileId }, req.user);
    res.json({ ok: true, ...publicModelSettings(settings) });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: "Unable to switch model.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/runtime", async (req, res) => {
  try {
    res.json(await getRuntimeSnapshot(String(req.query.project || "").trim(), req.user));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Unable to build film runtime snapshot.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/agents", async (req, res) => {
  try {
    res.json({ ok: true, agents: await getAgentSummaries(false, req.user) });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Unable to read film agents.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/projects", async (req, res) => {
  try {
    res.json({ ok: true, projects: await listProjects(req.user) });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Unable to read film projects.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/film/projects", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const prompt = String(req.body?.prompt || title).trim();

  try {
    const project = await createProject({ title, prompt, ownerUserId: req.user.id });
    res.status(201).json({ ok: true, project });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Unable to create project.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.patch("/api/film/projects/:projectId", async (req, res) => {
  const projectId = String(req.params.projectId || "").trim();
  const name = String(req.body?.name || req.body?.title || "").trim();
  if (!name) {
    res.status(400).json({ ok: false, error: "name is required." });
    return;
  }

  try {
    const oldProjectId = await resolveProjectId(projectId);
    await requireProjectAccess(oldProjectId, req.user);
    const project = await renameProject(oldProjectId, name);
    res.json({ ok: true, oldProjectId, projectId: project.id, project });
  } catch (error) {
    res.status(error?.status || 500).json({
      ok: false,
      error: "Unable to rename project.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/projects/:projectId/documents", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    await requireProjectAccess(projectId, req.user);
    res.json({ ok: true, projectId, documents: await getProjectDocuments(projectId) });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Unable to read project documents.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/projects/:projectId/workflow", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    await requireProjectAccess(projectId, req.user);
    res.json({ ok: true, projectId, workflow: await getProjectWorkflowState(projectId) });
  } catch (error) {
    res.status(error?.status || 500).json({
      ok: false,
      error: "Unable to read project workflow.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/projects/:projectId/files/*relativePath", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    const relativePath = Array.isArray(req.params.relativePath)
      ? req.params.relativePath.join("/")
      : String(req.params.relativePath || "").trim();
    await requireProjectAccess(projectId, req.user);
    res.json({ ok: true, file: await getProjectFile(projectId, relativePath) });
  } catch (error) {
    res.status(error?.status || 500).json({
      ok: false,
      error: "Unable to read project file.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.put("/api/film/projects/:projectId/files/*relativePath", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    const relativePath = Array.isArray(req.params.relativePath)
      ? req.params.relativePath.join("/")
      : String(req.params.relativePath || "").trim();
    const content = String(req.body?.content || "");
    await requireProjectAccess(projectId, req.user);
    res.json({ ok: true, file: await saveProjectFile(projectId, relativePath, content) });
  } catch (error) {
    res.status(error?.status || 500).json({
      ok: false,
      error: "Unable to save project file.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/projects/:projectId/assets", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    await requireProjectAccess(projectId, req.user);
    res.json({ ok: true, projectId, assets: await getProjectAssets(projectId) });
  } catch (error) {
    res.status(error?.status || 500).json({
      ok: false,
      error: "Unable to read project assets.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/film/projects/:projectId/assets/actions", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    const action = String(req.body?.action || "regenerate").trim();
    const type = String(req.body?.type || "image").trim();
    const relativePath = String(req.body?.relativePath || "").trim();
    const secondRelativePath = String(req.body?.secondRelativePath || "").trim();
    const prompt = String(req.body?.prompt || "").trim();
    await requireProjectAccess(projectId, req.user);
    const asset = await createAssetVersion({ projectId, action, type, relativePath, secondRelativePath, prompt });
    res.status(201).json({ ok: true, projectId, asset, assets: await getProjectAssets(projectId) });
  } catch (error) {
    res.status(error?.status || 500).json({
      ok: false,
      error: "Unable to create asset version.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/projects/:projectId/assets/*relativePath", async (req, res) => {
  try {
    const projectId = await requireProjectAccess(String(req.params.projectId || "").trim(), req.user);
    const relativePath = Array.isArray(req.params.relativePath)
      ? req.params.relativePath.join("/")
      : String(req.params.relativePath || "").trim();
    const projectPath = resolveInside(projectsRoot, projectId);
    const assetPath = resolveInside(projectPath, relativePath);
    res.sendFile(assetPath);
  } catch (error) {
    res.status(error?.status || 404).json({
      ok: false,
      error: "Unable to read project asset.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/agents/memory", async (_req, res) => {
  try {
    res.json({ ok: true, agents: await getAgentMemoryAndSkills() });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Unable to read agent memory and skills.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/runs", async (_req, res) => {
  try {
    const projectId = String(_req.query.project || "").trim();
    res.json({ ok: true, runs: await getRecentRuns(20, projectId, _req.user) });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Unable to read film runs.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/runs/:runId", async (req, res) => {
  try {
    res.json({ ok: true, run: await getRunDetailForUser(String(req.params.runId || "").trim(), req.user) });
  } catch (error) {
    res.status(error?.status || 500).json({
      ok: false,
      error: "Unable to read film run.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/api/film/jobs/:jobId", async (req, res) => {
  cleanupFilmTaskJobs();
  const jobId = String(req.params.jobId || "").trim();
  const job = filmTaskJobs.get(jobId);
  if (!job || job.ownerUserId !== req.user.id) {
    res.status(404).json({ ok: false, error: "Film task job not found." });
    return;
  }
  res.json(publicFilmTaskJob(job));
});

app.post("/api/film/task", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  const requestedProjectId = String(req.body?.projectId || "").trim();

  if (!prompt) {
    res.status(400).json({ ok: false, error: "Prompt is required." });
    return;
  }
  if (!requestedProjectId) {
    res.status(400).json({ ok: false, error: "projectId is required. Select or create a project before starting a run." });
    return;
  }

  try {
    if (req.body?.background === true) {
      res.status(202).json(startFilmTaskJob({ prompt, requestedProjectId, account: req.user }));
      return;
    }
    res.json(await processFilmTask({ prompt, requestedProjectId, account: req.user }));
  } catch (error) {
    const failedTask = error?.filmTask || null;
    res.status(error?.status || 502).json({
      ok: false,
      error: "Film task failed.",
      detail: error instanceof Error ? error.message : String(error),
      projectId: failedTask?.projectId || requestedProjectId || null,
      runId: failedTask?.runId || null,
      run: error?.filmRun || null,
      parentRunId: failedTask?.parentRunId || null,
      route: failedTask?.route || null,
      files: failedTask?.files || [],
      status: failedTask?.status || null,
      events: failedTask?.events || [],
      thread: failedTask?.thread || [],
      threadEvents: failedTask?.threadEvents || [],
      agentWork: failedTask?.agentWork || []
    });
  }
});

app.post("/api/film/runs/:runId/continue", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  const requestedProjectId = String(req.body?.projectId || "").trim();
  const parentRunId = String(req.params.runId || "").trim();

  if (!prompt) {
    res.status(400).json({ ok: false, error: "Prompt is required." });
    return;
  }
  if (!requestedProjectId) {
    res.status(400).json({ ok: false, error: "projectId is required. Continue run must stay inside a selected project." });
    return;
  }

  try {
    if (req.body?.background === true) {
      res.status(202).json(startFilmTaskJob({ prompt, requestedProjectId, parentRunId, account: req.user }));
      return;
    }
    res.json(await processFilmTask({ prompt, requestedProjectId, parentRunId, account: req.user }));
  } catch (error) {
    const failedTask = error?.filmTask || null;
    res.status(error?.status || 502).json({
      ok: false,
      error: "Film continue task failed.",
      detail: error instanceof Error ? error.message : String(error),
      projectId: failedTask?.projectId || requestedProjectId || null,
      runId: failedTask?.runId || null,
      run: error?.filmRun || null,
      parentRunId: failedTask?.parentRunId || parentRunId,
      route: failedTask?.route || null,
      files: failedTask?.files || [],
      status: failedTask?.status || null,
      events: failedTask?.events || [],
      thread: failedTask?.thread || [],
      threadEvents: failedTask?.threadEvents || [],
      agentWork: failedTask?.agentWork || []
    });
  }
});

async function backfillConversationArchives(limit = 200) {
  const runs = await getRecentRuns(limit);
  for (const run of [...runs].reverse()) {
    const detail = await getRunDetail(run.id).catch(() => null);
    if (detail) await writeConversationArchive(detail);
  }
}

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

await backfillConversationArchives().catch((error) => {
  console.warn("Unable to backfill conversation archives:", error instanceof Error ? error.message : String(error));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Film Studio listening on http://0.0.0.0:${port}`);
});
