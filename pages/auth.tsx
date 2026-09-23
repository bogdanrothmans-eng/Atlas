import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { ArrowLeft, CircleAlert, Flag, MapPin, MessageSquare, Send } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import { Brand, BrandMark } from "@/components/Brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { safeNextPath, supabase } from "@/lib/supabaseClient";

type AuthMode = "signin" | "signup";
type SocialProvider = {
  id: Provider;
  label: string;
  name: string;
  icon: "google" | "facebook" | "telegram";
};

const providers: SocialProvider[] = [
  { id: "google", label: "Продолжить с Google", name: "Google", icon: "google" },
  { id: "facebook", label: "Продолжить с Facebook", name: "Facebook", icon: "facebook" },
  { id: "custom:telegram", label: "Продолжить с Telegram", name: "Telegram", icon: "telegram" },
];

const highlights = [
  { icon: MapPin, title: "Добавляйте полезные места", text: "Новые точки сразу видны всем." },
  { icon: MessageSquare, title: "Делитесь опытом", text: "Пишите комментарии и отвечайте другим." },
  { icon: Flag, title: "Помогайте сообществу", text: "Оценивайте места и сообщайте о проблемах." },
];

function ProviderIcon({ name }: { name: SocialProvider["icon"] }) {
  if (name === "google")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
        <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
        <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.2a10 10 0 0 0 0 9.1L6.5 14Z" />
        <path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 3.2 7.5l3.3 2.6A5.8 5.8 0 0 1 12 6Z" />
      </svg>
    );
  if (name === "facebook")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
        <circle cx="12" cy="12" r="11" fill="#1877F2" />
        <path fill="#fff" d="M15.2 13.2h-2.1V21h-3.2v-7.8H8.4v-2.7h1.5V8.9c0-2.2 1-3.6 3.9-3.6h2.1V8h-1.3c-1 0-1.5.4-1.5 1.2v1.3H16l-.8 2.7Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <circle cx="12" cy="12" r="11" fill="#229ED9" />
      <path fill="#fff" d="m6 11.6 10.7-4.1c.5-.2 1 .1.8 1l-1.8 8.6c-.1.6-.5.7-1 .5l-2.8-2.1-1.3 1.3c-.2.2-.3.3-.6.3l.2-2.8 5.1-4.6c.2-.2 0-.4-.3-.2l-6.3 4-2.7-.9c-.6-.2-.6-.6 0-1Z" />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nextPath = safeNextPath(router.query.next);

  useEffect(() => {
    if (!router.isReady) return;
    const providerError =
      typeof router.query.error_description === "string"
        ? router.query.error_description
        : "";
    if (providerError)
      setError(
        "Не удалось войти через выбранный сервис. Проверьте настройки и повторите попытку.",
      );
  }, [router.isReady, router.query.error_description]);

  useEffect(() => {
    if (router.isReady && !sessionLoading && user && !sent)
      void router.replace(nextPath);
  }, [nextPath, router, router.isReady, sent, sessionLoading, user]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setSent(false);
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  const socialSignIn = async (provider: SocialProvider) => {
    setLoading(provider.id);
    setError("");
    const redirectTo = `${window.location.origin}/auth?next=${encodeURIComponent(nextPath)}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: provider.id,
      options: {
        redirectTo,
        scopes: provider.id === "custom:telegram" ? "openid profile" : undefined,
      },
    });
    if (authError) {
      setError(
        `Вход через ${provider.name} пока недоступен. Выберите email или повторите позже.`,
      );
      setLoading(null);
    }
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const name = String(data.get("name") || "").trim();
    setLoading("email");
    setError("");

    if (mode === "signin") {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError)
        setError(
          "Email или пароль не подошли. Проверьте данные или восстановите пароль.",
        );
    } else {
      const { data: result, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (authError) {
        setError(
          authError.message.includes("already")
            ? "Аккаунт с таким email уже существует. Переключитесь на вход."
            : "Не удалось создать аккаунт. Проверьте email и попробуйте ещё раз.",
        );
      } else if (!result.session) {
        setSent(true);
      }
    }
    setLoading(null);
  };

  return (
    <>
      <Head>
        <title>{`${mode === "signin" ? "Вход" : "Регистрация"} — Atlas`}</title>
        <meta
          name="description"
          content="Войдите в Atlas, чтобы добавлять места и участвовать в обсуждениях."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <main className="bg-muted/40 grid min-h-svh lg:grid-cols-2">
        <section
          className="bg-primary text-primary-foreground hidden flex-col justify-between p-10 lg:flex"
          aria-labelledby="auth-context-title"
        >
          <Link
            href="/"
            aria-label="Atlas — вернуться на карту"
            className="flex w-fit items-center gap-2 font-semibold tracking-tight"
          >
            <BrandMark className="bg-primary-foreground text-primary" />
            <span>Atlas</span>
          </Link>

          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-primary-foreground/70 text-xs font-medium tracking-wide uppercase">
                Карта сообщества
              </p>
              <h1
                id="auth-context-title"
                className="text-3xl font-semibold tracking-tight text-balance"
              >
                Делитесь местами, которым доверяете
              </h1>
              <p className="text-primary-foreground/80 text-sm text-pretty">
                После входа вы сможете добавлять точки, фотографии, комментарии
                и реакции. Смотреть карту можно без регистрации.
              </p>
            </div>
            <ul className="space-y-4">
              {highlights.map(({ icon: HighlightIcon, title, text }) => (
                <li key={title} className="flex items-start gap-3">
                  <HighlightIcon className="mt-0.5 size-4 shrink-0" />
                  <span className="space-y-0.5">
                    <strong className="block text-sm font-medium">{title}</strong>
                    <small className="text-primary-foreground/70 block text-sm">
                      {text}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-primary-foreground/60 text-sm">
            Atlas использует вход только для защиты публикаций от спама.
          </p>
        </section>

        <section
          className="flex items-center justify-center p-4 sm:p-6"
          aria-labelledby="auth-title"
        >
          <Card className="w-full max-w-md">
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-3 lg:hidden">
                <Brand />
              </div>

              <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
                <Link href={nextPath}>
                  <ArrowLeft /> Вернуться на карту
                </Link>
              </Button>

              {sent ? (
                <div className="space-y-4 text-center" role="status">
                  <div className="bg-muted mx-auto grid size-12 place-items-center rounded-full">
                    <Send className="size-5" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Проверьте почту
                    </p>
                    <h2
                      id="auth-title"
                      className="text-2xl font-semibold tracking-tight"
                    >
                      Подтвердите email
                    </h2>
                    <p className="text-muted-foreground text-sm text-pretty">
                      Мы отправили ссылку для завершения регистрации. После
                      подтверждения вы вернётесь в Atlas.
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSent(false);
                      setMode("signin");
                    }}
                  >
                    Перейти ко входу
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {mode === "signin" ? "С возвращением" : "Новый профиль"}
                    </p>
                    <h2
                      id="auth-title"
                      className="text-2xl font-semibold tracking-tight"
                    >
                      {mode === "signin" ? "Войти в Atlas" : "Создать аккаунт"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {mode === "signin"
                        ? "Выберите удобный способ входа."
                        : "Регистрация занимает меньше минуты."}
                    </p>
                  </div>

                  <div
                    className="grid gap-2"
                    aria-label="Войти через социальный сервис"
                  >
                    {providers.map((provider) => (
                      <Button
                        key={provider.id}
                        type="button"
                        variant="outline"
                        onClick={() => socialSignIn(provider)}
                        disabled={Boolean(loading)}
                      >
                        <ProviderIcon name={provider.icon} />
                        <span>
                          {loading === provider.id ? "Открываем…" : provider.label}
                        </span>
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      или по email
                    </span>
                    <Separator className="flex-1" />
                  </div>

                  <form
                    className="space-y-4"
                    onSubmit={submitEmail}
                    aria-describedby={error ? "auth-error" : undefined}
                  >
                    {mode === "signup" && (
                      <div className="space-y-2">
                        <Label htmlFor="auth-name">Имя</Label>
                        <Input
                          id="auth-name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          maxLength={80}
                          required
                          placeholder="Как к вам обращаться"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="auth-email">Email</Label>
                      <Input
                        ref={emailRef}
                        id="auth-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        required
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="auth-password">Пароль</Label>
                        {mode === "signin" && (
                          <Link
                            href="/forgot-password"
                            // Standalone link, so the WCAG inline-target
                            // exception does not apply: hold it at 24px.
                            className="text-muted-foreground inline-flex min-h-6 items-center text-sm underline-offset-4 hover:underline"
                          >
                            Восстановить пароль
                          </Link>
                        )}
                      </div>
                      <Input
                        id="auth-password"
                        name="password"
                        type="password"
                        autoComplete={
                          mode === "signin" ? "current-password" : "new-password"
                        }
                        minLength={8}
                        required
                        aria-describedby="password-hint"
                      />
                      <p
                        id="password-hint"
                        className="text-muted-foreground text-xs"
                      >
                        Минимум 8 символов.
                      </p>
                    </div>
                    {error && (
                      <Alert
                        id="auth-error"
                        variant="destructive"
                        role="alert"
                      >
                        <CircleAlert />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={Boolean(loading)}
                    >
                      {loading === "email"
                        ? mode === "signin"
                          ? "Входим…"
                          : "Создаём…"
                        : mode === "signin"
                          ? "Войти по email"
                          : "Создать аккаунт"}
                    </Button>
                  </form>

                  <p className="text-muted-foreground text-center text-sm">
                    {mode === "signin" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                    <button
                      type="button"
                      className="text-foreground font-medium underline-offset-4 hover:underline"
                      onClick={() =>
                        changeMode(mode === "signin" ? "signup" : "signin")
                      }
                    >
                      {mode === "signin" ? "Создать аккаунт" : "Войти"}
                    </button>
                  </p>
                  <p className="text-muted-foreground text-center text-xs text-pretty">
                    Продолжая, вы соглашаетесь соблюдать правила сообщества Atlas.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
