# Atlas database setup

Run the SQL files in the Supabase SQL editor in this order:

1. `schema.sql`
2. `admin.sql`
3. `hardening.sql`
4. `social.sql`

For an existing hardened Atlas database, only `social.sql` is required. It is idempotent and adds reactions, threaded comments, moderated photo uploads, reports, and the matching admin queues.

The `place-photos` Storage bucket is created by `social.sql`. User uploads are private to the map until an administrator publishes their metadata from the Atlas admin page.
