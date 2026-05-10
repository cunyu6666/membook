/**
 * [WHO]: 提供核心业务类型定义：InterviewTurn, InterviewSession, AgentInterviewResponse, BookDraft, ApiStatus
 * [FROM]: 无外部依赖，纯TypeScript类型定义
 * [TO]: 被App.tsx、agentClient.ts、server/index.ts消费
 * [HERE]: src/lib/types.ts，前端与服务端共享的类型契约
 */
export type InterviewTurn = {
  id: string;
  role: "agent" | "elder";
  content: string;
  createdAt: string;
};

export type InterviewInsight = {
  label: string;
  value: string;
};

export type CoverStyle = "linen" | "ink" | "album";

export type PhotoMemory = {
  id: string;
  imageDataUrl: string;
  fileName: string;
  description: string;
  aiObservation: string;
  story: string;
  createdAt: string;
};

export type InterviewSession = {
  id: string;
  turns: InterviewTurn[];
  insights: InterviewInsight[];
  readiness: number;
  photos?: PhotoMemory[];
  isPaid?: boolean;
};

export type AgentInterviewResponse = {
  question: string;
  insights: InterviewInsight[];
  readiness: number;
};

export type BookDraft = {
  title: string;
  subtitle: string;
  soulSentence?: string;
  coverStyle?: CoverStyle;
  chapters: Array<{
    title: string;
    summary: string;
    contentMarkdown?: string;
  }>;
  excerpt: string;
  pipeline?: {
    package: string;
    version: string;
    mode: string;
  };
};

export type ApiStatus = {
  mode: "acp" | "rpc" | "command" | "local";
  acpUrl?: string;
  cliPath?: string;
  asrModel: string;
  asrFiletransModel?: string;
  asrEndpoint: string;
  ttsModel?: string;
  ttsEndpoint?: string;
  memoirPipeline?: string;
};
