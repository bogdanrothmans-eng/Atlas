alter table public.places add column if not exists status text not null default 'published' check (status in ('published','hidden'));
create table if not exists public.admin_users (email text primary key, created_at timestamptz not null default now());
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
insert into public.admin_users (email) values ('gogachij@gmail.com') on conflict (email) do nothing;

drop policy if exists "places_are_public" on public.places;
create policy "places_are_public" on public.places for select to anon, authenticated using (status = 'published');

create or replace function public.is_atlas_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_users where lower(email) = lower(coalesce(auth.jwt()->>'email','')));
$$;

create or replace function public.admin_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_atlas_admin() then raise exception 'Доступ разрешён только администратору'; end if;
  return jsonb_build_object(
    'places', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.places p), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'place_id',c.place_id,'place_name',p.name,'author',c.author,'body',c.body,'created_at',c.created_at) order by c.created_at desc) from public.comments c join public.places p on p.id=c.place_id), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_set_place_status(target_place_id uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_atlas_admin() then raise exception 'Доступ запрещён'; end if;
  if new_status not in ('published','hidden') then raise exception 'Недопустимый статус'; end if;
  update public.places set status = new_status where id = target_place_id;
end $$;

create or replace function public.admin_delete_comment(target_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_atlas_admin() then raise exception 'Доступ запрещён'; end if;
  delete from public.comments where id = target_comment_id;
end $$;

create or replace function public.admin_update_place(target_place_id uuid, new_name text, new_category text, new_address text, new_description text, new_longitude double precision, new_latitude double precision)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_atlas_admin() then raise exception 'Доступ запрещён'; end if;
  if new_category not in ('documents','health','food','work','family','leisure') then raise exception 'Недопустимая категория'; end if;
  update public.places set name=new_name, category=new_category, address=new_address, description=new_description, longitude=new_longitude, latitude=new_latitude where id=target_place_id;
end $$;

create or replace function public.admin_update_comment(target_comment_id uuid, new_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_atlas_admin() then raise exception 'Доступ запрещён'; end if;
  if char_length(trim(new_body)) < 1 then raise exception 'Комментарий не может быть пустым'; end if;
  update public.comments set body=trim(new_body) where id=target_comment_id;
end $$;

revoke all on function public.is_atlas_admin() from public;
revoke all on function public.admin_dashboard() from public;
revoke all on function public.admin_set_place_status(uuid,text) from public;
revoke all on function public.admin_delete_comment(uuid) from public;
revoke all on function public.admin_update_place(uuid,text,text,text,text,double precision,double precision) from public;
revoke all on function public.admin_update_comment(uuid,text) from public;
grant execute on function public.is_atlas_admin(), public.admin_dashboard(), public.admin_set_place_status(uuid,text), public.admin_delete_comment(uuid), public.admin_update_place(uuid,text,text,text,text,double precision,double precision), public.admin_update_comment(uuid,text) to authenticated;
