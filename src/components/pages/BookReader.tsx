/**
 * [WHO]: 提供 BookReader回忆录阅读器、HistoryDialog历史管理、SettingsDialog设置、ImportDialog导入等组件
 * [FROM]: 依赖 UI 组件库、lib模块 (bookFormat, types, i18n, session)、react-router-dom
 * [TO]: 被 StudioPage.tsx 和 App.tsx 路由消费，用于回忆录展示和系统配置
 * [HERE]: src/components/pages/BookReader.tsx，回忆录阅读与系统对话框集合
 */
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { cn } from "../../lib/utils";
import { buildBookPages } from "../../lib/bookFormat";
import type { BookDraft, CoverStyle } from "../../lib/types";
import type { Locale, CopyKeys } from "../../lib/i18n";
import { copy } from "../../lib/i18n";
import type { SavedMemoir } from "../../lib/session";
import type { ApiStatus } from "../../lib/types";

/* ─── Book Reader ─── */

export function BookReader({
  book,
  locale,
  onClose,
  onChange,
}: {
  book: BookDraft;
  locale: Locale;
  onClose: () => void;
  onChange?: (book: BookDraft) => void;
}) {
  const pages = buildBookPages(book, locale);
  const spreadRef = useRef<HTMLDivElement | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 360, height: 509 });
  const [flipSheet, setFlipSheet] = useState<{
    direction: "next" | "prev";
    page: ReturnType<typeof buildBookPages>[number];
  } | null>(null);
  const coverStyle = book.coverStyle ?? "linen";
  const left = pages[pageIndex];
  const right = pages[pageIndex + 1];
  const pageVars = {
    "--book-page-width": `${pageSize.width}px`,
    "--book-page-height": `${pageSize.height}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!flipSheet) return;
    const timer = window.setTimeout(() => setFlipSheet(null), 620);
    return () => window.clearTimeout(timer);
  }, [flipSheet, pageIndex]);

  useEffect(() => {
    const spread = spreadRef.current;
    if (!spread) return;
    const measure = () => {
      const rect = spread.getBoundingClientRect();
      const isSinglePage = window.matchMedia("(max-width: 720px)").matches;
      const gap = isSinglePage ? 0 : 14.4;
      const maxPageWidth = isSinglePage ? rect.width : (rect.width - gap) / 2;
      const width = Math.max(180, Math.min(maxPageWidth, rect.height * 210 / 297));
      const height = width * 297 / 210;
      setPageSize((current) =>
        Math.abs(current.width - width) > 0.5 || Math.abs(current.height - height) > 0.5
          ? { width, height }
          : current
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(spread);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  function turnPage(direction: "next" | "prev") {
    const nextIndex = direction === "next"
      ? Math.min(pages.length - 1, pageIndex + 2)
      : Math.max(0, pageIndex - 2);
    if (nextIndex === pageIndex) return;
    const turningPage = direction === "next" ? pages[pageIndex + 1] ?? pages[pageIndex] : pages[pageIndex];
    setFlipSheet({ direction, page: turningPage });
    setPageIndex(nextIndex);
  }

  function changeCoverStyle(style: CoverStyle) {
    onChange?.({ ...book, coverStyle: style });
  }

  return (
    <motion.div
      className="studio-reader-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="studio-reader-shell"
        initial={{ opacity: 0, y: 16, scale: 0.992 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.992 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="studio-reader-toolbar">
          <div>
            <span className="studio-eyebrow">{locale === "zh" ? "成书预览" : "Book preview"}</span>
            <strong>{book.title}</strong>
          </div>
          <div className="studio-reader-controls">
            <div className="studio-cover-switcher" aria-label={locale === "zh" ? "封面风格" : "Cover style"}>
              {(["linen", "ink", "album"] as CoverStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  className={style === coverStyle ? "is-active" : ""}
                  onClick={() => changeCoverStyle(style)}
                >
                  {style === "linen" ? (locale === "zh" ? "布纹" : "Linen") : style === "ink" ? (locale === "zh" ? "墨色" : "Ink") : (locale === "zh" ? "相册" : "Album")}
                </button>
              ))}
            </div>
            <nav>
              <button
                type="button"
                onClick={() => turnPage("prev")}
                disabled={pageIndex === 0}
              >
                <i className="ri-arrow-left-s-line" />
                {locale === "zh" ? "上一页" : "Previous"}
              </button>
              <span>{Math.floor(pageIndex / 2) + 1} / {Math.ceil(pages.length / 2)}</span>
              <button
                type="button"
                onClick={() => turnPage("next")}
                disabled={pageIndex >= pages.length - 2}
              >
                {locale === "zh" ? "下一页" : "Next"}
                <i className="ri-arrow-right-s-line" />
              </button>
              <button type="button" aria-label={locale === "zh" ? "关闭" : "Close"} onClick={onClose}>
                <i className="ri-close-line" />
              </button>
            </nav>
          </div>
        </header>

        <div className="studio-reader-meta">
          <span>{book.subtitle}</span>
          <span>{book.pipeline ? `${book.pipeline.package}@${book.pipeline.version}` : (locale === "zh" ? "星光回忆录" : "Starlight Memoir")}</span>
        </div>

        <div ref={spreadRef} className={cn("studio-book-spread", flipSheet && `is-turning-${flipSheet.direction}`)} style={pageVars}>
          <BookPage page={left} side="left" coverStyle={coverStyle} />
          <BookPage page={right} side="right" coverStyle={coverStyle} />
          {flipSheet && (
            <div className={`studio-flip-sheet is-${flipSheet.direction}`} aria-hidden="true">
              <BookPage
                page={flipSheet.page}
                side={flipSheet.direction === "next" ? "right" : "left"}
                coverStyle={coverStyle}
              />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function BookPage({
  page,
  side,
  coverStyle,
}: {
  page?: { title: string; body: string; kind: "cover" | "toc" | "chapter" | "back"; continued?: boolean };
  side: "left" | "right";
  coverStyle: CoverStyle;
}) {
  if (!page) {
    return <div className="hidden md:block" />;
  }

  return (
    <section
      className={cn(
        "studio-book-page",
        side === "left" ? "is-left" : "is-right",
        page.kind === "cover" && `is-cover cover-${coverStyle}`,
        page.kind === "toc" && "is-toc",
        page.continued && "is-continued",
      )}
    >
      <div>
        <p className="studio-book-page-kind">
          {page.continued ? page.title.replace(/（续）|\s\(continued\)$/g, "") : page.kind}
        </p>
        {!page.continued && <h2>{page.title}</h2>}
        <div className="studio-book-page-body">
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
  onRename,
  onClone,
}: {
  history: SavedMemoir[];
  locale: Locale;
  onClose: () => void;
  onLoad: (item: SavedMemoir) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, newTitle: string) => void;
  onClone: (item: SavedMemoir) => void;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredHistory = history.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function startEditing(item: SavedMemoir) {
    setEditingId(item.id);
    setEditingTitle(item.title);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingTitle("");
  }

  function saveEditing(id: string) {
    if (editingTitle.trim()) {
      onRename(id, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  }

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

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder={locale === "zh" ? "搜索会话标题..." : "Search by title..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <div className="mt-5 grid gap-3">
          {filteredHistory.length === 0 ? (
            <p className="rounded-lg border border-border bg-background/44 p-5 text-sm text-muted-foreground">
              {history.length === 0
                ? (locale === "zh" ? "还没有历史记录。完成一次访谈或生成书稿后会自动保存。" : "No history yet. Sessions are saved after an interview or book generation.")
                : (locale === "zh" ? "没有找到匹配的会话。" : "No matching sessions found.")}
            </p>
          ) : (
            filteredHistory.map((item) => (
              <article
                key={item.id}
                className="group grid gap-3 rounded-lg border border-border bg-background/44 p-4 sm:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  {editingId === item.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditing(item.id);
                          if (e.key === "Escape") cancelEditing();
                        }}
                      />
                      <Button size="sm" onClick={() => saveEditing(item.id)}>
                        {locale === "zh" ? "保存" : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>
                        {locale === "zh" ? "取消" : "Cancel"}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="truncate font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleString()} · {item.session.turns.length} turns · {item.bookDraft ? (locale === "zh" ? "已有书稿" : "Book ready") : (locale === "zh" ? "未成书" : "No book yet")}
                      </p>
                    </>
                  )}
                </div>
                {editingId !== item.id && (
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
                    <button
                      className="rounded p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10"
                      onClick={() => startEditing(item)}
                      title={locale === "zh" ? "重命名" : "Rename"}
                    >
                      <i className="ri-edit-line text-sm" />
                    </button>
                    <button
                      className="rounded p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10"
                      onClick={() => onClone(item)}
                      title={locale === "zh" ? "复制" : "Clone"}
                    >
                      <i className="ri-file-copy-line text-sm" />
                    </button>
                    {deleteConfirmId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            onDelete(item.id);
                            setDeleteConfirmId(null);
                          }}
                        >
                          {locale === "zh" ? "确认" : "Yes"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          {locale === "zh" ? "取消" : "No"}
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="rounded p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10"
                        onClick={() => setDeleteConfirmId(item.id)}
                        title={locale === "zh" ? "删除" : "Delete"}
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    )}
                  </div>
                )}
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
  t: CopyKeys;
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
    <motion.div
      className="studio-dialog-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="studio-settings-dialog"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <header>
          <div>
            <span className="studio-eyebrow">{t.settingsTitle}</span>
            <h3>{t.settingsTitle}</h3>
            <p>{t.settingsDesc}</p>
          </div>
          <button className="studio-icon-button" type="button" onClick={onClose} aria-label={t.close}>
            <i className="ri-close-line" />
          </button>
        </header>

        <div className="studio-settings-body">
          <section className="studio-settings-section">
            <span className="studio-eyebrow">{t.connectionStatus}</span>
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
          </section>

          <section className="studio-settings-section">
            <span className="studio-eyebrow">{t.interface}</span>
            <div className="studio-settings-actions">
              <button className="studio-secondary-button" type="button" onClick={onToggleLocale}>
                {t.language}
              </button>
              <button className="studio-secondary-button" type="button" onClick={onToggleTheme}>
                <i className={isDark ? "ri-sun-line" : "ri-moon-line"} />
                {t.theme}
              </button>
              <button className="studio-secondary-button" type="button" onClick={onResetVoiceDefaults}>
                {locale === "zh" ? "恢复语音默认" : "Reset voice"}
              </button>
            </div>
          </section>

          <Field
            label={t.bailianKey}
            type="password"
            value={bailianApiKey}
            placeholder={t.bailianKeyPlaceholder}
            onChange={onBailianApiKeyChange}
          />

          <div className="studio-settings-grid">
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

          <div className="studio-settings-grid">
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
      </motion.div>
    </motion.div>
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
    <label className="studio-settings-field">
      <span className="studio-eyebrow">
        {label}
      </span>
      <input
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
    <div className="studio-connection-line">
      {items.map((item, index) => (
        <div key={item.label}>
          <div>
            <div
              className={cn(
                "studio-connection-dot",
                item.active ? "is-active" : "",
              )}
            />
            <span>
              {item.label}
            </span>
          </div>
          {index < items.length - 1 && (
            <div
              className={cn(
                "studio-connection-rule",
                item.active && items[index + 1]?.active ? "is-active" : "",
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
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/36 px-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
      <Card className="p-5">
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
      </motion.div>
    </motion.div>
  );
}
