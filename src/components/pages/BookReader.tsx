/**
 * [WHO]: 提供 BookReader回忆录阅读器、HistoryDialog历史管理、SettingsDialog设置、ImportDialog导入等组件
 * [FROM]: 依赖 UI 组件库、lib模块 (bookFormat, types, i18n, session)、react-router-dom
 * [TO]: 被 StudioPage.tsx 和 App.tsx 路由消费，用于回忆录展示和系统配置
 * [HERE]: src/components/pages/BookReader.tsx，回忆录阅读与系统对话框集合
 */
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { cn } from "../../lib/utils";
import { buildBookPages, markdownToPlainText } from "../../lib/bookFormat";
import type { BookDraft } from "../../lib/types";
import type { Locale } from "../../lib/i18n";
import { copy } from "../../lib/i18n";
import type { SavedMemoir } from "../../lib/session";
import type { ApiStatus } from "../../lib/types";

/* ─── Book Reader ─── */

export function BookReader({
  book,
  locale,
  onClose,
}: {
  book: BookDraft;
  locale: Locale;
  onClose: () => void;
}) {
  const pages = buildBookPages(book, locale);
  const [pageIndex, setPageIndex] = useState(0);
  const left = pages[pageIndex];
  const right = pages[pageIndex + 1];

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-[radial-gradient(circle_at_50%_18%,oklch(var(--primary)/0.18),transparent_30rem),oklch(var(--foreground)/0.42)] px-4 py-5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Badge className="bg-card/80">
          {book.pipeline
            ? `${book.pipeline.package}@${book.pipeline.version}`
            : locale === "zh"
              ? "回忆录"
              : "Memoir"}
        </Badge>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPageIndex((value) => Math.max(0, value - 2))}
            disabled={pageIndex === 0}
          >
            <i className="ri-arrow-left-s-line" />
            {locale === "zh" ? "上一页" : "Previous"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPageIndex((value) => Math.min(pages.length - 1, value + 2))}
            disabled={pageIndex >= pages.length - 2}
          >
            {locale === "zh" ? "下一页" : "Next"}
            <i className="ri-arrow-right-s-line" />
          </Button>
          <Button variant="secondary" size="icon" onClick={onClose}>
            <i className="ri-close-line" />
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-6xl [perspective:1800px]">
        <div className="relative grid min-h-[72vh] gap-0 rounded-lg bg-[#3b261a] p-4 shadow-[0_42px_140px_hsl(25_30%_4%/0.45)] md:grid-cols-2">
          <BookPage page={left} side="left" />
          <BookPage page={right} side="right" />
          <div className="pointer-events-none absolute inset-y-4 left-1/2 hidden w-8 -translate-x-1/2 bg-gradient-to-r from-black/24 via-white/16 to-black/24 blur-sm md:block" />
        </div>
      </div>
    </div>
  );
}

function BookPage({
  page,
  side,
}: {
  page?: { title: string; body: string; kind: "cover" | "toc" | "chapter" | "back" };
  side: "left" | "right";
}) {
  if (!page) {
    return <div className="hidden md:block" />;
  }

  return (
    <section
      className={cn(
        "relative min-h-[34rem] overflow-hidden bg-[#f8efd9] p-8 text-[#332414] shadow-inner",
        side === "left"
          ? "rounded-l-[1.5rem] md:[transform:rotateY(2deg)]"
          : "rounded-r-[1.5rem] md:[transform:rotateY(-2deg)]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.58),transparent_18rem),linear-gradient(90deg,rgba(0,0,0,0.12),transparent_12%,transparent_88%,rgba(0,0,0,0.08))]" />
      <div className="relative z-10 h-full">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8b6041]">
          {page.kind}
        </p>
        <h2 className="mt-4 font-serif-cn text-3xl font-bold leading-tight tracking-[-0.04em]">
          {page.title}
        </h2>
        <div className="mt-6 whitespace-pre-wrap font-serif-cn text-[1.02rem] leading-8">
          {page.body}
        </div>
      </div>
    </section>
  );
}

/* ─── History Dialog ─── */

export function HistoryDialog({
  history,
  locale,
  onClose,
  onLoad,
  onDelete,
  onNew,
}: {
  history: SavedMemoir[];
  locale: Locale;
  onClose: () => void;
  onLoad: (item: SavedMemoir) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const navigate = useNavigate();

  function handleOpenBook(item: SavedMemoir) {
    if (item.bookDraft) {
      navigate(`/book/${item.id}`);
    } else {
      onLoad(item);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/36 px-4 backdrop-blur-xl">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-card p-5 shadow-[0_32px_120px_hsl(220_30%_4%/0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge>{locale === "zh" ? "历史管理" : "History"}</Badge>
            <h3 className="mt-3 text-2xl font-bold tracking-[-0.04em]">
              {locale === "zh" ? "访谈与回忆录历史" : "Sessions and memoirs"}
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onNew();
                onClose();
              }}
            >
              <i className="ri-add-line" />
              {locale === "zh" ? "新建" : "New"}
            </Button>
            <Button variant="secondary" size="icon" onClick={onClose}>
              <i className="ri-close-line" />
            </Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {history.length === 0 ? (
            <p className="rounded-lg border border-border bg-background/44 p-5 text-sm text-muted-foreground">
              {locale === "zh" ? "还没有历史记录。完成一次访谈或生成书稿后会自动保存。" : "No history yet. Sessions are saved after an interview or book generation."}
            </p>
          ) : (
            history.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 rounded-lg border border-border bg-background/44 p-4 sm:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.updatedAt).toLocaleString()} · {item.session.turns.length} turns · {item.bookDraft ? (locale === "zh" ? "已有书稿" : "Book ready") : (locale === "zh" ? "未成书" : "No book yet")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {item.bookDraft ? (
                    <Button variant="secondary" size="sm" onClick={() => handleOpenBook(item)}>
                      <i className="ri-book-open-line" />
                      {locale === "zh" ? "看这本书" : "Read"}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => onLoad(item)}>
                      <i className="ri-folder-open-line" />
                      {locale === "zh" ? "加载" : "Load"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
                    <i className="ri-delete-bin-line" />
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Settings Dialog ─── */

export function SettingsDialog({
  apiStatus,
  bailianApiKey,
  bailianEndpoint,
  bailianAsrModel,
  bailianTtsEndpoint,
  bailianTtsModel,
  ttsVoice,
  isDark,
  t,
  locale,
  onClose,
  onToggleTheme,
  onToggleLocale,
  onBailianApiKeyChange,
  onBailianEndpointChange,
  onBailianAsrModelChange,
  onBailianTtsEndpointChange,
  onBailianTtsModelChange,
  onTtsVoiceChange,
  onResetVoiceDefaults,
}: {
  apiStatus: ApiStatus | null;
  bailianApiKey: string;
  bailianEndpoint: string;
  bailianAsrModel: string;
  bailianTtsEndpoint: string;
  bailianTtsModel: string;
  ttsVoice: string;
  isDark: boolean;
  locale: Locale;
  t: Record<string, string>;
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onBailianApiKeyChange: (value: string) => void;
  onBailianEndpointChange: (value: string) => void;
  onBailianAsrModelChange: (value: string) => void;
  onBailianTtsEndpointChange: (value: string) => void;
  onBailianTtsModelChange: (value: string) => void;
  onTtsVoiceChange: (value: string) => void;
  onResetVoiceDefaults: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/36 px-4 backdrop-blur-xl">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-card p-5 shadow-[0_32px_120px_hsl(220_30%_4%/0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge>{t.settingsTitle}</Badge>
            <h3 className="mt-3 text-2xl font-bold tracking-[-0.04em]">
              {t.settingsTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t.settingsDesc}
            </p>
          </div>
          <Button variant="secondary" size="icon" onClick={onClose} aria-label={t.close}>
            <i className="ri-close-line" />
          </Button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-lg border border-border bg-background/42 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t.connectionStatus}
            </p>
            <ConnectionLine
              items={[
                { label: t.connService, active: Boolean(apiStatus) },
                {
                  label: t.connAssistant,
                  active: apiStatus?.mode === "rpc" || apiStatus?.mode === "acp",
                },
                { label: t.connRecognition, active: Boolean(bailianApiKey && bailianEndpoint) },
                { label: t.connReading, active: Boolean(bailianApiKey && bailianTtsEndpoint) },
                { label: locale === "zh" ? "成书" : "Book", active: Boolean(apiStatus?.memoirPipeline) },
              ]}
            />
          </div>

          <div className="rounded-lg border border-border bg-background/42 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t.interface}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={onToggleLocale}>
                {t.language}
              </Button>
              <Button variant="secondary" size="sm" onClick={onToggleTheme}>
                <i className={isDark ? "ri-sun-line" : "ri-moon-line"} />
                {t.theme}
              </Button>
              <Button variant="secondary" size="sm" onClick={onResetVoiceDefaults}>
                {locale === "zh" ? "恢复语音默认" : "Reset voice"}
              </Button>
            </div>
          </div>

          <Field
            label={t.bailianKey}
            type="password"
            value={bailianApiKey}
            placeholder={t.bailianKeyPlaceholder}
            onChange={onBailianApiKeyChange}
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_0.72fr]">
            <Field
              label={t.bailianEndpoint}
              value={bailianEndpoint}
              onChange={onBailianEndpointChange}
            />
            <Field
              label={t.asrModel}
              value={bailianAsrModel}
              onChange={onBailianAsrModelChange}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_0.72fr]">
            <Field
              label={t.ttsEndpoint}
              value={bailianTtsEndpoint}
              onChange={onBailianTtsEndpointChange}
            />
            <Field
              label={t.ttsModel}
              value={bailianTtsModel}
              onChange={onBailianTtsModelChange}
            />
          </div>

          <Field label={t.ttsVoice} value={ttsVoice} onChange={onTtsVoiceChange} />
        </div>
      </div>
    </div>
  );
}

/* ─── Field ─── */

export function Field({
  label,
  value,
  onChange,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  type?: string;
  placeholder?: string;
}) {
  const controlledProps =
    value === undefined
      ? {}
      : {
          value,
          onChange: (event: ChangeEvent<HTMLInputElement>) =>
            onChange?.(event.target.value),
        };

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        name={name}
        type={type}
        placeholder={placeholder}
        {...controlledProps}
      />
    </label>
  );
}

/* ─── Metric ─── */

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/50 p-3">
      <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-bold">{value}</p>
    </div>
  );
}

/* ─── Connection Line ─── */

export function ConnectionLine({
  items,
}: {
  items: Array<{ label: string; active: boolean }>;
}) {
  return (
    <div className="flex items-center">
      {items.map((item, index) => (
        <div key={item.label} className="flex flex-1 items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "h-2 w-2 rounded-full border-2 transition-colors",
                item.active
                  ? "border-green-500 bg-green-500"
                  : "border-muted-foreground/30 bg-background",
              )}
            />
            <span className="mt-1 truncate text-[0.5rem] font-medium text-muted-foreground">
              {item.label}
            </span>
          </div>
          {index < items.length - 1 && (
            <div
              className={cn(
                "mx-0.5 h-px flex-1 border-b border-dashed transition-colors",
                item.active && items[index + 1]?.active
                  ? "border-green-500"
                  : "border-border/40",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Import Dialog ─── */

export function ImportDialog({
  locale,
  onClose,
  onImport,
}: {
  locale: Locale;
  onClose: () => void;
  onImport: (content: string) => void;
}) {
  const [text, setText] = useState("");
  const t = copy[locale];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onImport(text.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/36 px-4 backdrop-blur-xl">
      <Card className="w-full max-w-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge>{locale === "zh" ? "导入" : "Import"}</Badge>
            <h3 className="mt-3 text-xl font-bold tracking-[-0.04em]">
              {locale === "zh" ? "导入对话记录" : "Import Conversation"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {locale === "zh"
                ? "粘贴任意格式的访谈文本——聊天记录、录音转写、口述笔记，AI 会自动识别角色和问答。"
                : "Paste any interview text — chat logs, transcriptions, oral notes. AI will auto-detect speakers and Q&A."}
            </p>
          </div>
          <Button variant="secondary" size="icon" onClick={onClose} aria-label={String(t.close)}>
            <i className="ri-close-line" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              locale === "zh"
                ? "可以直接粘贴微信聊天记录、访谈逐字稿、或任何口述文本..."
                : "Paste WeChat chat logs, interview transcripts, or any oral text..."
            }
            className="min-h-48 resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button type="submit" disabled={!text.trim()}>
            {locale === "zh" ? "生成回忆录" : "Generate Memoir"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
