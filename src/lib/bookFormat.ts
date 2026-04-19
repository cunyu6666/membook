/**
 * [WHO]: 提供 buildBookPages, markdownToPlainText, extractExcerpt 函数
 * [FROM]: 依赖 types, i18n
 * [TO]: 被 BookReader.tsx, BookReaderPage.tsx 消费
 * [HERE]: src/lib/，书稿格式化工具模块
 */
import type { BookDraft } from "./types";
import type { Locale } from "./i18n";

export function buildBookPages(book: BookDraft, locale: Locale) {
  const toc = book.chapters
    .map((chapter, index) => `${index + 1}. ${chapter.title}`)
    .join("\n");
  return [
    {
      kind: "cover" as const,
      title: book.title,
      body: [book.subtitle, book.soulSentence].filter(Boolean).join("\n\n"),
    },
    {
      kind: "toc" as const,
      title: locale === "zh" ? "目录" : "Contents",
      body: toc,
    },
    ...book.chapters.map((chapter) => ({
      kind: "chapter" as const,
      title: chapter.title,
      body: markdownToPlainText(chapter.contentMarkdown || chapter.summary),
    })),
    {
      kind: "back" as const,
      title: locale === "zh" ? "留给家人的话" : "For the family",
      body: book.excerpt || book.soulSentence || "",
    },
  ];
}

export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^#\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^---[\s\S]*$/m, "")
    .trim();
}
