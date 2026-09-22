import Head from "next/head";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { CircleAlert, MailCheck } from "lucide-react";

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
import { requestPasswordReset } from "@/lib/adminRepository";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    try {
      await requestPasswordReset(email, `${window.location.origin}/reset-password`);
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось отправить письмо. Проверьте подключение и повторите попытку.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Восстановление пароля — Atlas</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AccountShell badge="Аккаунт Atlas">
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Восстановление доступа
            </p>
            <CardTitle className="text-2xl tracking-tight">
              Сбросить пароль
            </CardTitle>
            <CardDescription>
              {sent
                ? "Письмо отправлено."
                : "Укажите email аккаунта. Мы отправим ссылку для создания нового пароля."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="space-y-4" role="status">
                <Alert>
                  <MailCheck />
                  <AlertDescription>
                    Если аккаунт существует, письмо со ссылкой уже отправлено.
                    Проверьте входящие и папку «Спам».
                  </AlertDescription>
                </Alert>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth">Вернуться ко входу</Link>
                </Button>
              </div>
            ) : (
              <>
                <form className="space-y-4" onSubmit={submit}>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-email">Email</Label>
                    <Input
                      id="recovery-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      placeholder="name@example.com"
                      required
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Отправляем…" : "Отправить ссылку"}
                  </Button>
                </form>
                {error && (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button asChild variant="link" className="w-full">
                  <Link href="/auth">Вернуться ко входу</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </AccountShell>
    </>
  );
}
