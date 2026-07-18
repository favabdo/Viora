# Viora — Design Audit & Redesign Notes

## Starting point

Viora already had one thing most AI-generated apps don't: a point of view. Warm
paper background, a ruled-notebook texture, a serif display face (Fraunces)
paired with mono for usernames/URLs, a "stamped" checkbox, teal/sage/clay as
functional colors instead of decoration. That's worth preserving — it's the
opposite of generic. The redesign keeps that identity and fixes everything
around it that undercuts it: inconsistent radii, shadow-on-everything, a
rainbow gradient wordmark that has nothing to do with the rest of the palette,
raw `+`/`×` glyphs standing in for real controls, and card containers used for
things that are actually list rows.

## 1. Design tokens (`tailwind.config.ts`, `app/globals.css`)

- **Radius scale collapsed to three values**: `sm` (4px, checkboxes/badges),
  `md`/default (6px, inputs/buttons/list rows), `lg` (10px, cards/modal). The
  old file mixed `rounded`, `rounded-lg`, and `rounded-2xl` with no logic —
  the 16px modal radius in particular read as generic-SaaS softness that
  didn't match the otherwise crisp, editorial feel.
- **Shadows are no longer a default.** Added `shadow-raised` (a whisper, for
  the one true floating surface on auth screens) and `shadow-modal` (for the
  team panel, the only real overlay in the app). Removed `shadow-card` from
  every task, link, and invite row — those are list items, not cards, and
  giving each one its own drop shadow is the single most common "AI slop"
  tell. Rows now separate with 1px hairlines instead.
- **Wordmark fixed.** The `.viora-wordmark` gradient (`#066EFD → #7823F9 →
  #0AD5F2`) was a leftover default-template gradient — bright SaaS blue/purple
  that has zero relationship to the warm paper/teal/clay palette everywhere
  else. It's now solid ink, so the logotype reads as part of the same brand
  as the rest of the screen instead of a sticker pasted on top.
- **Extended the palette with *soft* and *faint* variants** (`tealSoft`,
  `sageSoft`, `claySoft`, `inkFaint`, `lineStrong`) so status colors, badges,
  and tertiary text have a real scale instead of arbitrary opacity modifiers
  (`/40`, `/70`, `/10` scattered through the old code).
- **Added `focus-visible` styling globally** — the old app had no visible
  keyboard-focus state at all.

## 2. A real component layer (`components/ui/*`)

Before: every button, input, and status pill was styled ad hoc, inline, per
usage — meaning the "add task" button was `bg-ink`, the "save link" button was
also `bg-ink`, but "invite" was `bg-teal`, and "accept invite" was `bg-sage`.
There was no actual primary color. Six files, six slightly different button
recipes.

Added: `Button` (primary/secondary/ghost/danger × sm/md, with a built-in
loading spinner state), `IconButton` (default/danger/active tones, sm/md
sizes), `Input`/`Textarea`, `Badge`, `EmptyState`, `Skeleton`/`SkeletonList`,
`ProgressBar`, `StatusScreen`. Every screen now pulls from the same set, so
**teal is unambiguously the one primary action color**, secondary actions are
outlined, and destructive actions are the only place clay/red appears as a
button. This is the actual mechanism behind "define primary/secondary/tertiary
actions" — it's not a one-off tweak, it's now enforced by what's available to
import.

## 3. Removing "card soup"

`TasksSection` and `LinksSection` previously wrapped **every single task and
every single link** in its own `bg-white border rounded shadow-card` box, each
with its own padding. On a project with 15 tasks that's 15 stacked cards, each
fighting for the same visual weight as the "add project" button, the section
header, and the empty state message — nothing was actually primary.

Now: tasks and links live in a single bordered container with `divide-y`
hairlines between rows (the same density pattern Linear uses for issue lists
and Notion uses for database rows). The checkbox/title/username/delete-icon
row keeps its spacing but no longer has its own elevation. This alone cuts
visual noise by roughly a third without removing any information, and it
makes genuinely different things — the team panel modal, the one card on the
login screen — actually look elevated when they need to be, instead of
everything looking equally "raised."

## 4. Visual hierarchy on the main screen

- **Header shrunk.** The logo mark went from `h-10`/`text-2xl` to
  `h-8`/`text-lg`. On the working screen the product name doesn't need to be
  the loudest thing on the page — the active project does.
- **Tab nav got icons** (`CheckSquare`, `Link2`) next to the labels, and the
  inactive-tab color moved from `text-inkSoft` to a lighter `text-inkFaint`,
  widening the contrast between the active and inactive tab so the current
  section is unambiguous at a glance.
- **Task progress became a real signal, not a caption.** `"3/8 خلصت"` as plain
  gray text told you a number but nothing else. It's now a 64px inline
  progress bar next to a mono counter — still small, still doesn't compete
  with the task list, but you register project completion state before you
  even read a single task.
- **Sign out demoted to an icon-only button** in the header corner — it's a
  rare, low-stakes action and doesn't need a full bordered button competing
  with the tab nav underneath it.

## 5. Iconography instead of glyphs and emoji

Raw text characters (`+`, `×`, `▲`/`▼`) and emoji (`🤝` for shared projects,
🎉 for a successful invite) were doing the job of icons without being icons —
inconsistent baseline alignment, no accessible sizing control, and emoji
rendering differently (and looking distinctly non-premium) across platforms.
Replaced with `lucide-react`:

- `+` → `Plus` inside a real `IconButton`
- `×` (delete) → `X`, always in the danger tone, always revealed on row hover
- `🤝` (shared project) → `Users`, sized and colored to sit quietly next to
  the project name
- `▲ / ▼` (history toggle) → a single `ChevronDown` that rotates 180° — one
  icon, one piece of state, instead of two different glyphs
- Invite acceptance's celebratory copy (`تم الانضمام لمشروع X 🎉`) → a
  `StatusScreen` success state with a check-in-circle icon, matching the
  same pattern already used (well) on the email-confirmation page

## 6. Empty, loading, and status states

The old states were a single gray sentence (`"بتحمّل..."`, `"مفيش مهام..."`)
everywhere. That's honest but does nothing to reduce the "is this thing
broken or just empty" hesitation, and it doesn't scale — the confirm/join
pages had three different hand-rolled spinner-or-checkmark blocks that were
all subtly different from each other.

- **Loading**: `SkeletonList` renders shaped placeholder rows (checkbox +
  variable-width title bar) instead of a sentence, so the layout doesn't
  jump when data arrives.
- **Empty**: `EmptyState` pairs a small icon with the message and, where it
  helps, a one-line hint pointing at the control that fixes it — no
  oversized illustration, no wasted vertical space, just enough to feel
  intentional rather than unfinished.
- **Status transitions** (confirm email, join-by-link): unified into one
  `StatusScreen` component with three kinds (loading/success/error), each a
  small tinted circle + icon using the extended palette (`sageSoft`/`claySoft`)
  instead of three copies of the same 15-line inline SVG block.

## 7. Forms

- `LinksSection`'s "add link" box was a heavy white card with its own shadow
  sitting directly above another set of shadowed cards — the form and the
  data looked like the same kind of object. It's now a lighter bordered
  panel (no shadow) that's visually distinct from the list below without
  competing with it.
- All inputs/textareas now share one `Input`/`Textarea` primitive, so focus
  states, border color, and padding are identical in the login form, the
  task/link composer, and the team invite field — previously each had
  slightly different padding (`py-2`, `py-2.5`) and radius.
- Primary form actions (`إضافة`, `حفظ اللينك`) moved from `bg-ink` (black) to
  the `Button variant="primary"` (teal) — consistent with every other primary
  action in the app, and it frees black/ink for text, not buttons.

## 8. Team panel

Kept as a centered modal (right pattern for an infrequent, focused task like
managing membership) but: radius corrected to the standard `lg` token, real
elevation shadow (`shadow-modal`) instead of the same flat `shadow-card` used
on list rows, backdrop click now closes it, member/invite status moved into
the shared `Badge` component (`عضو` = sage, `في الانتظار` = clay) instead of
raw colored text, and section labels (`الأعضاء`, `دعوات معلّقة`) became
small-caps-style uppercase micro-labels consistent with the sidebar's
"المشاريع" label — one label style for the whole app instead of two.

## 9. Sidebar / project switcher

Width trimmed from 220px to 200px and the "+" affordance became a real
`IconButton` that also acts as the active/inactive toggle indicator (fills
teal when the "new project" field is open). Delete stayed a hover-reveal
icon on the row — that's a legitimate, common pattern (Notion, Linear both
use it) and was kept rather than replaced with a swipe/kebab menu, since
this is a desktop-first tool.

## 10. Typography

No new typefaces — the existing Fraunces/system/IBM Plex Mono trio is
already a deliberate, good choice. What changed is *scale discipline*:
project title dropped from `text-2xl` to `text-xl` (it doesn't need to be
louder than the task list beneath it), section labels are now consistently
`text-2xs uppercase tracking-wide text-inkFaint` everywhere instead of
sometimes `text-sm font-medium text-inkSoft`, and body/meta text follows a
strict `text-sm` (content) / `text-xs`–`text-2xs` (metadata, timestamps,
usernames) split instead of drifting between `text-xs` and `text-sm` for
similar-weight information.

## What was deliberately left alone

- **RTL layout and Arabic (Egyptian dialect) copy** — untouched; the whole
  interaction model is correct for the audience.
- **The paper/ruled-line background and stamp-style checkbox** — these are
  the app's actual visual signature and the opposite of generic; redesigning
  them away would have thrown out the one thing that already made Viora look
  like a considered product rather than a template.
- **Centered single-card auth screens** — this is the correct pattern for a
  single-focus sign-in/sign-up/confirm flow (Linear, Stripe, and Notion all
  do the same thing); the fix here was token consistency, not layout
  invention for its own sake.

## Changed files

```
tailwind.config.ts                 design tokens (color/radius/shadow scale)
app/globals.css                    wordmark fix, focus-visible, skeleton keyframes
app/layout.tsx                     unchanged
app/page.tsx                       header/nav hierarchy
app/login/page.tsx                 primitives, token cleanup
app/join/[token]/page.tsx          StatusScreen, dropped emoji
app/auth/confirm/page.tsx          StatusScreen (deduped 3 inline SVG blocks)
app/auth/callback/page.tsx         spinner instead of bare text
components/TasksSection.tsx        list rows not cards, icons, progress bar, empty/loading states
components/LinksSection.tsx        list rows not cards, icons, empty/loading states
components/TeamPanel.tsx           tokens, Badge, backdrop click-to-close
components/PendingInvites.tsx      inline tealSoft notice instead of white card
components/ActivityFeed.tsx        type scale + spacing pass
components/ItemHistory.tsx         chevron icon instead of ▲▼ glyphs
components/ui/Button.tsx           new
components/ui/IconButton.tsx       new
components/ui/Input.tsx            new
components/ui/Badge.tsx            new
components/ui/EmptyState.tsx       new
components/ui/Skeleton.tsx         new
components/ui/ProgressBar.tsx      new
components/ui/StatusScreen.tsx     new
package.json                       + lucide-react
```

Verified with `tsc --noEmit` and `next build` — both clean.

## Follow-up pass

Four targeted changes on top of the initial redesign:

1. **Task titles no longer truncate.** `truncate` (ellipsis + `min-w-0`) is
   replaced with `break-words`, and the row switched from `items-center` to
   `items-start` so the checkbox and the delete button stay aligned to the
   first line when a title wraps to two or three lines.
2. **"النشاط الأخير" (recent activity) is now collapsed by default**, using
   the exact same disclosure pattern as the per-item "السجل" (history)
   toggle — a rotating chevron, closed until clicked. It keeps loading and
   subscribing in the background either way, so live updates still land the
   moment you open it; it just doesn't take up space unasked.
3. **Names instead of usernames, and "أنت" for yourself.** Added
   `lib/displayName.ts`, a single shared helper used by both the task list
   and the activity/history feeds:
   - The small tag next to each task (`task.profiles`) now shows the
     person's real name — falling back to their username only if they never
     set one — and shows **أنت** instead of their own name when the task
     belongs to the person currently looking at it.
   - Activity-log entries (`"سارة أضافت مهمة: كذا"`) are generated
     server-side as full sentences with the name baked in at the start, so
     the client rewrites that leading name to **أنت** whenever `actor_id`
     matches the current user — same rule applied consistently in both the
     project-level activity feed and the per-task history.
   - `supabase/schema.sql` was also corrected: the *active* trigger
     functions (`log_task_activity`, `log_member_join` — Postgres uses the
     last `create or replace` in the file) were writing `@username` into
     every activity message. They now write the full name (falling back to
     username), without the `@` prefix, matching the two profile columns
     that actually exist for this purpose. **This requires re-running
     `supabase/schema.sql` against the project's database** for existing
     deployments — the SQL functions can't be changed by shipping frontend
     code alone.
4. **Formal register (فصحى) throughout.** Every user-facing string in every
   page and component — placeholders, buttons, empty/loading/error states,
   confirm dialogs, the two DB-generated activity/link message sets — was
   rewritten from Egyptian colloquial Arabic to standard formal Arabic (e.g.
   `"مفيش مهام... لسه"` → `"لا توجد مهام... بعد"`, `"اليوزر ده متسجل"` →
   `"اسم المستخدم هذا مسجّل"`, `"بنتأكد من حسابك..."` →
   `"جارٍ التحقق من حسابك..."`). Loanwords were swapped for their Arabic
   equivalents where a clean one exists (`اللينك` → `الرابط`, `اليوزر` →
   `المستخدم`). RTL layout and the underlying interaction model are
   unchanged — this was a tone pass, not a content or layout pass.


---

## Second pass — sidebar shell, bookmark system, component consolidation

This pass builds on the redesign above rather than replacing it — the brand
(paper/ink/teal, Fraunces display, hairline-divided lists, no card soup) was
already in good shape. What changed:

- **Persistent sidebar navigation** (`components/AppShell.tsx`) replaces the
  top tab bar on desktop — logo, Tasks/Links nav, and account/sign-out live in
  a fixed left rail, the pattern Linear/Notion/Attio use so the working area
  doesn't compete with global nav. Collapses to a bottom tab bar plus a
  slim header on mobile instead of just shrinking the same layout.
- **Links reimagined as a bookmark system, not a list.** Card grid with
  favicons, a client-side search box (filters the already-loaded array, no
  new network calls), and a collapsed-by-default composer instead of an
  always-open form eating vertical space.
- **New shared primitives**: `Avatar` (initials-or-image, used everywhere a
  person is shown instead of four separate ad-hoc implementations), `Modal`
  (the fixed-overlay + panel wrapper duplicated across TeamPanel,
  ConfirmPasswordModal, AvatarCropModal, UserProfileCard — now one component).
- **`lib/timeAgo.ts`** extracted from three copy-pasted implementations in
  ActivityFeed, ItemHistory, and (new) LinksSection.
- **Token refinements**: deeper teal, a proper elevation scale (`xs` →
  `modal`), Inter added as the body/UI face (nothing was actually loading a
  webfont for body text before — it was falling back to the system stack)
  paired with Fraunces for display headings and IBM Plex Mono for
  usernames/URLs, unchanged from before.
- No Supabase query, RPC call, auth flow, or realtime subscription was
  touched — every edit is scoped to JSX structure, Tailwind classes, and the
  two new/extracted lib helpers above.

---

## Third pass — new accent palette & type pairing ("Fountain & Ledger")

The prior two passes established the app's real identity: warm parchment,
hairline-divided lists instead of card soup, a considered component layer.
That identity was worth *keeping* — but its specific palette (cream paper +
Fraunces serif + terracotta-clay accent) sits close to a look that's become
an AI-generated-design default, and the brand mark itself (`logo-full.png`,
`logo-icon.png`, `app/icon.png`) was still carrying a leftover indigo/purple
tone that never matched the rest of the app. This pass keeps the warm,
editorial point of view the person asked for, but moves the palette and type
pairing to something more specific to the product: a shared task-and-link
notebook, styled after fountain-pen ink on a ledger page rather than generic
"premium SaaS cream."

**Color** — every accent is now a real ink, not a brand-blue:
- `bottle` (#234B3B) — deep bottle-green ink, the one primary action color
- `moss` (#55693E) — a distinct secondary green for accepted/positive state
- `oxblood` (#7A2E28) — the only red, reserved for destructive/error
- `brass` (#9C6B2E) — warm highlight for pending/attention states
- Parchment ground shifted from a bright cream (#FAF8F4) to a slightly
  deeper, less-saturated stone parchment (#F1ECDE) with a warmer near-black
  ink (#211D17) — enough to read as its own thing next to the earlier version.

**Type** — swapped Fraunces (a high-contrast display serif that's become a
common AI-design tell when paired with warm cream + clay) for Newsreader, a
literary serif with real optical italics. Upright Newsreader now carries
headings; the wordmark itself moved to Newsreader *italic* — a small,
deliberate signature distinct from both the old bold-sans logotype and from
any other screen element, evoking a signature at the bottom of a ledger page.
Inter (body/UI) and IBM Plex Mono (usernames, URLs, timestamps) are unchanged.

**Brand mark** — `logo-full.png`, `logo-icon.png`, and `app/icon.png` had the
mark itself recolored from the old indigo/purple to the new ink tone
(#211D17), with the mark's alpha channel/silhouette left byte-identical —
same shape, same anti-aliasing, new ink.

**Scale** — radius scale tightened (4 / 6 / 10 / 14px) and shadows re-tinted
from neutral black to ink-brown (`rgba(33,29,23,…)`) so elevation reads as
part of the same warm system instead of a generic gray drop-shadow.

Every component, list row, badge, and status state was carried over onto the
new tokens (`bottle`/`moss`/`oxblood`/`brass` replacing `teal`/`sage`/`clay`/
`amber` throughout) — no structural or functional change, verified with
`tsc --noEmit` and `next build`, both clean.
