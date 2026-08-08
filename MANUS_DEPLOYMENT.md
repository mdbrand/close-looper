# Close Looper — Manus Release Instructions

This release closes the remaining multi-tenant sequence access bugs, adds real scheduled delivery, fixes Gmail reply matching, prevents concurrent duplicate sends, scopes reply analytics, and adds the database migration required by those changes.

## Before deploying

1. Take a restorable backup of the production MySQL database.
2. Confirm `JWT_SECRET` is set and will not be rotated during this release. Gmail-token encryption derives its key from this value; changing it makes existing connected Gmail tokens unreadable.
3. Confirm these production variables are present:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `APP_URL=https://closelooper.com`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI=https://closelooper.com/api/gmail/callback`
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

2. Apply the checked-in Drizzle migrations through `drizzle/0009_invite_only_and_contact_inquiries.sql`:

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

4. Deploy the application from the same commit that contains migration `0009`.

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

## Invite-only beta checklist

1. Set `OWNER_OPEN_ID` to the founder's Manus open ID before deployment. The owner remains able to sign in without a waitlist record.
2. Run migration `0009`. It creates `contact_inquiries`, which powers the public Contact page and the Admin Panel inquiry inbox.
3. Create an invite code in **Admin → Invite Codes**. A valid code approves an application immediately; applications without a code require manual approval in **Admin → Waitlist**.
4. Tell approved people to sign in with the exact Google account/email address used on their application. The server rejects all other first-time logins.
5. Invoice customers manually and record paid status outside Close Looper until billing is implemented. Do not describe the product as self-serve paid SaaS.

## Google OAuth production gate

Before connecting customer Gmail accounts, complete Google's OAuth verification for the production OAuth client. The app uses `gmail.send` and `gmail.readonly`; `gmail.readonly` is a restricted scope. Submit the production privacy policy URL, terms URL, authorized domains, scope justification, and a video showing the Gmail connection and reply-detection use case. Keep the OAuth consent screen and this app's disclosures consistent: Gmail data may be used only to send approved messages and to detect replies/delivery failures for those messages.

For the production OAuth client, add exactly this authorized redirect URI in Google Cloud:

```
https://closelooper.com/api/gmail/callback
```

Also add `closelooper.com` as an authorized domain, verify it in Google Search Console with a Google Cloud project owner/editor account, and use these public URLs on the consent screen:

```
https://closelooper.com/
https://closelooper.com/privacy
https://closelooper.com/terms
```
