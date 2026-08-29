# Atlas database setup

Run the SQL files in the Supabase SQL editor in this order:

1. `schema.sql`
2. `admin.sql`
3. `hardening.sql`
4. `social.sql`
5. `auth.sql`

For the current Atlas database, run only `auth.sql`. It is idempotent and changes community writes from anonymous visitor IDs to verified Supabase users.

The `place-photos` Storage bucket is created by `social.sql`. User uploads are private to the map until an administrator publishes their metadata from the Atlas admin page.
