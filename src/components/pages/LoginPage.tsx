/**
 * [WHO]: 提供 LoginPage 登录页面组件，包含管理员认证和国际化切换
 * [FROM]: 依赖 UI 组件库 (Badge, Button, Card)、i18n国际化、BookReader的Field子组件
 * [TO]: 被 App.tsx 路由挂载，是进入工作台的安全入口
 * [HERE]: src/components/pages/LoginPage.tsx，认证入口页面
 */
import { FormEvent, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "./BookReader";
import type { Locale } from "../../lib/i18n";
import { copy } from "../../lib/i18n";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [locale, setLocale] = useState<Locale>("zh");
  const [loginError, setLoginError] = useState("");
  const t = copy[locale];

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    if (username === "admin" && password === "12345678") {
      localStorage.setItem("membook.auth", "admin");
      onLogin();
      return;
    }
    setLoginError(locale === "zh" ? "账号或密码不对。" : "Invalid username or password.");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <Card className="relative z-10 w-full max-w-sm p-6 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <Badge>{locale === "zh" ? "登录" : "Login"}</Badge>
          <Button variant="secondary" size="icon" onClick={() => setLocale(locale === "zh" ? "en" : "zh")}>
            <i className="ri-translate-2" />
          </Button>
        </div>
        <h2 className="mt-4 font-serif-cn text-2xl font-bold tracking-[-0.04em]">
          {locale === "zh" ? "欢迎回来" : "Welcome back"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {locale === "zh"
            ? "输入管理员账号密码，继续管理访谈与回忆录。"
            : "Enter your admin credentials to continue."}
        </p>
        <form className="mt-6 grid gap-3" onSubmit={handleLogin}>
          <Field
            label={locale === "zh" ? "账号" : "Username"}
            name="username"
            value={undefined}
            placeholder="admin"
          />
          <Field
            label={locale === "zh" ? "密码" : "Password"}
            name="password"
            type="password"
            value={undefined}
            placeholder="12345678"
          />
          {loginError && (
            <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
              {loginError}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-2">
            <i className="ri-login-circle-line" />
            {locale === "zh" ? "进入工作台" : "Enter studio"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <a href="/" className="hover:text-primary">
            {locale === "zh" ? "← 返回首页" : "← Back to home"}
          </a>
        </p>
      </Card>
    </main>
  );
}
