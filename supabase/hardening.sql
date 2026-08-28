-- Run after schema.sql and admin.sql. Safe to run repeatedly on an existing Atlas project.

alter table public.places alter column status set default 'hidden';

drop policy if exists "visitors_can_suggest_places" on public.places;
drop policy if exists "visitors_can_comment" on public.comments;
revoke insert on public.places, public.comments from anon, authenticated;

create table if not exists public.submission_limits (
  visitor_id uuid not null,
  action text not null check (action in ('place','comment')),
  last_submitted_at timestamptz not null default now(),
  primary key (visitor_id, action)
);

create table if not exists public.place_confirmations (
  place_id uuid not null references public.places(id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (place_id, visitor_id)
);

alter table public.submission_limits enable row level security;
alter table public.place_confirmations enable row level security;
revoke all on public.submission_limits, public.place_confirmations from anon, authenticated;

create or replace function public.submit_place(
  new_id uuid,
  new_name text,
  new_category text,
  new_address text,
  new_description text,
  new_longitude double precision,
  new_latitude double precision,
  new_added_by text,
  client_id uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare last_submission timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(client_id::text || ':place', 0));
  select last_submitted_at into last_submission
  from public.submission_limits
  where submission_limits.visitor_id = client_id and action = 'place';

  if last_submission is not null and last_submission > now() - interval '10 minutes' then
    raise exception 'Новое место можно отправить не чаще одного раза в 10 минут';
  end if;

  insert into public.places (
    id, name, category, address, description, longitude, latitude, added_by, status
  ) values (
    new_id, trim(new_name), new_category, trim(new_address), trim(new_description),
    new_longitude, new_latitude, coalesce(nullif(trim(new_added_by), ''), 'Гость'), 'hidden'
  );

  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (client_id, 'place', now())
  on conflict (visitor_id, action) do update set last_submitted_at = excluded.last_submitted_at;

  return new_id;
end $$;

create or replace function public.submit_comment(
  new_id uuid,
  target_place_id uuid,
  new_author text,
  new_body text,
  client_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare last_submission timestamptz;
declare created_comment public.comments;
begin
  perform pg_advisory_xact_lock(hashtextextended(client_id::text || ':comment', 0));
  select last_submitted_at into last_submission
  from public.submission_limits
  where submission_limits.visitor_id = client_id and action = 'comment';

  if last_submission is not null and last_submission > now() - interval '30 seconds' then
    raise exception 'Подождите 30 секунд перед следующим комментарием';
  end if;

  insert into public.comments (id, place_id, author, body)
  values (
    new_id,
    target_place_id,
    coalesce(nullif(trim(new_author), ''), 'Гость'),
    trim(new_body)
  ) returning * into created_comment;

  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (client_id, 'comment', now())
  on conflict (visitor_id, action) do update set last_submitted_at = excluded.last_submitted_at;

  return jsonb_build_object(
    'id', created_comment.id,
    'author', created_comment.author,
    'body', created_comment.body,
    'created_at', created_comment.created_at
  );
end $$;

drop function if exists public.confirm_place(uuid);
create or replace function public.confirm_place(target_place_id uuid, client_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
declare current_count integer;
begin
  insert into public.place_confirmations (place_id, visitor_id)
  values (target_place_id, client_id)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.places
    set verified_count = verified_count + 1
    where id = target_place_id
    returning verified_count into current_count;
  else
    select verified_count into current_count from public.places where id = target_place_id;
  end if;

  if current_count is null then raise exception 'Место не найдено'; end if;
  return current_count;
end $$;

revoke all on function public.submit_place(uuid,text,text,text,text,double precision,double precision,text,uuid) from public;
revoke all on function public.submit_comment(uuid,uuid,text,text,uuid) from public;
revoke all on function public.confirm_place(uuid,uuid) from public;
grant execute on function public.submit_place(uuid,text,text,text,text,double precision,double precision,text,uuid) to anon, authenticated;
grant execute on function public.submit_comment(uuid,uuid,text,text,uuid) to anon, authenticated;
grant execute on function public.confirm_place(uuid,uuid) to anon, authenticated;
