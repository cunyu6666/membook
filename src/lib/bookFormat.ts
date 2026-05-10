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
  const pages = [
    {
      kind: "cover" as const,
      title: book.title,
      body: [book.subtitle, book.soulSentence].filter(Boolean).join("\n\n"),
      continued: false,
    },
    ...paginateSection(locale === "zh" ? "目录" : "Contents", toc, "toc", locale, 520, 650),
    ...book.chapters.flatMap((chapter) =>
      paginateSection(
        chapter.title,
        markdownToPlainText(chapter.contentMarkdown || chapter.summary),
        "chapter",
        locale,
        430,
        560,
      )
    ),
    ...paginateSection(
      locale === "zh" ? "留给家人的话" : "For the family",
      book.excerpt || book.soulSentence || "",
      "back",
      locale,
      470,
      620,
    ),
  ];
  return pages;
}

function paginateSection(
  title: string,
  body: string,
  kind: "toc" | "chapter" | "back",
  locale: Locale,
  firstLimit: number,
  nextLimit: number,
) {
  const chunks = splitTextToPages(body, firstLimit, nextLimit);
  return [
    ...chunks.map((chunk, index) => ({
      kind,
      title: index === 0 ? title : `${title}${locale === "zh" ? "（续）" : " (continued)"}`,
      body: chunk,
      continued: index > 0,
    })),
  ] as Array<{ kind: typeof kind; title: string; body: string; continued: boolean }>;
}

function splitTextToPages(text: string, firstLimit: number, nextLimit: number) {
  const clean = text.trim();
  if (!clean) return [""];
  const units = splitIntoTextUnits(clean);
  const pages: string[] = [];
  let limit = firstLimit;
  let buffer: string[] = [];
  let weight = 0;

  for (const unit of units) {
    const unitWeight = textWeight(unit);
    if (buffer.length > 0 && weight + unitWeight > limit) {
      pages.push(buffer.join("").trim());
      buffer = [];
      weight = 0;
      limit = nextLimit;
    }
    if (unitWeight > limit) {
      for (const part of splitLongUnit(unit, limit)) {
        if (buffer.length > 0) {
          pages.push(buffer.join("").trim());
          buffer = [];
          weight = 0;
          limit = nextLimit;
        }
        pages.push(part.trim());
        limit = nextLimit;
      }
      continue;
    }
    buffer.push(unit);
    weight += unitWeight;
  }

  if (buffer.length > 0) pages.push(buffer.join("").trim());
  return pages.filter(Boolean);
}

function splitIntoTextUnits(text: string) {
  const normalized = text.replace(/\n{3,}/g, "\n\n");
  const units: string[] = [];
  for (const paragraph of normalized.split(/(\n\n+)/)) {
    if (!paragraph) continue;
    if (/^\n+$/.test(paragraph)) {
      units.push(paragraph);
      continue;
    }
    const sentences = paragraph.match(/[^。！？.!?\n]+[。！？.!?]?|\n/g);
    units.push(...(sentences ?? [paragraph]));
  }
  return units;
}

function splitLongUnit(unit: string, limit: number) {
  const parts: string[] = [];
  let current = "";
  let weight = 0;
  for (const char of Array.from(unit)) {
    const charWeight = textWeight(char);
    if (current && weight + charWeight > limit) {
      parts.push(current);
      current = "";
      weight = 0;
    }
    current += char;
    weight += charWeight;
  }
  if (current) parts.push(current);
  return parts;
}

function textWeight(text: string) {
  let weight = 0;
  for (const char of Array.from(text)) {
    if (char === "\n") weight += 18;
    else if (/[\u4e00-\u9fff]/.test(char)) weight += 1;
    else if (/\s/.test(char)) weight += 0.28;
    else weight += 0.56;
  }
  return weight;
}

export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^#\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^---[\s\S]*$/m, "")
    .trim();
}
