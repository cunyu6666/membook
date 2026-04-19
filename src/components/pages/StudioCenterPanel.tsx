/**
 * Studio page center panel — voice-first call UI.
 */
import { type FormEvent } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Textarea } from "../ui/Textarea";
import { ShimmeringText } from "../ui/shimmering-text";
import { MorphingSpinner } from "../ui/morphing-spinner";
import { cn } from "../../lib/utils";
import type { Locale } from "../../lib/i18n";
import type { ConversationPhase } from "../../lib/phaseCopy";
import { getCallSteps, getPhaseProgress } from "../../lib/phaseCopy";

export function StudioCenterPanel({
  locale,
  t,
  isCallActive,
  conversationPhase,
  latestAgentQuestion,
  bailianApiKey,
  isSpeaking,
  isVoiceBusy,
  phaseCopy,
  phaseProgress,
  recorder,
  typedAnswer,
  isTranscribing,
  isAsking,
  onSpeakQuestion,
  onCallButton,
  onFormSubmit,
  onTextChange,
  onFileChange,
  onTranscribe,
  onSubmit,
}: {
  locale: Locale;
  t: Record<string, unknown>;
  isCallActive: boolean;
  conversationPhase: ConversationPhase;
  latestAgentQuestion: string;
  bailianApiKey: string;
  isSpeaking: boolean;
  isVoiceBusy: boolean;
  phaseCopy: { badge: string; status: string; action: string; title: string; description: string };
  phaseProgress: number;
  recorder: ReturnType<typeof import("../../hooks/useAudioRecorder").useAudioRecorder>;
  typedAnswer: string;
  isTranscribing: boolean;
  isAsking: boolean;
  onSpeakQuestion: () => void;
  onCallButton: () => void;
  onFormSubmit: (event: FormEvent) => void;
  onTextChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onTranscribe: () => void;
  onSubmit: () => void;
}) {
  const answerText = typedAnswer.trim();

  return (
    <Card className="animate-rise-in flex min-h-0 flex-col overflow-hidden p-4 [animation-delay:100ms]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Badge>{isCallActive ? phaseCopy.badge : String(t.agent)}</Badge>
          <h2 className="mt-3 font-serif-cn text-xl font-bold leading-snug tracking-tight lg:text-2xl">
            {latestAgentQuestion}
          </h2>
        </div>
        <Button
          variant="secondary"
          size="icon"
          disabled={!bailianApiKey || isSpeaking}
          onClick={onSpeakQuestion}
          aria-label={String(t.playQuestion)}
        >
          <i className={isSpeaking ? "ri-loader-4-line animate-spin" : "ri-volume-up-line"} />
        </Button>
      </div>

      <section className="relative mt-4 flex-1 overflow-hidden rounded-lg border border-border bg-foreground" aria-busy={isVoiceBusy}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,oklch(var(--primary)/0.12),transparent_15rem),linear-gradient(180deg,oklch(var(--foreground)),oklch(var(--foreground)/0.92))]" />
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-5">
          <div className="flex max-w-sm flex-col items-center text-center">
            <div className="mb-4 rounded-full border border-background/15 bg-background/12 px-3 py-1.5 text-xs font-semibold text-background/78 backdrop-blur">
              {isVoiceBusy ? (
                conversationPhase === "thinking" ? (
                  <div className="flex items-center gap-2">
                    <MorphingSpinner size="sm" className="!bg-background/80" />
                    <ShimmeringText
                      text={phaseCopy.status}
                      startOnView={false}
                      className="text-background"
                      color="oklch(var(--primary-foreground) / 0.55)"
                      shimmerColor="oklch(var(--primary-foreground))"
                    />
                  </div>
                ) : (
                  <ShimmeringText
                    text={phaseCopy.status}
                    startOnView={false}
                    className="text-background"
                    color="oklch(var(--primary-foreground) / 0.55)"
                    shimmerColor="oklch(var(--primary-foreground))"
                  />
                )
              ) : (
                <span>{phaseCopy.status}</span>
              )}
            </div>
            <button
              type="button"
              data-space-talk-button
              className={cn(
                "pointer-events-auto grid h-24 w-24 place-items-center rounded-full border text-3xl shadow-[0_22px_70px_oklch(var(--foreground)/0.16)] transition duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30",
                conversationPhase === "recording"
                  ? "recording-ring border-primary/30 bg-primary/88 text-primary-foreground backdrop-blur"
                  : isVoiceBusy
                    ? "border-accent/25 bg-accent/88 text-accent-foreground backdrop-blur"
                    : "border-background/20 bg-card/74 text-foreground hover:scale-[1.03] backdrop-blur",
                isVoiceBusy && "cursor-wait",
              )}
              disabled={!recorder.isSupported || isVoiceBusy}
              onClick={onCallButton}
              aria-label={phaseCopy.action}
            >
              <i
                className={cn(
                  conversationPhase === "recording"
                    ? "ri-stop-fill"
                    : isVoiceBusy
                      ? "ri-loader-4-line animate-spin"
                      : isCallActive
                        ? "ri-mic-line"
                        : "ri-phone-line",
                )}
              />
            </button>
            <h3 className="mt-5 text-2xl font-bold tracking-[-0.045em] text-background">
              {phaseCopy.title}
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-background/68">
              {phaseCopy.description}
            </p>
            {(isVoiceBusy || conversationPhase === "recording") && (
              <div className="mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-background/12">
                <div className="h-full rounded-full bg-primary-foreground transition-all duration-500" style={{ width: `${phaseProgress}%` }} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {getCallSteps(locale).map((step) => (
                <div
                  key={step.phase}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.1em] backdrop-blur",
                    step.phase === conversationPhase
                      ? "border-primary/50 bg-primary/22 text-background"
                      : "border-background/12 bg-background/8 text-background/54",
                  )}
                >
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <form className="mt-3 grid gap-2" onSubmit={onFormSubmit}>
        <Textarea
          className="h-20 rounded-lg text-sm leading-6"
          value={typedAnswer}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={String(t.placeholder)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 gap-2">
            <label className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border/85 bg-card/72 px-3 text-xs text-muted-foreground transition hover:border-primary/35 hover:bg-muted/35">
              <i className="ri-attachment-2" />
              <span className="truncate">
                {recorder.audioFile?.name ?? String(t.uploadAudio)}
              </span>
              <input
                className="sr-only"
                type="file"
                accept="audio/*"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                aria-label={String(t.uploadAudio)}
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!recorder.audioFile || !bailianApiKey || isTranscribing}
              onClick={onTranscribe}
            >
              {isTranscribing ? (
                <i className="ri-loader-4-line animate-spin" />
              ) : (
                <i className="ri-text" />
              )}
              {String(t.transcribe)}
            </Button>
          </div>
          <Button type="submit" size="sm" disabled={!answerText || isAsking}>
            {isAsking ? (
              <i className="ri-loader-4-line animate-spin" />
            ) : (
              <i className="ri-send-plane-2-line" />
            )}
            {isAsking ? (locale === "zh" ? "正在追问" : "Sending") : locale === "zh" ? "发送" : "Send"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
