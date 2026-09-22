# Atlas database setup

Run the SQL files in the Supabase SQL editor in this order:

1. `schema.sql`
2. `admin.sql`
3. `hardening.sql`
4. `social.sql`
5. `auth.sql`

For the current Atlas database, run only `auth.sql`. It is idempotent and changes community writes from anonymous visitor IDs to verified Supabase users. Re-run it after pulling changes to it.

The `place-photos` Storage bucket is created by `social.sql`.

New places and photos from signed-in users are published immediately. Moderation happens afterwards: visitors report problems, and an administrator hides or deletes content from the Atlas admin page.

## Administrators

Admin rights are granted by email through the `admin_users` table. `is_atlas_admin()` compares it with the email of the signed-in Supabase user. To add an administrator, have them sign up in Atlas first, then run:

```sql
insert into public.admin_users (email) values ('person@example.com') on conflict (email) do nothing;
```
