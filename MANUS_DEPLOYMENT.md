# Close Looper — Manus Release Instructions

This release closes the remaining multi-tenant sequence access bugs, adds real scheduled delivery, fixes Gmail reply matching, prevents concurrent duplicate sends, scopes reply analytics, and adds the database migration required by those changes.

## Before deploying

1. Take a restorable backup of the production MySQL database.
2. Confirm `JWT_SECRET` is set and will not be rotated during this release. Gmail-token encryption derives its key from this value; changing it makes existing connected Gmail tokens unreadable.
3. Confirm these production variables are present:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `APP_URL=https://closelooper.manus.space`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI=https://closelooper.manus.space/api/gmail/callback`
   - `BUILT_IN_FORGE_API_URL`
   - `BUILT_IN_FORGE_API_KEY`
   - `OAUTH_SERVER_URL`
   - `VITE_APP_ID`
4. Check for duplicate sequence step numbers before applying the unique constraint:

   ```sql
   SELECT sequenceId, stepNumber, COUNT(*) AS duplicate_count
   FROM sequence_steps
   GROUP BY sequenceId, stepNumber
   HAVING COUNT(*) > 1;
   ```

   The expected result is zero rows. If it returns anything, stop and reconcile those duplicate steps rather than deleting them automatically.

## Deploy in this order

1. Install dependencies with the locked package versions:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Apply the checked-in Drizzle migration `drizzle/0008_adorable_blockbuster.sql`:

   ```bash
   pnpm db:push
   ```

3. Validate the release:

   ```bash
   pnpm check
   pnpm test
   pnpm build
   ```

   Run database integration tests only against a disposable staging database, never production; those tests intentionally create test records.

4. Deploy the application from the same commit that contains migration `0008`.

## Required Manus Heartbeat jobs

Create or update these as Manus scheduled tasks. They must be Manus Heartbeat tasks—not unauthenticated external webhooks—because every callback now requires the signed cron identity.

| Job name | UTC cron | Method | Callback path |
|---|---:|---|---|
| Close Looper — Send scheduled emails | `0 * * * * *` | POST | `/api/scheduled/sendScheduledDrafts` |
| Close Looper — Check replies | `0 */5 * * * *` | POST | `/api/scheduled/checkReplies` |
| Close Looper — Generate sequence drafts | `0 5 * * * *` | POST | `/api/scheduled/generateSequenceDrafts` |
| Close Looper — Generate flexible drafts | `0 0 16 * * *` | POST | `/api/scheduled/generateDrafts` |
| Close Looper — Weekly digest | `0 0 16 * * 1` | POST | `/api/scheduled/sendWeeklyDigest` |

The cron format has six fields including seconds and runs in UTC. The one-minute scheduled-send worker is intentional; draft claiming makes overlapping executions safe.

Remove or disable legacy tasks pointing at `/api/cron/generate-sequence-drafts` or `/cron/send-weekly-digest` after the canonical jobs have run successfully once. The old paths remain temporarily available but now also require a valid Manus cron identity.

## Post-deploy verification

1. Request each callback without a Manus cron token and confirm it refuses the request. A normal session should receive `403 cron-only`.
2. Use Heartbeat “Run now” for each canonical job and confirm a successful JSON response.
3. With a test Gmail account:
   - schedule one approved draft five minutes ahead;
   - verify it sends once and changes from `approved` to `sent`;
   - reply to it from the recipient inbox;
   - run the reply checker and verify the contact pauses and one reply event appears.
4. Use two application accounts and confirm one account cannot edit or enroll contacts, sequences, or sequence steps belonging to the other.
5. Check application logs for `reconciliation`, `ScheduledSend`, token decryption, and migration errors.

## Public launch gate

Before opening paid public registration, complete Google's production OAuth verification requirements for the Gmail scopes in use. The application requests `gmail.readonly`, which Google classifies as a restricted scope.
