import Head from "next/head";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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
import { updatePassword } from "@/lib/adminRepository";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [linkError, setLinkError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token") || "";
    const recoveryError = params.get("error_description");
    if (accessToken) setToken(accessToken);
    else
      setLinkError(
        recoveryError || "Ссылка недействительна или устарела. Запросите новую ссылку.",
      );
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    const confirmation = String(data.get("confirmation"));
    if (password !== confirmation) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await updatePassword(token, password);
      setComplete(true);
      window.history.replaceState(null, "", "/reset-password");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось изменить пароль. Запросите новую ссылку и повторите попытку.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Новый пароль — Atlas</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AccountShell badge="Аккаунт Atlas">
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Восстановление доступа
            </p>
            <CardTitle className="text-2xl tracking-tight">
              Создать новый пароль
            </CardTitle>
            <CardDescription>
              Используйте не менее 8 символов. Новый пароль можно сохранить в
              менеджере паролей.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {complete ? (
              <div className="space-y-4" role="status">
                <Alert>
                  <CircleCheck />
                  <AlertDescription>
                    Пароль изменён. Теперь войдите с новым паролем.
                  </AlertDescription>
                </Alert>
                <Button asChild className="w-full">
                  <Link href="/auth">Перейти ко входу</Link>
                </Button>
              </div>
            ) : linkError ? (
              <div className="space-y-4">
                <Alert variant="destructive" role="alert">
                  <CircleAlert />
                  <AlertDescription>{linkError}</AlertDescription>
                </Alert>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/forgot-password">Запросить новую ссылку</Link>
                </Button>
              </div>
            ) : (
              <>
                <form className="space-y-4" onSubmit={submit}>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Новый пароль</Label>
                    <Input
                      id="new-password"
                      name="password"
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Повторите пароль</Label>
                    <Input
                      id="confirm-password"
                      name="confirmation"
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !token}
                  >
                    {loading ? "Сохраняем…" : "Сохранить пароль"}
                  </Button>
                </form>
                {error && (
                  <Alert variant="destructive" role="alert">
                    <CircleAlert />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </AccountShell>
    </>
  );
}
