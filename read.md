## Problem Statement

SalesGeek Scotland needs a mobile-first event companion web app for Scottish Growth Expo 2026 at Hampden National Stadium, Glasgow. The current public event presence can remain on Forumm for listing and ticketing, but it does not provide the on-the-day attendee flow, QR-driven engagement, live agenda experience, host/SalesGeek profiles, sponsor interaction, competition leaderboard, reward redemption, admin operations, or post-event archive behavior needed for the Expo.

The companion app must support a fast QR-led arrival flow, collect attendee information, verify identity via email OTP, provide a live event experience, and run a real prize competition based on event QR codes. It must also support admin and staff workflows for operating the event in real time, while remaining reusable for future events under a shared event platform.

## Solution

Build an event-based companion web app, branded as a SalesGeek Scotland event app for Scottish Growth Expo 2026, with a shared domain and event-specific slug. The app will support pre-registration, event-day check-in, attendee identity and session persistence, QR scoring, public anonymous leaderboard, reward redemption, agenda and speaker content, sponsor pages and lead capture, admin/staff operations, and a post-event archive state.

The attendee experience will be mobile web only for v1, optimized for poor venue connectivity without a true offline mode. The app will use a single event URL that can operate in pre-event mode, event-day mode, and post-event archive mode. The admin side will manage public event content, QR definitions, rewards, agenda, speakers, sponsors, FAQs, notifications, exports, and event-day operational controls.

## User Stories

1. As an attendee, I want to scan a QR code at the event desk and land directly on the event companion app, so that I can start using the event experience without searching for links.
2. As an attendee, I want the event-day QR entry page to show the event name and context above the form, so that I know I am in the right place.
3. As an attendee, I want to pre-register before the event using the same event URL, so that I can save time when I arrive.
4. As an attendee, I want my pre-registration to be recognized when I return on event day, so that I do not have to start over.
5. As an attendee, I want to enter my name, email, phone number, and business, so that I can create my event profile.
6. As an attendee, I want email OTP verification after form submission, so that my profile can be verified for prize eligibility.
7. As an attendee, I want to continue into the app even if OTP is pending, so that the registration desk flow does not stall.
8. As an attendee, I want OTP verification to be required for prize eligibility, so that the leaderboard remains fair.
9. As an attendee, I want my email to act as my main identity key, so that my account can be recovered consistently.
10. As an attendee, I want my phone number collected but not treated as the primary identity key, so that number formatting issues do not block me.
11. As an attendee, I want duplicate prevention by email, so that I do not accidentally create multiple accounts.
12. As an attendee, I want my phone number to be editable later, so that I can fix it without staff help.
13. As an attendee, I want my business name locked after signup, so that registration data remains stable.
14. As an attendee, I want my email locked after signup, so that identity-critical account data stays consistent.
15. As an attendee, I want my real name to be editable after signup, so that I can correct mistakes.
16. As an attendee, I want my leaderboard alias to be auto-generated, so that I can appear on the public leaderboard without exposing my real identity.
17. As an attendee, I want one chance to edit my alias, so that I can personalize it slightly without creating moderation chaos.
18. As an attendee, I want my public leaderboard presence to use only my anonymous alias and score, so that my identity stays private.
19. As an attendee, I want to stay signed in on my phone browser through the event, so that repeated QR scans feel seamless.
20. As an attendee, I want a profile QR in my app, so that staff can identify me quickly for redemptions and support.
21. As an attendee, I want the Home screen to prioritize live event content over game mechanics, so that the app still feels like an event companion first.
22. As an attendee, I want Home to show what is live now and what is up next, so that I can quickly orient myself during the event.
23. As an attendee, I want the app to show my competition score, spendable balance, rank, and lightweight progress, so that I understand both the event and the game.
24. As an attendee, I want lightweight progress summaries by category, so that I can tell how much of the event I have explored.
25. As an attendee, I want the progress summaries to avoid revealing exact hidden QR locations, so that bonus exploration still feels playful.
26. As an attendee, I want a short onboarding screen the first time I enter the app, so that I understand how to use the experience.
27. As an attendee, I want that onboarding information to remain accessible later from Help, so that I can revisit it if I forget the rules.
28. As an attendee, I want a short “how points work” explainer, so that I do not need to ask staff how the game works.
29. As an attendee, I want the Agenda tab to be chronological first, so that I can quickly follow the day’s schedule.
30. As an attendee, I want lightweight filters on the agenda, so that I can narrow sessions by stage, category, or type.
31. As an attendee, I want each session detail page to include speaker, sponsor, location, and status context, so that it is useful on its own.
32. As an attendee, I want session points to require scanning the physical venue QR, so that attendance mechanics remain fair.
33. As an attendee, I want the Geeks tab to show the four host SalesGeeks, so that I can understand who is hosting the event.
34. As an attendee, I want each Geek card to show photo, bio, and contact/calendar links when available, so that I can connect with them directly.
35. As an attendee, I want those regular Geek booking/contact links to remain freely accessible, so that networking is not artificially gated.
36. As an attendee, I want William to appear as both a host and a speaker, so that his different event roles are clear.
37. As an attendee, I want the premium William reward to be distinct from his ordinary contact link, so that the reward feels real.
38. As an attendee, I want the premium William reward to be a limited-slot post-event strategy session with priority access, so that redeeming points gives me a genuinely upgraded offer.
39. As an attendee, I want premium William reward slots to be deducted only after successful booking confirmation, so that I do not lose points for abandoned bookings.
40. As an attendee, I want the app to use the same browser session throughout repeated QR scans, so that scanning around the venue stays smooth.
41. As an attendee, I want every QR code to open the same companion app, so that the experience feels unified.
42. As an attendee, I want each QR scan to show a clear confirmation message with the named code and awarded points, so that I know the scan worked.
43. As an attendee, I want a QR scan to auto-award on page load, so that I do not need an extra tap to claim.
44. As an attendee, I want repeat scans of the same QR to say it is already collected, so that I understand why my score did not increase.
45. As an attendee, I want scans of inactive or time-locked QRs to explain why they are unavailable, so that I do not think the app is broken.
46. As an attendee, I want a QR scan before signup to be preserved through registration, so that I do not lose the points opportunity.
47. As an attendee, I want sponsor QRs, session QRs, and hidden bonus QRs to feel different in purpose, so that the game has variety.
48. As an attendee, I want hidden bonus codes included in the event, so that the venue exploration feels more interesting.
49. As an attendee, I want hidden bonus hints to reference a broad zone rather than an exact location, so that there is still discovery.
50. As an attendee, I want hidden bonus hints to unlock gradually during the day, so that the game stretches across the event instead of front-loading.
51. As an attendee, I want hidden bonus QRs to stay inactive until their reveal time, so that the timed release mechanic is fair.
52. As an attendee, I want a subtle indication of when the next hidden bonus hint unlocks, so that I have a reason to reopen the app later.
53. As an attendee, I want QR confirmations to include a contextual next action, so that scans do not end in a dead-end screen.
54. As an attendee, I want sponsor scans to count only once, so that the competition cannot be farmed from a single location.
55. As an attendee, I want sponsor pages to be personalized to my state, so that I can see whether I already interacted with that sponsor.
56. As an attendee, I want sponsor pages to include the sponsor website button, so that I can explore their business directly.
57. As an attendee, I want sponsor pages to show my scan-collected status, so that I can remember what I have already done.
58. As an attendee, I want a one-tap “I’m interested” action on sponsor pages, so that I can signal genuine intent without filling another form.
59. As an attendee, I want to undo “I’m interested” if I tapped it by mistake, so that sponsor lead data remains accurate.
60. As an attendee, I do not want “I’m interested” to affect points, so that the leaderboard cannot be gamed through intent signals.
61. As an attendee, I want my sponsor-sharing consent to be separate from the event terms consent, so that I clearly understand what data may be shared.
62. As an attendee, I want sponsor lead sharing to happen only when I opted in, so that my contact details are not passed to sponsors unexpectedly.
63. As an attendee, I want all active rewards visible even if I cannot afford them yet, so that I can see what I am working toward.
64. As an attendee, I want unaffordable rewards to appear subtly locked rather than hidden, so that the Rewards tab still feels complete.
65. As an attendee, I want self-service rewards separated from staff-only rewards, so that I understand what I can redeem in-app versus at the desk.
66. As an attendee, I want reward cards to show collection instructions where relevant, so that I know where to go next.
67. As an attendee, I want rewards to show if they are available, locked, sold out, redeemed, or expired, so that reward state is understandable.
68. As an attendee, I want the leaderboard to show the top 10 and my own rank, so that I can compare myself without seeing the entire attendee list.
69. As an attendee, I want unverified users to be able to appear on the leaderboard, so that the game can start before OTP completion.
70. As an attendee, I want leaderboard winners to be decided by competition score, so that spending my balance does not hurt my ranking.
71. As an attendee, I want my spendable balance to be separate from my leaderboard score, so that redemptions and competition stay understandable.
72. As an attendee, I want ties to be broken by earliest time reaching the score, so that the prize ranking is deterministic.
73. As an attendee, I do not need the tie-break rule emphasized on the leaderboard screen, so that the public UI stays uncluttered.
74. As an attendee, I want a visible prize deadline, so that I know when scoring closes.
75. As an attendee, I want scoring to stop after the deadline unless a QR is explicitly configured otherwise, so that the competition remains fair.
76. As an attendee, I want the app to archive after the event instead of looking half-live forever, so that the experience has a clear end state.
77. As an attendee, I want to keep access to my own event profile and history for a limited post-event period, so that I can review my results and rewards.
78. As an attendee, I want final anonymous leaderboard results visible only to logged-in attendees after the event, so that the outcome is visible without becoming a public results page.
79. As an attendee, I want my access to expire after 10 days, so that the app does not become an indefinite account service.
80. As an attendee, I want expired rewards to remain visible in my history, so that I understand what happened to them.
81. As an attendee, I want FAQs and help content to exist in-app, so that I can answer predictable event questions without finding staff.
82. As an attendee, I want FAQs to be searchable and structured rather than chatbot-driven, so that help remains fast and reliable.
83. As an attendee, I want in-app notifications about upcoming sessions and event updates, so that I can react to live changes.
84. As an attendee, I want notifications to appear inside the app rather than relying on browser push in v1, so that the behavior stays reliable on mobile browsers.
85. As an attendee, I want the app to remain usable on poor venue connectivity, so that I am not blocked by spotty network conditions.
86. As an attendee, I want the app to be mobile-optimized without needing app-store installation or special PWA behavior, so that it remains frictionless.
87. As an attendee, I want a simple venue map or floorplan if available, so that I can orient myself inside Hampden.
88. As an attendee, I want text-based directions to still work if no floorplan is available, so that the venue guidance is not blocked on artwork.
89. As an attendee, I want location references grouped by broad zones, so that venue guidance stays helpful without overcomplicating the interface.
90. As an attendee, I want my scan history visible in a simple way, so that I can trust the score I see.
91. As an attendee, I want a lightweight “need help with points?” path instead of a complex dispute system, so that I can get support without creating ticketing overhead.
92. As an attendee, I want no attendee directory in v1, so that my identity stays private and the event app remains focused.
93. As an admin, I want to manage multiple events under one shared domain with event slugs, so that the platform can be reused.
94. As an admin, I want nearly all public-facing event content configurable per event, so that future expos do not require code changes.
95. As an admin, I want pre-event, event-day, and post-event states controlled per event, so that one URL can shift modes over time.
96. As an admin, I want event-level branding and Expo visuals managed in the panel, so that the app reflects SalesGeek Scotland with an event-specific layer.
97. As an admin, I want the canonical event name to be Scottish Growth Expo 2026 with SalesGeek Scotland as the host/powered-by brand, so that public naming stays consistent.
98. As an admin, I want to ignore the Forumm banner image inside the companion app, so that the companion app can have its own tighter visual system.
99. As an admin, I want event details copied into my own system rather than integrated live from Forumm, so that the event-day app is not dependent on a third party.
100. As an admin, I want Forumm to remain the public event listing/ticketing source, so that the companion app does not replace the existing public event page.
101. As an admin, I want CSV attendee import without live Forumm integration, so that I can pre-load records using the data I have.
102. As an admin, I want imported attendees matched by email when they arrive, so that they continue an existing record rather than creating another one.
103. As an admin, I want no outbound pre-event campaign emails from the app, so that the app’s email responsibility stays limited.
104. As an admin, I want the app to send only OTP emails and booking-related system emails in v1, so that deliverability scope remains narrow.
105. As an admin, I want agenda items editable from the panel with live statuses, so that event-day timing changes can be reflected immediately.
106. As an admin, I want scheduled and immediate in-app announcements, so that I can prepare reminders and also react live.
107. As an admin, I want a live event-day ops dashboard, so that I can monitor the event at a glance.
108. As an admin, I want the ops dashboard to auto-refresh with manual fallback, so that the screen remains current during the event.
109. As an admin, I want attendee search by name, email, phone, alias, or profile QR, so that staff can find people quickly.
110. As an admin, I want individual Admin and Staff roles, so that day-of-event access stays controlled without overcomplicating permissions.
111. As an admin, I want staff accounts to be individual rather than shared, so that operational actions are attributable.
112. As an admin, I want staff/admin access via magic link or email OTP in v1, so that password management is avoided.
113. As an admin, I want Staff to redeem physical rewards and trigger predefined point actions only, so that the event can run smoothly without opening broad control.
114. As an admin, I want Admins to perform arbitrary score adjustments, reversals, disqualifications, merges, and corrections, so that exceptions can be handled safely.
115. As an admin, I want all sensitive actions logged, so that prize and reward decisions are auditable.
116. As an admin, I want suspicious attendees flaggable, freezable, or disqualifiable, so that abuse can be managed without deleting history.
117. As an admin, I want duplicate attendee records mergeable manually, so that edge cases can still be corrected later.
118. As an admin, I want no admin impersonation flow in v1, so that operational scope stays tighter.
119. As an admin, I want QR codes created, configured, tested, and exported inside the panel, so that event operations are centralized.
120. As an admin, I want each QR code to have a name, type, points, active state, reveal/timing settings, repeat rules, and optional sponsor or session association, so that I can model different event mechanics.
121. As an admin, I want QR print exports as branded images/cards/posters, so that event printing work is simplified.
122. As an admin, I want QR point visibility configurable, so that sponsor and session codes can show value while hidden bonus codes remain more mysterious.
123. As an admin, I want QRs assignable to broad venue zones, so that progress summaries and location reporting are possible.
124. As an admin, I want session QRs to use active windows around the session time, so that attendance scoring remains fair.
125. As an admin, I want some high-value actions to support staff validation, so that special cases can be protected.
126. As an admin, I want a test/preview mode for every QR, so that I can verify behavior before printing.
127. As an admin, I want rewards configurable by type, cost, inventory, and per-attendee limit, so that both self-service and staff redemption are controlled.
128. As an admin, I want all redeemables inventory-tracked, so that stock and reward scarcity are reflected in the system.
129. As an admin, I want reward inventory to support both physical merch and the William strategy session, so that all limited offers are handled consistently.
130. As an admin, I want reward-specific expiry dates independent of general event archive timing, so that some offers can outlive attendee access windows.
131. As an admin, I want the William strategy session reward inventory managed in-app as a fixed quantity, so that live Calendly complexity stays lower.
132. As an admin, I want booking confirmation from Calendly treated as the source event for reward completion, so that the system can reconcile failures reliably.
133. As an admin, I want reward reversals to require admin-only action with a reason, so that the audit trail remains trustworthy.
134. As an admin, I want per-reward redemption limits with a default of one per attendee, so that premium items are protected from repeat redemption.
135. As an admin, I want sponsor scans and sponsor interest stored as separate lead strengths, so that sponsor exports carry more useful context.
136. As an admin, I want sponsor lead exports gated by attendee consent, so that data sharing is legally and operationally safer.
137. As an admin, I want sponsor reporting available during and after the event without sponsor logins, so that I can control access and communication.
138. As an admin, I want FAQs editable on event day, so that practical event guidance can keep up with reality.
139. As an admin, I want preview-as-attendee style content previewing without live impersonation, so that I can validate event setup before launch.
140. As an admin, I want post-event analytics summaries per event, so that I can understand attendance, scoring, QR activity, and sponsor engagement.
141. As an admin, I want acquisition source tracked for each attendee, so that I can learn how people first entered the system.
142. As an admin, I want lightweight session/device metadata recorded in the background, so that I can debug fraud or duplicate-account edge cases without building a fingerprinting system.
143. As an admin, I want archived attendee data retained for reporting even after attendee access ends, so that analytics and dispute history remain available.
144. As an admin, I want event or per-attendee access to be reopenable after archive, so that operational exceptions can be handled.
145. As a staff member, I want to scan an attendee’s profile QR to redeem physical rewards, so that desk interactions are fast.
146. As a staff member, I want to search for attendees by multiple identifiers, so that I can help when their QR is unavailable.
147. As a staff member, I want collection instructions visible on staff-only reward cards, so that the redemption path is unambiguous.
148. As a staff member, I want to know whether an attendee is checked in and verified, so that I can handle prize and reward workflows confidently.
149. As a speaker or host Geek, I want my profile shown in a professional event-specific context, so that attendees understand who I am and how to connect.
150. As a sponsor, I want post-event reporting that distinguishes scans from actual interest, so that I can judge lead quality better.

## Implementation Decisions

- Build the system as an event-based platform from the start, not a one-off landing page. Every core record is event-scoped.
- Use one shared app domain with event-specific slugs.
- Keep Forumm as the public event listing/ticketing source. The companion app is a separate operational product.
- Do not build a live Forumm integration in v1. Event information is copied and managed inside the app.
- Use a pre-event mode, event-day mode, and post-event archive mode on the same event URL.
- Brand the companion app as a SalesGeek Scotland companion experience for Scottish Growth Expo 2026, using the existing SalesGeek Scotland visual identity as the base while keeping the layout app-oriented rather than marketing-site-oriented.
- Ignore the Forumm banner in the companion app UI and use a distinct event visual system managed in admin.
- Attendee identity is passwordless. Email is the canonical identity key and email OTP is the only attendee verification method in v1.
- Attendee email is immutable after signup except for admin correction. Phone is informational and editable. Business is locked after signup except for admin correction. Real name is editable. Public alias is auto-generated with one self-service change allowed.
- Duplicate prevention in v1 is basic and email-based.
- Attendees can appear on the leaderboard before OTP verification, but prize eligibility requires OTP verification.
- Check-in is automatic on first event-day app entry, with staff/admin override support.
- Only checked-in attendees can meaningfully participate in leaderboard and point-based event mechanics.
- QR scans use a unified scan flow and idempotent award behavior.
- Each QR counts once per attendee by default. Staff-validated QR types exist for high-value actions.
- Sponsor and session QR point values are visible by default; hidden bonus and location codes default to hidden point values.
- Hidden bonus codes are strategic placement tools, not random scavenger mechanics. Hints reveal broad zones only and unlock on a schedule. Bonus codes themselves remain inactive until reveal time.
- Session attendance codes are active only in configured time windows.
- Drop explicit mission systems from v1. Keep only configurable lightweight progress blocks from a small fixed set of progress block types.
- Competition score and spendable balance are separate ledgers. Leaderboard ranking uses competition score only. Spending points does not reduce leaderboard standing.
- Tie-breaks are resolved by earliest time reaching the score.
- Reward inventory is tracked for all redeemables.
- Reward presentation is split into self-service and staff-only sections.
- The premium William reward is a distinct limited-slot post-event strategy session with priority access, not the same as his normal public booking link.
- William reward completion depends on successful Calendly confirmation. Booking confirmation is the source event and reward finalization must be retryable and reconcilable.
- In v1, William reward inventory is a fixed app-managed quantity rather than live-derived from Calendly availability.
- There is no temporary hold state for William reward slots in v1. Inventory and point deduction happen only after confirmed booking.
- Sponsor pages are attendee-specific and include website links, scan status, and a one-tap “I’m interested” action that can be undone.
- Sponsor interest does not award points.
- Sponsor lead sharing requires separate explicit consent from general event terms acceptance.
- Sponsors do not get direct dashboard access in v1. SalesGeek admins control exports.
- Attendee-visible navigation uses five main tabs: Home, Agenda, Geeks, Rewards, Leaderboard.
- Sponsors, FAQs/help, profile, terms/privacy, and other secondary items live outside the main five-tab structure.
- The Home screen prioritizes live event context first: now/up-next, announcements, then points/rank/progress.
- FAQ/help is structured and searchable. Chatbot functionality is out of scope for v1.
- Notifications are in-app only for v1, with immediate send and scheduled send capability. Targeting support may exist in the data model, but broadcast-first is the required operational path.
- Admin roles are `Admin` and `Staff`. Staff handles search, redemption, and predefined point actions. Admin handles arbitrary adjustments, reversals, merges, disqualifications, configuration, exports, and event controls.
- Staff and admin accounts are individual and use email OTP or magic-link style access in v1.
- Include a live auto-refreshing ops dashboard within the same admin system rather than building a separate operations app.
- Archive behavior is explicit. The event app transitions into a post-event archive state. Attendee access remains for 10 days, then becomes unavailable unless reopened by admin. Admin/reporting data is retained.
- Final anonymous leaderboard remains available only to logged-in attendees during the post-event window, not as a public unauthenticated page.
- Reward expiry is independent from general attendee archive timing.
- Capture attendee acquisition/source and lightweight session/device metadata in the background for operational insight and debugging.
- Build for poor connectivity through lightweight pages, strong retry handling, small assets, and idempotent server actions, but do not build full offline support in v1.
- Support a simple venue map/floorplan if available, but do not make the event dependent on one.

## Testing Decisions

- Good tests should validate external behavior and observable outcomes, not internal implementation details. A test should assert what the system guarantees to users or operators: who can log in, whether a QR awards correctly, whether a reward inventory count changes correctly, whether a duplicate account is blocked, whether a notification is visible, whether the right export data is produced.
- The deepest and highest-value test target is the scoring and redemption engine. It should be testable as a standalone behavior layer covering QR awards, repeat-scan idempotency, leaderboard score updates, spendable balance updates, reversals, reward inventory changes, per-attendee reward limits, and William reward reconciliation behavior.
- The attendee identity and access layer should be tested around canonical email identity, OTP verification state, pre-registration continuation, event-day check-in, archive access expiry, and duplicate prevention by email.
- The QR and progress system should be tested around inactive codes, reveal windows, session time windows, scan preservation through signup, already-collected handling, and category/zone summary generation.
- The sponsor engagement layer should be tested around sponsor scan collection, interest toggling, consent-aware lead visibility, and export shaping for different lead strengths.
- Admin and staff permissions should be tested through role-based behavioral tests: what Staff can and cannot do, what Admin can override, and how audit-required actions behave.
- Export behavior should be tested around attendees, sponsor leads, leaderboard, scans, rewards/redemptions, and notification logs, with emphasis on data completeness and permission boundaries.
- Archive and post-event behavior should be tested around attendee access cutoff, final leaderboard visibility for attendees, and admin reopen behavior.
- Because the workspace is empty, there is no prior art in the current codebase to mirror. The implementation should therefore prefer deep, isolated domain modules with interface-level tests and a thinner presentation layer around them.

## Out of Scope

- Native mobile apps
- Full PWA install prompts or advanced home-screen installation work
- Browser push notifications in v1
- Live Forumm integration
- Forumm ticket validation enforcement in v1
- Sponsor login/dashboard access
- Public attendee directory or attendee-to-attendee networking layer
- Social sharing features
- Favorites/bookmarking of sessions or speakers
- Full dispute/ticketing system for missing points
- Full mission engine with mission builders, mission overlap rules, and mission-specific bonus logic
- Public unauthenticated final leaderboard pages
- Chatbot help in v1
- SMS OTP in v1
- Password-based account systems
- Full offline mode with local scoring reconciliation
- Self-service attendee account deletion
- Broad marketing email, reminder email, or sponsor follow-up email sending from the app
- Dynamic reward inventory directly derived from live Calendly availability
- Admin impersonation flows that let operators act as attendees

## Further Notes

- The event companion app should feel like a focused operational product rather than a marketing microsite. The existing SalesGeek Scotland brand should carry across, but the UI needs to behave like an event-day mobile application.
- The prize competition is real, so auditability matters. Score changes, reversals, disqualifications, redemptions, booking-triggered reward completion, and duplicate merges all need defensible operational history.
- The privacy/legal posture in v1 depends on separating general event terms acceptance from sponsor lead-sharing consent. That should remain explicit in the UX and data model.
- The app must support both event utility and game engagement without allowing the game layer to bury the live agenda and practical event information.
- The core build order should be:
  1. admin event setup
  2. attendee signup and check-in
  3. agenda, Geeks, and sponsors
  4. QR scoring and leaderboard
  5. rewards
  6. notifications
  7. reporting and archive
