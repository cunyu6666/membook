/**
 * Studio page left panel — brand, status, connection, rhythm, metrics.
 */
import logoImage from "../../assets/logo.jpg";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Metric, ConnectionLine } from "./BookReader";
import type { ApiStatus, InterviewSession } from "../../lib/types";
import type { Locale } from "../../lib/i18n";
import { getRhythmItems } from "../../lib/phaseCopy";

export function StudioLeftPanel({
  locale,
  t,
  session,
  isDark,
  apiStatus,
  bailianApiKey,
  bailianEndpoint,
  bailianTtsEndpoint,
  onOpenHistory,
  onNewInterview,
  onOpenSettings,
  onLogout,
  onToggleDark,
}: {
  locale: Locale;
  t: Record<string, unknown>;
  session: InterviewSession;
  isDark: boolean;
  apiStatus: ApiStatus | null;
  bailianApiKey: string;
  bailianEndpoint: string;
  bailianTtsEndpoint: string;
  onOpenHistory: () => void;
  onNewInterview: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onToggleDark: () => void;
}) {
  const elderTurns = session.turns.filter((turn) => turn.role === "elder");

  return (
    <Card className="animate-rise-in flex min-h-0 flex-col gap-3 p-4">
      <header className="grid gap-3">
        <div className="flex items-center gap-3">
          <img
            src={logoImage}
            alt="logo"
            className="h-10 w-10 rounded-[6px]"
          />
          <div>
            <p className="text-lg font-bold">{String(t.appName)}</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <Button variant="secondary" size="icon" aria-label={locale === "zh" ? "历史" : "History"} onClick={onOpenHistory}>
            <i className="ri-history-line" />
          </Button>
          <Button variant="secondary" size="icon" aria-label={locale === "zh" ? "新访谈" : "New interview"} onClick={onNewInterview}>
            <i className="ri-add-line" />
          </Button>
          <Button variant="secondary" size="icon" aria-label={String(t.theme)} onClick={onToggleDark}>
            <i className={isDark ? "ri-sun-line" : "ri-moon-line"} />
          </Button>
          <Button variant="secondary" size="icon" aria-label={String(t.settings)} onClick={onOpenSettings}>
            <i className="ri-settings-3-line" />
          </Button>
          <Button variant="secondary" size="icon" aria-label={locale === "zh" ? "退出登录" : "Log out"} onClick={onLogout}>
            <i className="ri-logout-box-r-line" />
          </Button>
        </div>
      </header>

      <section className="rounded-lg bg-[linear-gradient(145deg,oklch(var(--primary)),oklch(var(--accent)))] p-6 text-background shadow-[inset_0_1px_0_oklch(var(--primary-foreground)/0.18)]">
        <Badge className="border-background/20 bg-background/10 text-background/80">
          {String(t.compactHint)}
        </Badge>
        <h1 className="mt-4 text-2xl font-bold leading-tight text-background">
          {String(t.heroTitle)}
        </h1>
        <p className="mt-3 text-sm leading-6 text-background/75">
          {String(t.heroBody)}
        </p>
      </section>

      <section className="grid gap-3">
        <div className="rounded-lg bg-background/52 p-3 shadow-[inset_0_1px_0_oklch(var(--primary-foreground)/0.22)]">
          <ConnectionLine
            items={[
              { label: String(t.connService), active: Boolean(apiStatus) },
              {
                label: String(t.connAssistant),
                active: apiStatus?.mode === "rpc" || apiStatus?.mode === "acp",
              },
              { label: String(t.connRecognition), active: Boolean(bailianApiKey && bailianEndpoint) },
              {
                label: String(t.connReading),
                active: Boolean(bailianApiKey && bailianTtsEndpoint),
              },
              {
                label: locale === "zh" ? "成书" : "Book",
                active: Boolean(apiStatus?.memoirPipeline),
              },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-2 rounded-lg bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif-cn text-base font-bold tracking-normal">
            {locale === "zh" ? "访谈节奏" : "Interview Flow"}
          </h2>
          <span className="text-xs font-semibold text-primary">{session.readiness}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-background/60">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${session.readiness}%` }} />
        </div>
        <div className="grid gap-1.5 text-sm">
          {getRhythmItems(locale, elderTurns.length, session.readiness).map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-card/55 px-3 py-2">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-auto grid grid-cols-3 gap-2">
        <Metric label={String(t.readiness)} value={`${session.readiness}%`} />
        <Metric label={String(t.rawMaterial)} value={`${elderTurns.length}`} />
        <Metric label={locale === "zh" ? "对话" : "turns"} value={`${session.turns.length}`} />
      </div>
    </Card>
  );
}
