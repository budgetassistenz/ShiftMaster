# ShiftMaster
A shift management web app for personal assistance services
Purpose & context
Genie is building ShiftCare (also referred to as Budgetassistenz), a React-based shift management web application for ambulatory/24-hour care scheduling under German law (SGB IX personal budget system). The app is a single-file JSX application with no build step, using localStorage as its primary data store and inline CSS as JS strings.
Core domain requirements include:

German labor law compliance: §3b EStG surcharges, EFZG sick pay, Bundesland-specific holiday calculations (all 16 states)
DATEV LODAS-compatible CSV payroll export
Multi-role access (Admin vs. employee)
Versioned plan confirmation workflow before payroll export is unlocked
Revisionssicheres Prüfprotokoll (audit log)

The app has evolved through at least v7 → v9 with substantial iterative feature development across many sessions. Claude has been operating as a senior full-stack developer/tech lead, making surgical changes directly to the file and delivering complete updated versions as downloads (not code snippets).
Current state
ShiftCare v9 is the active version (~4,000 lines, ~267KB JSX). Recent completed work includes:

Bug fixes: React 18 batching closure bug in confirmSick, temporal dead zone in takeoverShift, XSS vector via dangerouslySetInnerHTML, missing sickLohn in PayrollTab brutto calculation, hardcoded "BW" Bundesland in PrefsTab, CSS gap:10 missing unit
Dead code removal: Firebase integration, AbrechnungTab wrapper, unused csvSep state
Mobile UX: Two CSS breakpoints (640px, 380px), 44px touch targets, mobile day view for ScheduleTab with date-dot navigation and shift cards, PWA-like viewport meta
REST API (server.js): Node.js/Express/SQLite, 48 endpoints, JWT + bcrypt auth, bulk state sync, CRUD for all entities, business logic ported server-side (Easter calculation, calcShiftHours, EFZG 42-day rule), rate limiting, Helmet, CORS, RBAC. Default admin seeded as admin@example.de / admin123
Multi-mode feature: MODE_LABELS dictionary for neutral terminology supporting different care entity types (e.g., gastro equivalent of "Standort mit Bereichen")
UI/UX: Collapsible Setup tab sections, compact plan generation popup, notification-to-tab navigation, collapsible How-To tab (text, base64 image uploads up to 5MB, YouTube embeds), plan merging on regeneration, Vorabend-Logik for evening-start shift surcharges, CSS custom properties replacing hardcoded colors for dark mode
Architecture decision: REST API primary, localStorage as offline cache, last-write-wins sync strategy

A persistent parse error from bracket mismatches in collapsible div wrappers was resolved by switching to <Fragment> wrappers.
On the horizon

IONOS VPS deployment (Option B, ~5€/month) using systemd + Nginx — deployment guide already produced
React Native/Expo mobile app conversion (sequenced after web app stabilization)

Target: iOS and Android (employees use both)
Proposed bundle ID: de.shiftcare.app
Push notification requirements TBD
Beta via TestFlight / Google Internal Testing planned


Refactoring frontend to consume the REST API rather than relying on localStorage directly
App store accounts (Apple Developer, Google Play) — status was an open question

Key learnings & principles

Fragment over div for collapsible wrappers: Nested <div> wrappers inside JSX cause bracket mismatch parse errors; <Fragment> is the stable pattern
Surgical edits over rewrites: Token-efficient approach — read targeted sections, str_replace, deliver as download
No admin confirmation loops: All shift actions (swap, giveaway, takeover, time adjustment) apply immediately; protocol is admin-only
Business logic client-side first: Keep payroll/surcharge logic portable so it can be reused in React Native
API before refactor: Build REST API endpoints first, then refactor frontend to consume them — avoids breaking the working single-file app prematurely
Version strings must be consistent: localStorage key, IONOS object key, CSV export header, CSS style ID, and UI version display must all stay in sync
localStorage limits: Auto-trimming on each save cycle is required given the 5–10MB browser limit

Approach & patterns

Claude works directly in the JSX file making targeted changes; complete updated files are delivered as downloads
Conversations in German when discussing the application domain
Features are scoped iteratively: stabilize web app → add backend → convert to mobile
Preference for neutral/flexible terminology in UI (mode-switchable labels) to support different care entity types
Changes that touch confirmation workflows always preserve the principle: employees confirm plans, admins control the protocol

Tools & resources

Frontend: React (no build step, single JSX file), localStorage, inline CSS as JS strings
Backend: Node.js, Express, SQLite, JWT, bcrypt, multer
Hosting target: IONOS (static Option A or VPS Option B with Nginx + systemd)
Payroll integration: DATEV LODAS CSV export
Mobile target: React Native / Expo, EAS Build
German legal references: SGB IX, §3b EStG, EFZG
