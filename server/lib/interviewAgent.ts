/**
 * Interview agent logic, memoir book generation, JSON parsing, and normalization.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NanoPencilRpcClient } from "../nanopencil-rpc.js";

type Turn = { role: "agent" | "elder"; content: string };
type Session = { turns: Turn[]; readiness: number };
type BookDraft = {
  title: string;
  subtitle: string;
  soulSentence?: string;
  chapters: Array<{ title: string; summary: string; contentMarkdown?: string }>;
  excerpt: string;
  pipeline?: { package: string; version: string; mode: string };
};

const memoirSkillPackage = "memoir-book-pipeline-skill";
const memoirSkillVersion = "1.1.0";
const memoirSkillPath = resolve(process.cwd(), "node_modules/memoir-book-pipeline-skill/SKILL.md");
const memoirSkillSource = existsSync(memoirSkillPath) ? readFileSync(memoirSkillPath, "utf8") : "";

export { memoirSkillSource, memoirSkillPackage, memoirSkillVersion };

export function memoirInterviewSystemPrompt() {
  return [
    "You are the interview agent for Membook, a life memoir product for elders.",
    "Your job is not coding in this context.",
    "Interview gently, ask one concise follow-up question at a time, and preserve concrete details.",
    'When asked by the API adapter, return strict JSON matching: {"question": string, "readiness": number, "insights": [{"label": string, "value": string}]}',
  ].join("\n");
}

export function localInterview(session: Session, answer: string) {
  const readiness = Math.min(100, (session.readiness ?? 10) + 14);
  const hasChinese = /[\u4e00-\u9fff]/.test(answer);
  const peopleHint = extractAfter(answer, hasChinese ? ["妈妈", "爸爸", "老师", "朋友", "爷爷", "奶奶"] : ["mother", "father", "teacher", "friend", "grandfather", "grandmother"]);
  const placeHint = extractPlace(answer, hasChinese);
  const question = hasChinese
    ? "这段记忆里有没有一个具体的画面、声音或气味？请慢慢讲给我听。"
    : "Is there a specific image, sound, or smell in this memory? Please tell me slowly.";

  return {
    question,
    readiness,
    insights: [
      { label: hasChinese ? "重要人物" : "Key people", value: peopleHint },
      { label: hasChinese ? "重要地点" : "Key places", value: placeHint },
      { label: hasChinese ? "情感线索" : "Emotional arc", value: hasChinese ? "怀旧、亲密、细节待加深" : "Nostalgic, intimate, needs richer detail" },
    ],
  };
}

export async function generateMemoirBook(session: Session, nanoPencilRpc: NanoPencilRpcClient | null): Promise<BookDraft> {
  if (!nanoPencilRpc || !memoirSkillSource) {
    return localBookDraft(session, nanoPencilRpc ? "local-fallback-no-skill" : "local-fallback-no-agent");
  }
  try {
    const text = await nanoPencilRpc.promptAndWait(buildMemoirPipelinePrompt(session));
    return normalizeBookDraft(parseBookJson(text), session, "nanopencil-rpc");
  } catch {
    return localBookDraft(session, "local-fallback-agent-error");
  }
}

export function processRpcResponse(text: string, session: Session, answer: string) {
  const parsed = parseAgentJson(text);
  const hasChinese = /[\u4e00-\u9fff]/.test(answer);
  return {
    question: parsed.question ?? parsed.nextQuestion ?? text.trim() ?? (hasChinese ? "这段经历里，您最想让家人记住的细节是什么？" : "What detail from this memory should your family remember?"),
    readiness: clampReadiness(parsed.readiness, session.readiness),
    insights: normalizeInsights(parsed.insights, hasChinese),
  };
}

function buildMemoirPipelinePrompt(session: Session) {
  const transcript = session.turns.map((turn) => `${turn.role === "agent" ? "访谈助手" : "长辈"}：${turn.content}`).join("\n");
  const elderText = session.turns.filter((turn) => turn.role === "elder").map((turn) => turn.content).join("\n\n");
  const hasChinese = /[\u4e00-\u9fff]/.test(transcript);

  return [
    "你现在要执行 npm 包 memoir-book-pipeline-skill 的回忆录成书流水线。",
    "必须遵守该技能的核心顺序：原始访谈 -> story-extractor 记忆碎片 -> narrative-architect 全书骨架 -> prose-writer 逐章第一人称散文 -> book-renderer 可读书稿。",
    "不要跳过碎片提取；不要编造访谈中没有的具体事实；素材不足时诚实写成素描版。",
    "以下是已安装技能包的说明节选，作为生成规范：",
    memoirSkillSource.slice(0, 5200),
    "",
    "请基于下面的原始访谈，输出严格 JSON，不要 Markdown 围栏，不要额外说明。",
    "JSON schema:",
    JSON.stringify({
      title: hasChinese ? "书名" : "Book title",
      subtitle: hasChinese ? "副标题" : "Subtitle",
      soulSentence: hasChinese ? "只属于这位长辈的一句话" : "A sentence unique to this person",
      chapters: [{ title: hasChinese ? "章节标题" : "Chapter title", summary: hasChinese ? "章节摘要" : "Chapter summary", contentMarkdown: hasChinese ? "# 章节标题\n\n第一人称散文正文。" : "# Chapter title\n\nFirst-person prose." }],
      excerpt: hasChinese ? "全书摘录" : "Book excerpt",
    }),
    "",
    `约束：章节数 3-6 章；每章必须有 contentMarkdown；正文用第一人称\u201c我\u201d；尽量保留口述质感；如果语料很少，每章 150-500 字即可。`,
    "",
    "原始访谈：",
    transcript || elderText || "(empty)",
  ].join("\n");
}

function buildInterviewPrompt(session: Session, answer: string) {
  const transcript = session.turns.slice(-10).map((turn) => `${turn.role === "agent" ? "Interviewer" : "Elder"}: ${turn.content}`).join("\n");
  return [
    "You are conducting an oral-history interview with an elder to help create a family memoir.",
    "Use the same language as the elder's latest answer.",
    "Ask exactly one warm, specific follow-up question.",
    "Do not write the book yet.",
    'Return only valid JSON with this schema: {"question":"...","readiness":0,"insights":[{"label":"重要人物/Key people","value":"..."},{"label":"重要地点/Key places","value":"..."},{"label":"情感线索/Emotional arc","value":"..."}]}',
    "",
    "Recent transcript:",
    transcript || "(empty)",
    "",
    `Latest elder answer: ${answer}`,
  ].join("\n");
}

function parseAgentJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned) as { question?: string; nextQuestion?: string; readiness?: unknown; insights?: unknown }; }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]) as { question?: string; nextQuestion?: string; readiness?: unknown; insights?: unknown }; }
    catch { return {}; }
  }
}

function parseBookJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned) as unknown; }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]) as unknown; }
    catch { return {}; }
  }
}

function normalizeBookDraft(value: unknown, session: Session, mode: string): BookDraft {
  const fallback = localBookDraft(session, mode);
  if (!value || typeof value !== "object") return fallback;

  const record = value as { title?: unknown; book_title?: unknown; subtitle?: unknown; book_subtitle?: unknown; soulSentence?: unknown; soul_sentence?: unknown; excerpt?: unknown; chapters?: unknown };
  const chapters = Array.isArray(record.chapters)
    ? record.chapters
        .filter((c) => c && typeof c === "object")
        .map((chapter, index) => {
          const item = chapter as { title?: unknown; summary?: unknown; contentMarkdown?: unknown; content_markdown?: unknown };
          const title = String(item.title ?? `${index + 1}`);
          const contentMarkdown = String(item.contentMarkdown ?? item.content_markdown ?? item.summary ?? "").trim();
          return { title, summary: String(item.summary ?? contentMarkdown.slice(0, 180) ?? ""), contentMarkdown };
        })
        .filter((c) => c.title && (c.summary || c.contentMarkdown))
        .slice(0, 8)
    : [];

  return {
    title: String(record.title ?? record.book_title ?? fallback.title),
    subtitle: String(record.subtitle ?? record.book_subtitle ?? fallback.subtitle),
    soulSentence: String(record.soulSentence ?? record.soul_sentence ?? fallback.soulSentence ?? ""),
    chapters: chapters.length > 0 ? chapters : fallback.chapters,
    excerpt: String(record.excerpt ?? fallback.excerpt),
    pipeline: { package: memoirSkillPackage, version: memoirSkillVersion, mode },
  };
}

function clampReadiness(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  const minimum = Math.min(100, (fallback ?? 10) + 8);
  if (!Number.isFinite(parsed)) return Math.min(100, (fallback ?? 10) + 14);
  return Math.max(minimum, Math.min(100, Math.round(parsed)));
}

function normalizeInsights(value: unknown, hasChinese: boolean) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === "object")
      .map((item) => ({ label: String((item as { label?: unknown }).label ?? ""), value: String((item as { value?: unknown }).value ?? "") }))
      .filter((item) => item.label && item.value)
      .slice(0, 3);
  }
  return [
    { label: hasChinese ? "重要人物" : "Key people", value: hasChinese ? "继续追问" : "Needs follow-up" },
    { label: hasChinese ? "重要地点" : "Key places", value: hasChinese ? "继续追问" : "Needs follow-up" },
    { label: hasChinese ? "情感线索" : "Emotional arc", value: hasChinese ? "温和回忆" : "Gentle reminiscence" },
  ];
}

function localBookDraft(session: Session, mode = "local-fallback"): BookDraft {
  const elderText = session.turns.filter((turn) => turn.role === "elder").map((turn) => turn.content);
  const hasChinese = elderText.some((text) => /[\u4e00-\u9fff]/.test(text));
  const firstMemory = elderText[0] ?? (hasChinese ? "等待更多语料。" : "More source material needed.");
  const secondMemory = elderText[1] ?? (hasChinese ? "将在后续访谈中补全。" : "To be completed in later interviews.");
  const thirdMemory = elderText[2] ?? (hasChinese ? "等待老人讲述。" : "Awaiting the elder's words.");

  return {
    title: hasChinese ? "我的一生，慢慢说给你听" : "A Life, Told Slowly",
    subtitle: hasChinese ? "基于口述访谈整理的初稿" : "A first draft shaped from oral interviews",
    soulSentence: hasChinese ? "那些被慢慢说出的日子，会成为家里最温柔的灯。" : "The days told slowly become a light the family can keep.",
    chapters: [
      { title: hasChinese ? "第一章：最初的家" : "Chapter 1: The First Home", summary: firstMemory, contentMarkdown: `${hasChinese ? "# 第一章：最初的家" : "# Chapter 1: The First Home"}\n\n${firstMemory}` },
      { title: hasChinese ? "第二章：那些重要的人" : "Chapter 2: The People Who Mattered", summary: secondMemory, contentMarkdown: `${hasChinese ? "# 第二章：那些重要的人" : "# Chapter 2: The People Who Mattered"}\n\n${secondMemory}` },
      { title: hasChinese ? "第三章：留给家人的话" : "Chapter 3: What I Leave With You", summary: thirdMemory, contentMarkdown: `${hasChinese ? "# 第三章：留给家人的话" : "# Chapter 3: What I Leave With You"}\n\n${thirdMemory}` },
    ],
    excerpt: elderText.join("\n\n"),
    pipeline: { package: memoirSkillPackage, version: memoirSkillVersion, mode },
  };
}

function extractAfter(text: string, needles: string[]) {
  const found = needles.find((needle) => text.toLowerCase().includes(needle.toLowerCase()));
  return found ?? (/[\u4e00-\u9fff]/.test(text) ? "已出现家庭/关系线索" : "Family or relationship clues present");
}

function extractPlace(text: string, hasChinese: boolean) {
  const match = hasChinese ? text.match(/[^\s，。,.]{1,8}(村|镇|城|市|县|街|路|学校|家)/) : text.match(/\b(home|school|village|town|city|street|farm|house)\b/i);
  return match?.[0] ?? (hasChinese ? "地点线索待追问" : "Place details need follow-up");
}
