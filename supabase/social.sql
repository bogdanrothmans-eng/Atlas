-- Social features for Atlas. Run after schema.sql, admin.sql and hardening.sql.
-- Safe to run repeatedly on an existing project.

alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column if not exists status text not null default 'published';

do $$ begin
  alter table public.comments add constraint comments_status_check check (status in ('published','hidden'));
exception when duplicate_object then null;
end $$;

create index if not exists comments_place_created_idx on public.comments(place_id, created_at);
create index if not exists comments_parent_idx on public.comments(parent_id) where parent_id is not null;

create table if not exists public.place_reactions (
  place_id uuid not null references public.places(id) on delete cascade,
  visitor_id uuid not null,
  reaction smallint not null check (reaction in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (place_id, visitor_id)
);

create table if not exists public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 10 and 500),
  caption text not null default '' check (char_length(caption) <= 240),
  alt_text text not null default '' check (char_length(alt_text) <= 240),
  visitor_id uuid not null,
  status text not null default 'hidden' check (status in ('published','hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.place_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  visitor_id uuid not null,
  reason text not null check (reason in ('inaccurate','closed','spam','harmful','duplicate','other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'new' check (status in ('new','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (place_id, visitor_id)
);

create index if not exists place_photos_place_status_idx on public.place_photos(place_id, status, created_at);
create index if not exists place_reports_status_created_idx on public.place_reports(status, created_at desc);

alter table public.place_reactions enable row level security;
alter table public.place_photos enable row level security;
alter table public.place_reports enable row level security;
revoke all on public.place_reactions, public.place_photos, public.place_reports from anon, authenticated;

drop policy if exists "comments_are_public" on public.comments;
create policy "comments_are_public" on public.comments for select to anon, authenticated using (status = 'published');

-- Extend the server-side cooldown registry introduced in hardening.sql.
alter table public.submission_limits drop constraint if exists submission_limits_action_check;
alter table public.submission_limits add constraint submission_limits_action_check check (action in ('place','comment','photo','report'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "atlas_visitors_upload_place_photos" on storage.objects;
create policy "atlas_visitors_upload_place_photos" on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'place-photos'
  and storage.extension(name) in ('jpg','jpeg','png','webp')
  and array_length(storage.foldername(name), 1) >= 2
);

create or replace function public.atlas_places(visitor_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'category', p.category,
      'address', p.address,
      'description', p.description,
      'longitude', p.longitude,
      'latitude', p.latitude,
      'added_by', p.added_by,
      'created_at', p.created_at,
      'likes', (select count(*) from public.place_reactions r where r.place_id = p.id and r.reaction = 1),
      'dislikes', (select count(*) from public.place_reactions r where r.place_id = p.id and r.reaction = -1),
      'my_reaction', (select r.reaction from public.place_reactions r where r.place_id = p.id and r.visitor_id = $1),
      'comments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'author', c.author,
          'body', c.body,
          'parent_id', c.parent_id,
          'created_at', c.created_at
        ) order by c.created_at asc)
        from public.comments c
        where c.place_id = p.id and c.status = 'published'
      ), '[]'::jsonb),
      'photos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', ph.id,
          'storage_path', ph.storage_path,
          'caption', ph.caption,
          'alt_text', ph.alt_text,
          'created_at', ph.created_at
        ) order by ph.created_at asc)
        from public.place_photos ph
        where ph.place_id = p.id and ph.status = 'published'
      ), '[]'::jsonb)
    ) order by p.created_at asc
  ), '[]'::jsonb)
  from public.places p
  where p.status = 'published';
$$;

create or replace function public.react_to_place(target_place_id uuid, client_id uuid, new_reaction smallint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare current_reaction smallint;
declare result_reaction smallint;
begin
  if new_reaction not in (-1, 1) then raise exception 'Недопустимая реакция'; end if;
  if not exists(select 1 from public.places where id = target_place_id and status = 'published') then
    raise exception 'Место не найдено';
  end if;

  select reaction into current_reaction from public.place_reactions
  where place_id = target_place_id and visitor_id = client_id;

  if current_reaction = new_reaction then
    delete from public.place_reactions where place_id = target_place_id and visitor_id = client_id;
    result_reaction := null;
  else
    insert into public.place_reactions (place_id, visitor_id, reaction)
    values (target_place_id, client_id, new_reaction)
    on conflict (place_id, visitor_id) do update
      set reaction = excluded.reaction, updated_at = now();
    result_reaction := new_reaction;
  end if;

  return jsonb_build_object(
    'likes', (select count(*) from public.place_reactions where place_id = target_place_id and reaction = 1),
    'dislikes', (select count(*) from public.place_reactions where place_id = target_place_id and reaction = -1),
    'my_reaction', result_reaction
  );
end $$;

create or replace function public.submit_comment_v2(
  new_id uuid,
  target_place_id uuid,
  parent_comment_id uuid,
  new_author text,
  new_body text,
  client_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare last_submission timestamptz;
declare created_comment public.comments;
begin
  if char_length(trim(new_body)) < 1 then raise exception 'Комментарий не может быть пустым'; end if;
  if parent_comment_id is not null and not exists(
    select 1 from public.comments where id = parent_comment_id and place_id = target_place_id and status = 'published'
  ) then raise exception 'Комментарий для ответа не найден'; end if;

  perform pg_advisory_xact_lock(hashtextextended(client_id::text || ':comment', 0));
  select last_submitted_at into last_submission from public.submission_limits
  where submission_limits.visitor_id = client_id and action = 'comment';
  if last_submission is not null and last_submission > now() - interval '30 seconds' then
    raise exception 'Подождите 30 секунд перед следующим комментарием';
  end if;

  insert into public.comments (id, place_id, parent_id, author, body, status)
  values (new_id, target_place_id, parent_comment_id, coalesce(nullif(trim(new_author), ''), 'Гость'), trim(new_body), 'published')
  returning * into created_comment;

  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (client_id, 'comment', now())
  on conflict (visitor_id, action) do update set last_submitted_at = excluded.last_submitted_at;

  return jsonb_build_object(
    'id', created_comment.id,
    'author', created_comment.author,
    'body', created_comment.body,
    'parent_id', created_comment.parent_id,
    'created_at', created_comment.created_at
  );
end $$;

create or replace function public.submit_place_photo(
  new_id uuid,
  target_place_id uuid,
  new_storage_path text,
  new_caption text,
  new_alt_text text,
  client_id uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare last_submission timestamptz;
begin
  if split_part(new_storage_path, '/', 1) <> target_place_id::text
    or split_part(new_storage_path, '/', 2) <> client_id::text then
    raise exception 'Недопустимый путь к файлу';
  end if;
  if not exists(select 1 from storage.objects where bucket_id = 'place-photos' and name = new_storage_path) then
    raise exception 'Файл не найден';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(client_id::text || ':photo', 0));
  select last_submitted_at into last_submission from public.submission_limits
  where submission_limits.visitor_id = client_id and action = 'photo';
  if last_submission is not null and last_submission > now() - interval '60 seconds' then
    raise exception 'Следующее фото можно отправить через минуту';
  end if;

  insert into public.place_photos (id, place_id, storage_path, caption, alt_text, visitor_id, status)
  values (new_id, target_place_id, new_storage_path, trim(new_caption), trim(new_alt_text), client_id, 'hidden');
  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (client_id, 'photo', now())
  on conflict (visitor_id, action) do update set last_submitted_at = excluded.last_submitted_at;
  return new_id;
end $$;

create or replace function public.submit_place_report(
  target_place_id uuid,
  client_id uuid,
  new_reason text,
  new_details text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare report_id uuid;
declare last_submission timestamptz;
begin
  if new_reason not in ('inaccurate','closed','spam','harmful','duplicate','other') then
    raise exception 'Выберите причину жалобы';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(client_id::text || ':report', 0));
  select last_submitted_at into last_submission from public.submission_limits
  where submission_limits.visitor_id = client_id and action = 'report';
  if last_submission is not null and last_submission > now() - interval '60 seconds' then
    raise exception 'Подождите минуту перед следующей жалобой';
  end if;

  insert into public.place_reports (place_id, visitor_id, reason, details, status, reviewed_at)
  values (target_place_id, client_id, new_reason, trim(new_details), 'new', null)
  on conflict (place_id, visitor_id) do update
    set reason = excluded.reason, details = excluded.details, status = 'new', created_at = now(), reviewed_at = null
  returning id into report_id;
  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (client_id, 'report', now())
  on conflict (visitor_id, action) do update set last_submitted_at = excluded.last_submitted_at;
  return report_id;
end $$;

create or replace function public.admin_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_atlas_admin() then raise exception 'Доступ разрешён только администратору'; end if;
  return jsonb_build_object(
    'places', coalesce((select jsonb_agg(
      to_jsonb(p) || jsonb_build_object(
        'likes', (select count(*) from public.place_reactions r where r.place_id = p.id and r.reaction = 1),
        'dislikes', (select count(*) from public.place_reactions r where r.place_id = p.id and r.reaction = -1),
        'comment_count', (select count(*) from public.comments c where c.place_id = p.id and c.status = 'published')
      ) order by p.created_at desc
    ) from public.places p), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'place_id',c.place_id,'place_name',p.name,'parent_id',c.parent_id,
      'author',c.author,'body',c.body,'status',c.status,'created_at',c.created_at
    ) order by c.created_at desc) from public.comments c join public.places p on p.id=c.place_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'place_id',r.place_id,'place_name',p.name,'reason',r.reason,
      'details',r.details,'status',r.status,'created_at',r.created_at
    ) order by (r.status = 'new') desc, r.created_at desc) from public.place_reports r join public.places p on p.id=r.place_id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object(
      'id',ph.id,'place_id',ph.place_id,'place_name',p.name,'storage_path',ph.storage_path,
      'caption',ph.caption,'alt_text',ph.alt_text,'status',ph.status,'created_at',ph.created_at
    ) order by ph.created_at desc) from public.place_photos ph join public.places p on p.id=ph.place_id), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_resolve_report(target_report_id uuid, new_status text, hide_place boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare target_place uuid;
begin
  if not public.is_atlas_admin() then raise exception 'Доступ запрещён'; end if;
  if new_status not in ('reviewed','resolved','dismissed') then raise exception 'Недопустимый статус'; end if;
  update public.place_reports set status = new_status, reviewed_at = now()
  where id = target_report_id returning place_id into target_place;
  if hide_place and target_place is not null then update public.places set status = 'hidden' where id = target_place; end if;
end $$;

create or replace function public.admin_set_photo_status(target_photo_id uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_atlas_admin() then raise exception 'Доступ запрещён'; end if;
  if new_status not in ('published','hidden') then raise exception 'Недопустимый статус'; end if;
  update public.place_photos set status = new_status where id = target_photo_id;
end $$;

create or replace function public.admin_delete_photo(target_photo_id uuid)
returns void language plpgsql security definer set search_path = public, storage as $$
declare target_path text;
begin
  if not public.is_atlas_admin() then raise exception 'Доступ запрещён'; end if;
  select storage_path into target_path from public.place_photos where id = target_photo_id;
  delete from storage.objects where bucket_id = 'place-photos' and name = target_path;
  delete from public.place_photos where id = target_photo_id;
end $$;

revoke all on function public.atlas_places(uuid) from public;
revoke all on function public.react_to_place(uuid,uuid,smallint) from public;
revoke all on function public.submit_comment_v2(uuid,uuid,uuid,text,text,uuid) from public;
revoke all on function public.submit_place_photo(uuid,uuid,text,text,text,uuid) from public;
revoke all on function public.submit_place_report(uuid,uuid,text,text) from public;
revoke all on function public.admin_dashboard() from public;
revoke all on function public.admin_resolve_report(uuid,text,boolean) from public;
revoke all on function public.admin_set_photo_status(uuid,text) from public;
revoke all on function public.admin_delete_photo(uuid) from public;

grant execute on function public.atlas_places(uuid) to anon, authenticated;
grant execute on function public.react_to_place(uuid,uuid,smallint) to anon, authenticated;
grant execute on function public.submit_comment_v2(uuid,uuid,uuid,text,text,uuid) to anon, authenticated;
grant execute on function public.submit_place_photo(uuid,uuid,text,text,text,uuid) to anon, authenticated;
grant execute on function public.submit_place_report(uuid,uuid,text,text) to anon, authenticated;
grant execute on function public.admin_dashboard(), public.admin_resolve_report(uuid,text,boolean), public.admin_set_photo_status(uuid,text), public.admin_delete_photo(uuid) to authenticated;
