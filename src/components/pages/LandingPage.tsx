/**
 * [WHO]: 提供 LandingPage 落地页组件，展示产品介绍、功能特点和行动引导
 * [FROM]: 依赖 UI 组件库 (Badge, Button, LandingCarousel)、i18n国际化
 * [TO]: 被 App.tsx 路由挂载，作为未登录用户的首页
 * [HERE]: src/components/pages/LandingPage.tsx，品牌展示与引流入口
 */
import { useState } from "react";
import logoImage from "../../assets/logo.jpg";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LandingCarousel } from "../../components/ui/LandingCarousel";
import { cn } from "../../lib/utils";
import type { Locale } from "../../lib/i18n";

export function LandingPage() {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("membook.locale") as Locale) || "zh");

  const features = [
    {
      icon: "ri-mic-line",
      title: locale === "zh" ? "语音访谈" : "Voice Interview",
      desc: locale === "zh"
        ? "AI 像打电话一样温柔追问，引导长辈讲述人生故事"
        : "AI gently guides conversations like a phone call, helping elders share their life stories",
    },
    {
      icon: "ri-book-open-line",
      title: locale === "zh" ? "回忆成书" : "Auto-Biography",
      desc: locale === "zh"
        ? "将访谈内容自动生成精美的回忆录，永久珍藏"
        : "Automatically generates a beautiful memoir from interview content to preserve forever",
    },
    {
      icon: "ri-global-line",
      title: locale === "zh" ? "多语言" : "Multilingual",
      desc: locale === "zh"
        ? "支持中文与英文切换，照顾不同语言背景的家庭"
        : "Supports Chinese and English, caring for families across language backgrounds",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-primary/[0.04]">
      {/* Starlight ambient accents */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/4 h-60 w-60 rounded-full bg-accent/8 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
        {/* Top nav */}
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <img
              src={logoImage}
              alt="logo"
              className="h-10 w-10 rounded-[6px]"
            />
            <span className="text-lg font-bold">
              {locale === "zh" ? "星光回忆录" : "Starlight Memoir"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLocale(locale === "zh" ? "en" : "zh")}>
              <i className="ri-translate-2" />
              {locale === "zh" ? "EN" : "中文"}
            </Button>
            <Button size="sm" onClick={() => (window.location.href = "/login")}>
              <i className="ri-login-circle-line" />
              {locale === "zh" ? "登录" : "Login"}
            </Button>
          </div>
        </header>

        {/* Hero section */}
        <section className="mx-auto mt-8 flex max-w-7xl flex-col items-center lg:flex-row lg:gap-12">
          {/* Left: Content */}
          <div className="flex-1 text-center lg:text-left">
            <Badge className="mb-5">
              {locale === "zh" ? "用声音记录一辈子的回忆" : "Record a lifetime of memories with voice"}
            </Badge>
            <h1 className="font-serif-cn text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
              {locale === "zh" ? "让每一位长辈的故事，都成为一本书" : "Every Elder's Story Deserves to Be a Book"}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl text-balance lg:mx-0">
              {locale === "zh"
                ? "AI 语音访谈 + 自动追问 + 回忆录成书，用科技留住那些慢慢说出的日子。"
                : "AI voice interviews with follow-up questions and auto-generated memoirs — preserving the days spoken slowly, with technology."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button
                size="lg"
                className="rounded-full px-8"
                onClick={() => (window.location.href = "/login")}
              >
                {locale === "zh" ? "开始记录" : "Start Recording"}
                <i className="ri-arrow-right-line" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full px-8"
                onClick={() => {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {locale === "zh" ? "了解更多" : "Learn More"}
              </Button>
            </div>
          </div>

          {/* Right: Carousel */}
          <div className="mt-10 flex-1 lg:mt-0">
            <LandingCarousel />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto mt-20 max-w-5xl pb-20">
          <h2 className="mb-10 text-center font-serif-cn text-3xl font-bold tracking-tight">
            {locale === "zh" ? "如何记录一生" : "How to Record a Life"}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className={cn(
                  "rounded-2xl border border-border/50 bg-card/50 p-6 text-center backdrop-blur-sm",
                  "transition-all duration-300 hover:border-border hover:bg-card/80 group",
                )}
              >
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <i className={cn(f.icon, "text-xl")} />
                </div>
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
