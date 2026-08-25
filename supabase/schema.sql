create extension if not exists pgcrypto;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (category in ('documents','health','food','work','family','leisure')),
  address text not null check (char_length(address) between 2 and 200),
  description text not null check (char_length(description) between 2 and 1000),
  longitude double precision not null check (longitude between -180 and 180),
  latitude double precision not null check (latitude between -90 and 90),
  verified_count integer not null default 0 check (verified_count >= 0),
  added_by text not null default 'Гость' check (char_length(added_by) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  author text not null default 'Гость' check (char_length(author) between 1 and 80),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.places enable row level security;
alter table public.comments enable row level security;
revoke all on public.places, public.comments from anon, authenticated;
grant select, insert on public.places, public.comments to anon, authenticated;

drop policy if exists "places_are_public" on public.places;
drop policy if exists "visitors_can_suggest_places" on public.places;
drop policy if exists "comments_are_public" on public.comments;
drop policy if exists "visitors_can_comment" on public.comments;
create policy "places_are_public" on public.places for select to anon, authenticated using (true);
create policy "visitors_can_suggest_places" on public.places for insert to anon, authenticated with check (true);
create policy "comments_are_public" on public.comments for select to anon, authenticated using (true);
create policy "visitors_can_comment" on public.comments for insert to anon, authenticated with check (true);

create or replace function public.confirm_place(target_place_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare new_count integer;
begin
  update public.places set verified_count = verified_count + 1 where id = target_place_id returning verified_count into new_count;
  if new_count is null then raise exception 'Place not found'; end if;
  return new_count;
end $$;
revoke all on function public.confirm_place(uuid) from public;
grant execute on function public.confirm_place(uuid) to anon, authenticated;

insert into public.places (id,name,category,address,description,longitude,latitude,verified_count,added_by) values
('10000000-0000-4000-8000-000000000001','Phuket Immigration Office','documents','Phuket Road, Phuket Town','Иммиграционный офис: визы, продления и регистрация иностранцев.',98.3913,7.8663,18,'Анна К.'),
('10000000-0000-4000-8000-000000000002','HOMA Coworking','work','Samkong, Phuket Town','Коворкинг со стабильным Wi‑Fi, переговорными и зонами для звонков.',98.3837,7.9061,31,'Илья'),
('10000000-0000-4000-8000-000000000003','Bangkok Hospital Phuket','health','Hongyok Utis Road','Международная частная клиника. Персонал говорит по-английски.',98.3827,7.9041,12,'София'),
('10000000-0000-4000-8000-000000000004','Naka Weekend Market','food','Wirat Hong Yok Road','Большой вечерний рынок с тайской едой, фруктами и локальными продуктами.',98.3729,7.8807,46,'Команда Atlas'),
('10000000-0000-4000-8000-000000000005','Karon Viewpoint','leisure','Karon, Mueang Phuket','Смотровая площадка с видом на пляжи Ката Ной, Ката и Карон.',98.3026,7.7973,73,'Команда Atlas'),
('10000000-0000-4000-8000-000000000006','Rawai Park','family','Rawai, Mueang Phuket','Семейный парк с игровыми зонами и бассейном для детей.',98.3278,7.7799,9,'Мария')
on conflict (id) do nothing;
