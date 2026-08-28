# Atlas database setup

Run the SQL files in the Supabase SQL editor in this order:

1. `schema.sql`
2. `admin.sql`
3. `hardening.sql`

For an existing Atlas database, only `hardening.sql` is required. It is idempotent and adds server-side submission intervals, one confirmation per browser identity, and moderation for newly suggested places.

The frontend remains compatible before the hardening migration is applied: new places are inserted with `status = 'hidden'`, and browser-side cooldowns prevent accidental repeated submissions. Apply the migration to enforce the same rules against direct API requests.
