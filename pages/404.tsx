import Head from "next/head";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Страница не найдена — Atlas</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-start gap-4">
            <Brand />
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Ошибка 404
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-balance">
                Такой страницы нет
              </h1>
              <p className="text-muted-foreground text-sm text-pretty">
                Возможно, адрес изменился или в ссылке есть опечатка. Вернитесь
                на карту и продолжите поиск мест.
              </p>
            </div>
            <Button asChild>
              <Link href="/">
                <ArrowLeft /> Вернуться на карту
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
