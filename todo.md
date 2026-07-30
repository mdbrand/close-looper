# Close Looper — Project TODO

## Phase 1: Database Schema & Backend
- [x] Database schema: contacts table (name, email, phone, company, industry, relationship type, how-met, personal notes, social links, birthday, loop status, send frequency, tags)
- [x] Database schema: gmail_accounts table (user_id, gmail_address, access_token, refresh_token, token_expiry)
- [x] Database schema: touchpoints table (date, name, category, industry_tag, description)
- [x] Database schema: email_drafts table (contact_id, touchpoint_id, subject, body, why_explanation, status, scheduled_send_at, sent_at, gmail_account_id)
- [x] Database schema: email_events table (draft_id, event_type: open/send/bounce, occurred_at, ip, user_agent)
- [x] Database schema: ai_voice_profile table (user_id, voice_sample, style_notes, created_at)
- [x] Backend: contacts router (CRUD)
- [x] Backend: gmail_accounts router (list, connect, disconnect, set-default)
- [x] Backend: touchpoints router (list by date range, list by industry)
- [x] Backend: email_drafts router (list queue, approve, skip, edit, send)
- [x] Backend: analytics router (stats, calendar events, list view)
- [x] Backend: ai_voice router (save profile, generate email)
- [x] Backend: open tracking pixel endpoint (/api/track/:draftId)

## Phase 2: Design System & Layout
- [x] Global theme: warm white/cream palette, Inter + DM Serif Display fonts, clean minimal aesthetic
- [x] DashboardLayout sidebar with nav items: Dashboard, Contacts, Queue, Calendar, Settings
- [x] All page shells registered in App.tsx with routes
- [x] Responsive mobile layout

## Phase 3: Contact Database UI
- [x] Contacts list page with search, filter by status/industry/tag
- [x] Add/Edit contact full-profile form (all fields)
- [x] Contact detail page with activity history
- [x] Tag management (add, remove custom tags)
- [x] Per-contact frequency setting (weeks between touches)
- [x] Loop status toggle (Active / Paused / Archived)
- [x] Three-dot menu on contact cards (Edit, Pause, Archive, Delete)

## Phase 4: Touchpoint Engine & AI Generation
- [x] Seed US federal holidays data (static, full year)
- [x] Seed quirky/fun national days data (curated list)
- [x] Seed industry-specific touchpoints (construction, real estate, healthcare, finance, etc.)
- [x] AI Voice Customization setup page (one-time onboarding step)
- [x] AI email generation procedure (contact + touchpoint → draft email + why explanation)
- [x] Manual "Generate Draft" action per contact

## Phase 5: Approval Queue & Gmail Integration
- [x] Approval Queue page: list of pending drafts with recipient, touchpoint, body, why-line
- [x] Approve, Edit (inline), Skip actions per draft
- [x] Gmail OAuth connect flow (multi-account support)
- [x] Gmail account selector per draft (choose which account to send from)
- [x] Send email via Gmail API (from real outbox, with tracking pixel injected)
- [x] Unsubscribe link injected in every email footer

## Phase 6: Dashboard, Calendar & Open Tracking
- [x] Dashboard: emails sent this month, all time, open rate, pending queue count
- [x] Dashboard: active contacts, paused contacts, needs-attention section
- [x] Dashboard: top engaged contacts widget
- [x] Calendar view: monthly grid with email events per day (click to see draft)
- [x] List view: chronological table (date, contact, subject, category, status)
- [x] Open tracking pixel endpoint (/api/track/:draftId.gif)
- [x] Record open events to email_events table

## Phase 7: Scheduled Cron & Reply Detection
- [x] Monthly Heartbeat cron: generate AI drafts for all active contacts → push to Approval Queue
- [x] Reply detection: poll Gmail inbox for replies to sent emails, auto-pause loop
- [x] Owner notification on reply detection (loop paused)
- [x] Manual loop pause/resume from contact profile

## Phase 8: Polish & Tests
- [x] Mobile responsiveness audit
- [x] Vitest: contacts router tests
- [x] Vitest: analytics router tests
- [x] Empty states for all pages
- [x] Loading skeletons for all data-heavy views
- [x] Error handling and toast notifications throughout
- [x] React deduplication fix (Vite optimizeDeps)
- [x] Register Google OAuth secrets (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
- [x] Deploy and register Heartbeat cron jobs after first deployment
