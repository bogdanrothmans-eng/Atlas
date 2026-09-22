import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { FormEvent, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

import { AccountShell } from "@/components/AccountShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/adminRepository";

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.ALLOW_ADMIN_SIGNUP !== "true") return { notFound: true };
  return { props: {} };
};

export default function AdminSetup() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await signUp(
        String(data.get("email")),
        String(data.get("password")),
      );
      setMessage(
        result.session
          ? "Аккаунт создан. Теперь можно войти."
          : "Проверьте почту и подтвердите регистрацию.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось создать аккаунт",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Создание аккаунта — Atlas</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AccountShell badge="Настройка администратора">
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Первый вход
            </p>
            <CardTitle className="text-2xl tracking-tight">
              Создать аккаунт
            </CardTitle>
            <CardDescription>
              Используйте email, которому предоставлен доступ к модерации.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Email</Label>
                <Input
                  id="setup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-password">Новый пароль</Label>
                <Input
                  id="setup-password"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Создаём…" : "Создать аккаунт"}
              </Button>
            </form>
            {message && (
              <div className="space-y-3">
                <Alert role="status">
                  <CircleCheck />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/admin">Перейти ко входу</Link>
                </Button>
              </div>
            )}
            {error && (
              <Alert variant="destructive" role="alert">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </AccountShell>
    </>
  );
}
