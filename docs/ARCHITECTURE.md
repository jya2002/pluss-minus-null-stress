# Architecture and implementation plan

React + strict TypeScript + Vite + Tailwind; HashRouter preserves deep links on GitHub Pages. TanStack Query owns server state, React Hook Form and Zod handle forms. Supabase Auth uses email OTP (also accepts magic-link callbacks); the browser only receives a public key and its user's JWT. No client-side role assignment.

PostgreSQL is the authority. RLS protects every application table; public feeds deliberately expose projections instead of participant or anonymous-author identities. Privileged transactional RPCs have fixed search paths, explicit authentication/authorization, restricted grants, and per-account rate limits. Event row locks serialize registrations, cancellations, capacity changes and FIFO waitlist promotions. Each team participant registers their own account; captains create teams, members join them, organizers may assign confirmed individuals. Team creation does not reserve phantom places.

Supabase Storage accepts board-uploaded event images and user-owned avatars. Edge Functions handle authenticated data deletion and notification email; service-role keys only live in Supabase secrets. An outbox and provider idempotency prevent duplicate notifications. In-app notifications work without email. Missing email configuration is reported as development mode, never as delivered email.

## Checklist

- [x] Phase 1: schema, threats, authorization and deployment boundaries
- [x] Phase 2: responsive design system, discovery, calendar, proposals, auth
- [x] Phase 3: SQL migrations, auth, transactional RPCs and RLS
- [x] Phase 4: event, participant, member, content and poll administration
- [x] Phase 5: notifications, export/deletion, privacy and accessibility
- [x] Phase 6: strict types, lint, unit, database, concurrency and browser checks
- [x] Phase 7: CI, deployment preparation, board handbook and verification matrix
- [ ] External gate: apply development migrations, verify real Auth/Storage/Edge flows, then obtain launch approval. Notifications and cron remain inactive until explicitly approved.

The local implementation and deployment preparation phases are complete; full Supabase service verification remains external and is tracked in VERIFICATION.md. No public deployment or paid infrastructure is authorized. Backend provisioning and real email delivery require external setup. Demonstration events are explicitly marked; Quiz & Kaos remains a draft. No alcohol permission is presumed. Only database-derived statistics appear in administration.
