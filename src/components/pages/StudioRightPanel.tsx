/**
 * Studio page right panel — transcript and book preview.
 */
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { MorphingSpinner } from "../ui/morphing-spinner";
import { cn } from "../../lib/utils";
import type { BookDraft, InterviewSession, InterviewTurn } from "../../lib/types";
import type { Locale } from "../../lib/i18n";

export function StudioRightPanel({
  locale,
  t,
  session,
  bookDraft,
  isGenerating,
  elderTurns,
  isAsking,
  error,
  onGenerateBook,
  onOpenBook,
}: {
  locale: Locale;
  t: Record<string, unknown>;
  session: InterviewSession;
  bookDraft: BookDraft | null;
  isGenerating: boolean;
  elderTurns: InterviewTurn[];
  isAsking: boolean;
  error: string;
  onGenerateBook: () => void;
  onOpenBook: () => void;
}) {
  return (
    <section className="grid min-h-0 gap-4">
      <Card className="animate-rise-in flex min-h-0 flex-col p-4 shadow-[0_16px_42px_oklch(var(--foreground)/0.06)] ring-1 ring-primary/7 [animation-delay:180ms]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif-cn text-xl font-bold tracking-normal">
            {String(t.transcript)}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={onGenerateBook}
            disabled={isGenerating || elderTurns.length === 0}
          >
            {isGenerating ? (
              <i className="ri-loader-4-line animate-spin" />
            ) : (
              <i className="ri-book-3-line" />
            )}
            {String(t.generate)}
          </Button>
        </div>
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {session.turns.length === 1 ? (
            <p className="rounded-lg bg-card/58 p-4 text-sm text-muted-foreground">
              {String(t.emptyTranscript)}
            </p>
          ) : (
            session.turns.slice(-8).map((turn) => (
              <article
                key={turn.id}
                className={cn(
                  "rounded-lg p-3 text-sm leading-6",
                  turn.role === "agent"
                    ? "bg-card/62 text-muted-foreground"
                    : "bg-foreground text-background",
                )}
              >
                <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] opacity-70">
                  {turn.role === "agent"
                    ? locale === "zh" ? "助手" : "Guide"
                    : locale === "zh" ? "长辈" : "Elder"}
                </p>
                {turn.content}
              </article>
            ))
          )}
          {isAsking && (
            <article className="rounded-lg bg-card/62 p-3 text-sm leading-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MorphingSpinner size="sm" />
                <div>
                  <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] opacity-70">
                    {locale === "zh" ? "助手" : "Guide"}
                  </p>
                  <span className="text-muted-foreground/70">
                    {locale === "zh" ? "正在整理下一句追问..." : "Preparing the next question..."}
                  </span>
                </div>
              </div>
            </article>
          )}
        </div>
      </Card>

      <Card className="animate-rise-in min-h-0 p-4 shadow-[0_16px_42px_oklch(var(--foreground)/0.06)] ring-1 ring-primary/7 [animation-delay:260ms]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif-cn text-xl font-bold tracking-normal">
            {bookDraft ? String(t.bookReady) : String(t.chapterPlan)}
          </h2>
          {bookDraft && (
            <Button variant="secondary" size="sm" onClick={onOpenBook}>
              <i className="ri-book-open-line" />
              {locale === "zh" ? "打开书" : "Open"}
            </Button>
          )}
        </div>
        {isGenerating ? (
          <div className="mt-3 grid gap-2">
            <div className="h-16 rounded-lg bg-card/58" />
            <div className="h-14 rounded-lg bg-card/42" />
            <p className="text-sm text-muted-foreground">
              {locale === "zh" ? "正在把访谈整理成章节，请稍等。" : "Turning the interview into chapters."}
            </p>
          </div>
        ) : bookDraft ? (
          <div className="mt-3 max-h-64 space-y-3 overflow-auto pr-1">
            <div>
              <h3 className="font-serif-cn text-2xl font-bold">{bookDraft.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{bookDraft.subtitle}</p>
              {bookDraft.pipeline && (
                <p className="mt-2 rounded-full border border-border bg-background/44 px-3 py-1 text-xs text-muted-foreground">
                  {bookDraft.pipeline.package}@{bookDraft.pipeline.version} · {bookDraft.pipeline.mode}
                </p>
              )}
            </div>
            {bookDraft.chapters.slice(0, 3).map((chapter) => (
              <div key={chapter.title} className="rounded-lg bg-card/62 p-3">
                <p className="font-semibold">{chapter.title}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {chapter.summary}
                </p>
              </div>
            ))}
            <Button className="w-full" onClick={onOpenBook}>
              <i className="ri-book-open-line" />
              {locale === "zh" ? "进入拟真翻页阅读" : "Read as a book"}
            </Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {session.insights.map((insight) => (
              <div key={insight.label} className="rounded-lg bg-card/62 p-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {insight.label}
                </p>
                <p className="mt-1 text-sm font-semibold">{insight.value}</p>
              </div>
            ))}
            <div className="h-2 overflow-hidden rounded-full bg-muted/40">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${session.readiness}%` }} />
            </div>
          </div>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>
        )}
      </Card>
    </section>
  );
}
