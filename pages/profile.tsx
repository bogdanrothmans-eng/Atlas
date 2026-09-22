import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Flag,
  MapPin,
  MessageSquare,
  Shield,
  ThumbsUp,
  User,
  type LucideIcon,
} from "lucide-react";

import { useAuth, userDisplayName } from "@/components/AuthProvider";
import { Brand } from "@/components/Brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";

const capabilities: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MapPin, title: "Добавлять места", text: "Новые точки сразу появляются на карте." },
  { icon: MessageSquare, title: "Обсуждать", text: "Пишите комментарии и отвечайте другим." },
  { icon: ThumbsUp, title: "Оценивать", text: "Ставьте лайки и дизлайки полезным местам." },
  { icon: Camera, title: "Добавлять фото", text: "Показывайте актуальный вид места." },
  { icon: Flag, title: "Сообщать о проблемах", text: "Отправляйте жалобы модераторам Atlas." },
];

const providerLabel = (provider: string) => {
  if (provider === "custom:telegram") return "Telegram";
  if (provider === "facebook") return "Facebook";
  if (provider === "google") return "Google";
  return "email";
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const name = userDisplayName(user);
  const provider = String(user?.app_metadata.provider || "email");

  // Admin rights live in the admin_users table, so ask the database rather
  // than hardcoding an address here.
  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase.rpc("is_atlas_admin").then(({ data }) => {
      if (active) setIsAdmin(data === true);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const logout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    await router.replace("/");
  };

  return (
    <>
      <Head>
        <title>Профиль — Atlas</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="bg-muted/40 flex min-h-svh flex-col">
        <header className="bg-background flex h-14 items-center justify-between gap-3 border-b px-4 sm:px-6">
          <Brand />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft /> Карта
            </Link>
          </Button>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4" role="status">
              <span className="sr-only">Загружаем профиль…</span>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : !user ? (
            <Card className="mx-auto max-w-md text-center">
              <CardContent className="flex flex-col items-center gap-4">
                <Avatar className="size-12">
                  <AvatarFallback>
                    <User className="size-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Гостевой режим
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Войдите, чтобы участвовать
                  </h1>
                  <p className="text-muted-foreground text-sm text-pretty">
                    Карта доступна без регистрации. Вход нужен только для
                    публикаций, реакций и жалоб.
                  </p>
                </div>
                <Button asChild className="w-full">
                  <Link href="/auth?next=%2Fprofile">
                    Войти или создать аккаунт
                  </Link>
                </Button>
                <Button asChild variant="link">
                  <Link href="/">Продолжить как гость</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-4">
                  <Avatar className="size-12">
                    <AvatarFallback className="text-base">
                      {name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Профиль Atlas
                    </p>
                    <h1 className="truncate text-xl font-semibold tracking-tight">
                      {name}
                    </h1>
                    <p className="text-muted-foreground truncate text-sm">
                      {user.email || "Аккаунт без email"} · вход через{" "}
                      {providerLabel(provider)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={logout}
                    disabled={signingOut}
                  >
                    {signingOut ? "Выходим…" : "Выйти"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Ваши возможности
                  </p>
                  <CardTitle className="text-xl tracking-tight">
                    Участвуйте в жизни карты
                  </CardTitle>
                  <CardDescription>
                    Что доступно участникам сообщества Atlas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {capabilities.map(({ icon: CapabilityIcon, title, text }) => (
                    <article
                      key={title}
                      className="bg-muted/40 flex items-start gap-3 rounded-lg border p-3"
                    >
                      <CapabilityIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-medium">{title}</h3>
                        <p className="text-muted-foreground text-sm">{text}</p>
                      </div>
                    </article>
                  ))}
                </CardContent>
              </Card>

              {isAdmin && (
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link href="/admin">
                    <span className="flex items-center gap-2">
                      <Shield /> Открыть панель администратора
                    </span>
                    <ChevronRight />
                  </Link>
                </Button>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
