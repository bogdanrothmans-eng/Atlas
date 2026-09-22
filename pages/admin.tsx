import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CircleAlert,
  CircleCheck,
  Flag,
  MessageSquare,
  Search,
  User,
  X,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  currentToken,
  adminPhotoUrl,
  loadAdminDashboard,
  removeComment,
  resolveReport,
  setPhotoStatus,
  setPlaceStatus,
  signIn,
  signOut,
  updateComment,
  updatePlace,
  type AdminComment,
  type AdminPhoto,
  type AdminPlace,
  type AdminReport,
  type Dashboard,
} from "@/lib/adminRepository";

type DialogState =
  | { kind: "place"; item: AdminPlace }
  | { kind: "comment"; item: AdminComment }
  | { kind: "delete"; item: AdminComment }
  | null;

const categoryLabels: Record<string, string> = {
  documents: "Документы",
  health: "Медицина",
  food: "Еда",
  work: "Работа",
  family: "Для семьи",
  leisure: "Досуг",
};

const reportLabels: Record<AdminReport["reason"], string> = {
  inaccurate: "Неверная информация",
  closed: "Место закрыто",
  spam: "Спам или реклама",
  harmful: "Опасный контент",
  duplicate: "Дубликат",
  other: "Другое",
};

const reportStatusLabels: Record<AdminReport["status"], string> = {
  new: "Новая",
  reviewed: "На проверке",
  resolved: "Решена",
  dismissed: "Отклонена",
};

function EmptyState({
  icon: EmptyIcon,
  title,
  text,
  children,
}: {
  icon: typeof Flag;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <EmptyIcon className="size-5" aria-hidden="true" />
      <strong className="text-foreground text-sm font-medium">{title}</strong>
      <p className="text-sm">{text}</p>
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {eyebrow}
      </p>
      <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      {action}
    </CardHeader>
  );
}

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editCategory, setEditCategory] = useState("documents");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await loadAdminDashboard());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Нет доступа к данным Atlas");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentToken()) void refresh();
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await signIn(String(data.get("email")), String(data.get("password")));
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось войти. Проверьте данные и повторите попытку.",
      );
      setLoading(false);
    }
  };

  const places = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (
      dashboard?.places.filter((place) =>
        `${place.name} ${place.address}`.toLowerCase().includes(normalizedQuery),
      ) ?? []
    );
  }, [dashboard, query]);

  const moderate = async (item: AdminPlace) => {
    setLoading(true);
    setError("");
    try {
      await setPlaceStatus(
        item.id,
        item.status === "published" ? "hidden" : "published",
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось изменить видимость места. Повторите попытку.",
      );
      setLoading(false);
    }
  };

  const moderateReport = async (
    item: AdminReport,
    status: "reviewed" | "resolved" | "dismissed",
    hidePlace = false,
  ) => {
    setLoading(true);
    setError("");
    try {
      await resolveReport(item.id, status, hidePlace);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось обработать жалобу");
      setLoading(false);
    }
  };

  const moderatePhoto = async (item: AdminPhoto, status: "published" | "hidden") => {
    setLoading(true);
    setError("");
    try {
      await setPhotoStatus(item.id, status);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось обработать фото");
      setLoading(false);
    }
  };

  const savePlace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialog?.kind !== "place") return;
    const data = new FormData(event.currentTarget);
    const next = {
      ...dialog.item,
      name: String(data.get("name")).trim(),
      category: editCategory,
      address: String(data.get("address")).trim(),
      description: String(data.get("description")).trim(),
      longitude: Number(data.get("longitude")),
      latitude: Number(data.get("latitude")),
    };
    setLoading(true);
    setError("");
    try {
      await updatePlace(next);
      setDialog(null);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить место. Повторите попытку.",
      );
      setLoading(false);
    }
  };

  const saveComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialog?.kind !== "comment") return;
    const body = String(new FormData(event.currentTarget).get("body")).trim();
    setLoading(true);
    setError("");
    try {
      await updateComment(dialog.item.id, body);
      setDialog(null);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить комментарий. Повторите попытку.",
      );
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (dialog?.kind !== "delete") return;
    setLoading(true);
    setError("");
    try {
      await removeComment(dialog.item.id);
      setDialog(null);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось удалить комментарий. Повторите попытку.",
      );
      setLoading(false);
    }
  };

  const openPlaceDialog = (item: AdminPlace) => {
    setEditCategory(item.category);
    setDialog({ kind: "place", item });
  };

  const newReports = dashboard?.reports.filter((report) => report.status === "new") ?? [];
  const pendingPhotos = dashboard?.photos.filter((photo) => photo.status === "hidden") ?? [];

  return (
    <>
      <Head>
        <title>Управление Atlas</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="bg-muted/40 flex min-h-svh flex-col">
        <header className="bg-background flex h-14 items-center gap-3 border-b px-4 sm:px-6">
          <Brand label="Вернуться на карту Atlas" />
          <Badge variant="secondary">Управление</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft /> Карта
              </Link>
            </Button>
            {dashboard && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  signOut();
                  setDashboard(null);
                }}
              >
                Выйти
              </Button>
            )}
          </div>
        </header>

        {!dashboard ? (
          <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
            <Card className="w-full max-w-md" aria-labelledby="login-title">
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="bg-muted grid size-10 place-items-center rounded-full">
                    <User className="size-4" aria-hidden="true" />
                  </div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Закрытый раздел
                  </p>
                  <h1
                    id="login-title"
                    className="text-2xl font-semibold tracking-tight"
                  >
                    Вход администратора
                  </h1>
                  <p className="text-muted-foreground text-sm text-pretty">
                    Войдите в аккаунт с доступом к модерации мест, жалоб, фото и
                    комментариев.
                  </p>
                </div>
                <form
                  className="space-y-4"
                  onSubmit={login}
                  aria-describedby={error ? "login-error" : undefined}
                >
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      spellCheck={false}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Пароль</Label>
                    <div className="flex gap-2">
                      <Input
                        id="admin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? "Скрыть" : "Показать"}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Входим…" : "Войти"}
                  </Button>
                </form>
                {error && (
                  <Alert id="login-error" variant="destructive" role="alert">
                    <CircleAlert />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button asChild variant="link" className="w-full">
                  <Link href="/forgot-password">Восстановить пароль</Link>
                </Button>
              </CardContent>
            </Card>
          </main>
        ) : (
          <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Панель администратора
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Управление Atlas
                </h1>
                <p className="text-muted-foreground text-sm">
                  Проверяйте места, жалобы, фото и обсуждения сообщества.
                </p>
              </div>
              <Button variant="outline" onClick={refresh} disabled={loading}>
                {loading ? "Обновляем…" : "Обновить данные"}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" role="alert">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <section
              className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5"
              aria-label="Статистика Atlas"
            >
              {[
                { label: "Всего мест", value: dashboard.places.length, attention: false },
                {
                  label: "Опубликовано",
                  value: dashboard.places.filter((place) => place.status === "published").length,
                  attention: false,
                },
                {
                  label: "Скрыто",
                  value: dashboard.places.filter((place) => place.status === "hidden").length,
                  attention: false,
                },
                { label: "Комментариев", value: dashboard.comments.length, attention: false },
                {
                  label: "Новых жалоб",
                  value: newReports.length,
                  attention: newReports.length > 0,
                },
              ].map((stat) => (
                <Card key={stat.label} className="gap-1 py-4">
                  <CardContent className="space-y-1 px-4">
                    <span className="text-muted-foreground text-sm">{stat.label}</span>
                    <strong
                      className={`block text-2xl font-semibold tabular-nums ${
                        stat.attention ? "text-destructive" : ""
                      }`}
                    >
                      {stat.value}
                    </strong>
                  </CardContent>
                </Card>
              ))}
            </section>

            <Tabs defaultValue="reports" className="gap-4">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="reports">Жалобы</TabsTrigger>
                <TabsTrigger value="photos">Фото</TabsTrigger>
                <TabsTrigger value="places">Места</TabsTrigger>
                <TabsTrigger value="comments">Комментарии</TabsTrigger>
              </TabsList>

              <TabsContent value="reports">
                <Card>
                  <SectionHeading
                    eyebrow="Модерация"
                    title="Жалобы пользователей"
                    description="Проверьте причину, закройте обращение или скройте нарушающую правила точку."
                    action={
                      <Badge
                        variant={newReports.length ? "destructive" : "secondary"}
                        className="col-start-2 row-span-2 row-start-1 self-start justify-self-end"
                      >
                        {newReports.length} новых
                      </Badge>
                    }
                  />
                  <CardContent className="space-y-3">
                    {dashboard.reports.length ? (
                      dashboard.reports.map((report) => (
                        <article
                          key={report.id}
                          className={`flex flex-wrap items-start gap-3 rounded-lg border p-4 ${
                            report.status === "new" ? "border-destructive/40 bg-destructive/5" : ""
                          }`}
                        >
                          <Flag
                            className="text-muted-foreground mt-1 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-56 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={report.status === "new" ? "destructive" : "secondary"}
                              >
                                {reportStatusLabels[report.status]}
                              </Badge>
                              <time className="text-muted-foreground text-xs">
                                {new Date(report.created_at).toLocaleDateString("ru")}
                              </time>
                            </div>
                            <h3 className="font-medium">{report.place_name}</h3>
                            <strong className="text-sm">{reportLabels[report.reason]}</strong>
                            {report.details && (
                              <p className="text-muted-foreground text-sm text-pretty">
                                {report.details}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {report.status === "new" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={loading}
                                onClick={() => moderateReport(report, "reviewed")}
                              >
                                Взять в работу
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={loading}
                              onClick={() => moderateReport(report, "dismissed")}
                            >
                              Отклонить
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={loading}
                              onClick={() => moderateReport(report, "resolved", true)}
                            >
                              Скрыть место
                            </Button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <EmptyState
                        icon={CircleCheck}
                        title="Новых жалоб нет"
                        text="Очередь модерации пуста."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="photos">
                <Card>
                  <SectionHeading
                    eyebrow="Фото сообщества"
                    title="Фотографии"
                    description="Публикуйте только полезные и подходящие снимки мест."
                    action={
                      <Badge
                        variant="secondary"
                        className="col-start-2 row-span-2 row-start-1 self-start justify-self-end"
                      >
                        {pendingPhotos.length} на проверке
                      </Badge>
                    }
                  />
                  <CardContent>
                    {dashboard.photos.length ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {dashboard.photos.map((photo) => (
                          <article
                            key={photo.id}
                            className="overflow-hidden rounded-lg border"
                          >
                            <div className="bg-muted relative aspect-video">
                              <Image
                                src={adminPhotoUrl(photo)}
                                alt={
                                  photo.alt_text ||
                                  photo.caption ||
                                  `Фото ${photo.place_name}`
                                }
                                fill
                                sizes="(max-width: 40rem) 100vw, 19rem"
                                className="object-cover"
                              />
                            </div>
                            <div className="space-y-2 p-3">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    photo.status === "published" ? "default" : "secondary"
                                  }
                                >
                                  {photo.status === "published"
                                    ? "Опубликовано"
                                    : "На проверке"}
                                </Badge>
                                <time className="text-muted-foreground text-xs">
                                  {new Date(photo.created_at).toLocaleDateString("ru")}
                                </time>
                              </div>
                              <h3 className="text-sm font-medium">{photo.place_name}</h3>
                              {photo.caption && (
                                <p className="text-muted-foreground text-sm">
                                  {photo.caption}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={loading || photo.status === "published"}
                                  onClick={() => moderatePhoto(photo, "published")}
                                >
                                  Опубликовать
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={loading || photo.status === "hidden"}
                                  onClick={() => moderatePhoto(photo, "hidden")}
                                >
                                  Скрыть
                                </Button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={Camera}
                        title="Фото пока нет"
                        text="Загруженные пользователями фотографии появятся здесь."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="places">
                <Card>
                  <SectionHeading
                    eyebrow="Контент карты"
                    title="Места"
                    description="Редактируйте данные и управляйте публикацией точек."
                  />
                  <CardContent className="space-y-4">
                    <div className="relative max-w-sm">
                      <Search
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <Label className="sr-only" htmlFor="admin-place-search">
                        Поиск мест по названию или адресу
                      </Label>
                      <Input
                        id="admin-place-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Название или адрес"
                        className="px-9"
                      />
                      {query && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Очистить поиск"
                          className="absolute top-1/2 right-0 size-9 -translate-y-1/2"
                          onClick={() => setQuery("")}
                        >
                          <X />
                        </Button>
                      )}
                    </div>

                    {places.length ? (
                      <Table>
                        <TableCaption className="sr-only">
                          Места на карте Atlas
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Место</TableHead>
                            <TableHead>Категория</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead className="text-right">Реакции</TableHead>
                            <TableHead className="text-right">Комментарии</TableHead>
                            <TableHead>
                              <span className="sr-only">Действия</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {places.map((place) => (
                            <TableRow key={place.id}>
                              <TableCell className="whitespace-normal">
                                <strong className="block font-medium">{place.name}</strong>
                                <small className="text-muted-foreground">
                                  {place.address}
                                </small>
                              </TableCell>
                              <TableCell>
                                {categoryLabels[place.category] ?? place.category}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    place.status === "published" ? "default" : "secondary"
                                  }
                                >
                                  {place.status === "published" ? "Опубликовано" : "Скрыто"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                +{place.likes} / −{place.dislikes}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {place.comment_count}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={loading}
                                    onClick={() => openPlaceDialog(place)}
                                  >
                                    Изменить
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={loading}
                                    onClick={() => moderate(place)}
                                  >
                                    {place.status === "published"
                                      ? "Скрыть"
                                      : "Опубликовать"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <EmptyState
                        icon={Search}
                        title="Места не найдены"
                        text="Измените запрос или очистите поиск."
                      >
                        {query && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuery("")}
                          >
                            Очистить поиск
                          </Button>
                        )}
                      </EmptyState>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments">
                <Card>
                  <SectionHeading
                    eyebrow="Обратная связь"
                    title="Комментарии"
                    description="Редактируйте или удаляйте сообщения пользователей."
                  />
                  <CardContent>
                    {dashboard.comments.length ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {dashboard.comments.map((comment) => (
                          <article
                            key={comment.id}
                            className="flex flex-col gap-3 rounded-lg border p-4"
                          >
                            <header className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>
                                  {comment.author.slice(0, 1).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <strong className="block truncate text-sm font-medium">
                                  {comment.author}
                                </strong>
                                <small className="text-muted-foreground block truncate">
                                  {comment.place_name}
                                </small>
                              </div>
                            </header>
                            <p className="flex-1 text-sm text-pretty">{comment.body}</p>
                            <footer className="flex items-center justify-between gap-2">
                              <time className="text-muted-foreground text-xs">
                                {new Date(comment.created_at).toLocaleDateString("ru")}
                              </time>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => setDialog({ kind: "comment", item: comment })}
                                >
                                  Изменить
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => setDialog({ kind: "delete", item: comment })}
                                >
                                  Удалить
                                </Button>
                              </div>
                            </footer>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={MessageSquare}
                        title="Комментариев пока нет"
                        text="Новые комментарии появятся здесь после публикации."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
        )}

        <Dialog
          open={Boolean(dialog)}
          onOpenChange={(open) => !open && setDialog(null)}
        >
          <DialogContent>
            {dialog?.kind === "place" && (
              <>
                <DialogHeader>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Место на карте
                  </p>
                  <DialogTitle>Редактировать место</DialogTitle>
                  <DialogDescription>
                    Изменения сразу появятся на карте сообщества.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={savePlace}>
                  <div className="space-y-2">
                    <Label htmlFor="edit-place-name">Название</Label>
                    <Input
                      id="edit-place-name"
                      name="name"
                      defaultValue={dialog.item.name}
                      maxLength={120}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-place-category">Категория</Label>
                    <Select value={editCategory} onValueChange={setEditCategory}>
                      <SelectTrigger id="edit-place-category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-place-address">Адрес</Label>
                    <Input
                      id="edit-place-address"
                      name="address"
                      defaultValue={dialog.item.address}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-place-description">Описание</Label>
                    <Textarea
                      id="edit-place-description"
                      name="description"
                      defaultValue={dialog.item.description}
                      maxLength={1000}
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-place-longitude">Долгота</Label>
                      <Input
                        id="edit-place-longitude"
                        name="longitude"
                        type="number"
                        step="any"
                        min={-180}
                        max={180}
                        defaultValue={dialog.item.longitude}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-place-latitude">Широта</Label>
                      <Input
                        id="edit-place-latitude"
                        name="latitude"
                        type="number"
                        step="any"
                        min={-90}
                        max={90}
                        defaultValue={dialog.item.latitude}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialog(null)}
                    >
                      Отменить
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Сохраняем…" : "Сохранить изменения"}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}

            {dialog?.kind === "comment" && (
              <>
                <DialogHeader>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Комментарий пользователя
                  </p>
                  <DialogTitle>Редактировать комментарий</DialogTitle>
                  <DialogDescription>
                    Текст изменится для всех участников Atlas.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={saveComment}>
                  <div className="space-y-2">
                    <Label htmlFor="edit-comment">Текст комментария</Label>
                    <Textarea
                      id="edit-comment"
                      name="body"
                      defaultValue={dialog.item.body}
                      maxLength={1000}
                      required
                      autoFocus
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialog(null)}
                    >
                      Отменить
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Сохраняем…" : "Сохранить комментарий"}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}

            {dialog?.kind === "delete" && (
              <>
                <DialogHeader>
                  <DialogTitle>Удалить комментарий?</DialogTitle>
                  <DialogDescription>
                    Комментарий пользователя «{dialog.item.author}» будет удалён
                    без возможности восстановления.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    autoFocus
                    onClick={() => setDialog(null)}
                  >
                    Отменить
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={loading}
                    onClick={confirmDelete}
                  >
                    {loading ? "Удаляем…" : "Удалить комментарий"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
