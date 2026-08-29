-- Authenticated community actions for Atlas.
-- Run after social.sql. Safe to run repeatedly on an existing project.

drop policy if exists "atlas_visitors_upload_place_photos" on storage.objects;
drop policy if exists "atlas_members_upload_place_photos" on storage.objects;
create policy "atlas_members_upload_place_photos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'place-photos'
  and storage.extension(name) in ('jpg','jpeg','png','webp')
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[2] = auth.uid()::text
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
      'my_reaction', (select r.reaction from public.place_reactions r where r.place_id = p.id and r.visitor_id = auth.uid()),
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
declare current_user_id uuid := auth.uid();
declare last_submission timestamptz;
declare display_name text;
begin
  if current_user_id is null then raise exception 'Войдите в аккаунт'; end if;
  display_name := left(coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'preferred_username'), ''),
    nullif(trim(auth.jwt() ->> 'email'), ''),
    'Пользователь'
  ), 80);

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':place', 0));
  select last_submitted_at into last_submission from public.submission_limits
  where submission_limits.visitor_id = current_user_id and action = 'place';
  if last_submission is not null and last_submission > now() - interval '10 minutes' then
    raise exception 'Новое место можно отправить не чаще одного раза в 10 минут';
  end if;

  insert into public.places (id, name, category, address, description, longitude, latitude, added_by, status)
  values (new_id, trim(new_name), new_category, trim(new_address), trim(new_description),
    new_longitude, new_latitude, display_name, 'hidden');

  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (current_user_id, 'place', now())
  on conflict (visitor_id, action) do update set last_submitted_at = excluded.last_submitted_at;
  return new_id;
end $$;

create or replace function public.react_to_place(target_place_id uuid, client_id uuid, new_reaction smallint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare current_user_id uuid := auth.uid();
declare current_reaction smallint;
declare result_reaction smallint;
begin
  if current_user_id is null then raise exception 'Войдите в аккаунт'; end if;
  if new_reaction not in (-1, 1) then raise exception 'Недопустимая реакция'; end if;
  if not exists(select 1 from public.places where id = target_place_id and status = 'published') then
    raise exception 'Место не найдено';
  end if;

  select reaction into current_reaction from public.place_reactions
  where place_id = target_place_id and visitor_id = current_user_id;
  if current_reaction = new_reaction then
    delete from public.place_reactions where place_id = target_place_id and visitor_id = current_user_id;
    result_reaction := null;
  else
    insert into public.place_reactions (place_id, visitor_id, reaction)
    values (target_place_id, current_user_id, new_reaction)
    on conflict (place_id, visitor_id) do update set reaction = excluded.reaction, updated_at = now();
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
declare current_user_id uuid := auth.uid();
declare last_submission timestamptz;
declare created_comment public.comments;
declare display_name text;
begin
  if current_user_id is null then raise exception 'Войдите в аккаунт'; end if;
  if char_length(trim(new_body)) < 1 then raise exception 'Комментарий не может быть пустым'; end if;
  if parent_comment_id is not null and not exists(
    select 1 from public.comments where id = parent_comment_id and place_id = target_place_id and status = 'published'
  ) then raise exception 'Комментарий для ответа не найден'; end if;
  display_name := left(coalesce(
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'preferred_username'), ''),
    nullif(trim(auth.jwt() ->> 'email'), ''),
    'Пользователь'
  ), 80);

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':comment', 0));
  select last_submitted_at into last_submission from public.submission_limits
  where submission_limits.visitor_id = current_user_id and action = 'comment';
  if last_submission is not null and last_submission > now() - interval '30 seconds' then
    raise exception 'Подождите 30 секунд перед следующим комментарием';
  end if;

  insert into public.comments (id, place_id, parent_id, author, body, status)
  values (new_id, target_place_id, parent_comment_id, display_name, trim(new_body), 'published')
  returning * into created_comment;
  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (current_user_id, 'comment', now())
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
declare current_user_id uuid := auth.uid();
declare last_submission timestamptz;
begin
  if current_user_id is null then raise exception 'Войдите в аккаунт'; end if;
  if split_part(new_storage_path, '/', 1) <> target_place_id::text
    or split_part(new_storage_path, '/', 2) <> current_user_id::text then
    raise exception 'Недопустимый путь к файлу';
  end if;
  if not exists(select 1 from storage.objects where bucket_id = 'place-photos' and name = new_storage_path) then
    raise exception 'Файл не найден';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':photo', 0));
  select last_submitted_at into last_submission from public.submission_limits
  where submission_limits.visitor_id = current_user_id and action = 'photo';
  if last_submission is not null and last_submission > now() - interval '60 seconds' then
    raise exception 'Следующее фото можно отправить через минуту';
  end if;

  insert into public.place_photos (id, place_id, storage_path, caption, alt_text, visitor_id, status)
  values (new_id, target_place_id, new_storage_path, trim(new_caption), trim(new_alt_text), current_user_id, 'hidden');
  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (current_user_id, 'photo', now())
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
declare current_user_id uuid := auth.uid();
declare report_id uuid;
declare last_submission timestamptz;
begin
  if current_user_id is null then raise exception 'Войдите в аккаунт'; end if;
  if new_reason not in ('inaccurate','closed','spam','harmful','duplicate','other') then
    raise exception 'Выберите причину жалобы';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':report', 0));
  select last_submitted_at into last_submission from public.submission_limits
  where submission_limits.visitor_id = current_user_id and action = 'report';
  if last_submission is not null and last_submission > now() - interval '60 seconds' then
    raise exception 'Подождите минуту перед следующей жалобой';
  end if;

  insert into public.place_reports (place_id, visitor_id, reason, details, status, reviewed_at)
  values (target_place_id, current_user_id, new_reason, trim(new_details), 'new', null)
  on conflict (place_id, visitor_id) do update
    set reason = excluded.reason, details = excluded.details, status = 'new', created_at = now(), reviewed_at = null
  returning id into report_id;
  insert into public.submission_limits (visitor_id, action, last_submitted_at)
  values (current_user_id, 'report', now())
  on conflict (visitor_id, action) do update set last_submitted_at = excluded.last_submitted_at;
  return report_id;
end $$;

revoke all on function public.atlas_places(uuid) from public;
revoke all on function public.submit_place(uuid,text,text,text,text,double precision,double precision,text,uuid) from public;
revoke all on function public.submit_comment(uuid,uuid,text,text,uuid) from public;
revoke all on function public.submit_comment_v2(uuid,uuid,uuid,text,text,uuid) from public;
revoke all on function public.confirm_place(uuid,uuid) from public;
revoke all on function public.react_to_place(uuid,uuid,smallint) from public;
revoke all on function public.submit_place_photo(uuid,uuid,text,text,text,uuid) from public;
revoke all on function public.submit_place_report(uuid,uuid,text,text) from public;

revoke execute on function public.submit_place(uuid,text,text,text,text,double precision,double precision,text,uuid) from anon;
revoke execute on function public.submit_comment(uuid,uuid,text,text,uuid) from anon, authenticated;
revoke execute on function public.submit_comment_v2(uuid,uuid,uuid,text,text,uuid) from anon;
revoke execute on function public.confirm_place(uuid,uuid) from anon, authenticated;
revoke execute on function public.react_to_place(uuid,uuid,smallint) from anon;
revoke execute on function public.submit_place_photo(uuid,uuid,text,text,text,uuid) from anon;
revoke execute on function public.submit_place_report(uuid,uuid,text,text) from anon;

grant execute on function public.atlas_places(uuid) to anon, authenticated;
grant execute on function public.submit_place(uuid,text,text,text,text,double precision,double precision,text,uuid) to authenticated;
grant execute on function public.submit_comment_v2(uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.react_to_place(uuid,uuid,smallint) to authenticated;
grant execute on function public.submit_place_photo(uuid,uuid,text,text,text,uuid) to authenticated;
grant execute on function public.submit_place_report(uuid,uuid,text,text) to authenticated;
