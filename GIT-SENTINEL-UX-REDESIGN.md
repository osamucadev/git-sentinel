# Git Sentinel — HQ Redesign Proposal (UX / Visual Discovery)

> Status: **design discovery — not implemented.** This document is the
> implementation reference and design record for the HQ / Repository Details
> visual redesign. It captures the full analysis, wireframes, visual grammar,
> and reasoning produced during the discovery phase.
>
> Scope guardrails (unchanged from the brief):
> - Do **not** redesign or refactor the Git/Rust core.
> - Do **not** add features: no GitHub/GitLab API, auth, pull/push/checkout/
>   merge/rebase/commit/stash, background polling, filesystem watchers,
>   decorative charts, analytics, cloud, or AI/LLM features.
> - This redesign makes **existing information understandable**. Nothing more.
>
> ### Approved adjustments (post-review, binding for the first implementation)
>
> 1. **No left operations rail in the first implementation.** Use the documented
>    horizontal alternative (section 3.1): greeting / fleet interpretation →
>    compact fleet summary → horizontal filters → repository search → Fetch All →
>    then the full-width grouped repository list. The repository topology and rows
>    own the horizontal space. HQ must not feel like an admin dashboard with
>    sidebar navigation. The left rail (section 3.2) is deferred, not rejected.
> 2. **Remote freshness is context, not an alert.** An old Sentinel fetch does
>    **not** promote an otherwise healthy repository into an attention tier — there
>    is no fixed-threshold "stale = problem" rule. Freshness is always shown as
>    plain fact (`Fetched 8m ago`, `Fetched 3d ago`, `Never fetched through
>    Sentinel`). Tracking topology may lose visual authority as it ages (dashed
>    rail, `?` on counts), but conflict, unavailable, dirty working tree,
>    behind/diverged tracking, and detached state are what dominate attention.
>    `stale`/aging remains available as a **fact and an optional filter**.

---

## Table of contents

1. Diagnosis — why the current HQ fails informationally
2. Proposed HQ information architecture
3. Full HQ wireframe (desktop)
4. Repository row anatomy
5. The ten repository-state examples in the proposed topology
6. Visual grammar (nodes, lines, concepts, vocabulary)
7. Attention hierarchy & filtering model
8. Actions & overflow behavior
9. Repository Details proposal
10. Personality presentation differences (Technical / Cute / Sci-Fi / Jarbas)
11. `RepositoryState` capability & gaps
12. Design decisions, constraints, and reasoning
13. Source-of-truth: current code references

---

## 1. Diagnosis — why the current HQ fails informationally

**It shows Git; it does not interpret Git.**

| Problem | Where it comes from | Effect |
|---|---|---|
| Card grid `repeat(auto-fill, minmax(320px, 1fr))` | `src/personality/themes.css:209` | On a maximized window you get 3–4 columns of tall cards with big gutters *and* cramped interiors. Repos read as unrelated dashboard widgets. You cannot scan "which of my 12 repos is on fire" — you must visit each card. |
| Raw plumbing on screen | `src/components/RepoCard.tsx:7-14` renders `↑ 3 ahead ↓ 1 behind`, `vs origin/foo`, `Local` / `Tracking` | You must know Git internals to know whether that is good, bad, or urgent. There is no verdict and no priority. |
| Weak fleet summary | `personaStatus()` → `"3 repositories · 1 dirty"` (`src/personality/copy.ts:45`); only `dirtyCount` is aggregated (`src/screens/Hq.tsx:17`) | Conflicts, divergence, "behind", stale remotes, and unreachable repos are never summarized. The one number shown is the least urgent one. |
| No attention ordering | `src/screens/Hq.tsx:95` maps `app.repos` in registration order | A conflicted repo sits below three clean ones. |
| Six equal buttons per card | `src/components/RepoCard.tsx:129-142` | `Open in Terminal` (the core workflow) has the same visual weight as `Remove from Sentinel` (destructive, rare). Pure noise. |
| Local vs tracking styled identically, side by side | `src/components/RepoCard.tsx:88-119` | Invites exactly the conflation the product rules forbid. Nothing signals that `origin/*` is a **snapshot**, not the live server. |
| Staleness is in the data but buried | `card.fetchedAgo` / `card.fetchedNever` in 12px muted text; no threshold logic | You cannot act on it and you will not notice it. |
| Detached HEAD collapses the row | `core/src/inspect.rs:190` only computes divergence when `branch_head` is `Some` | A detached repo shows a badge and almost nothing else. |
| Personalities are recolored clones | All variation is CSS tokens in `themes.css` + one greeting + one status string in `copy.ts` | Technical = generic admin panel; Cute = pink admin panel; Sci-Fi / Jarbas = admin panel with a display font. Same layout, same components, same information rhythm. |

**The core reframe:** every row should lead with a *verdict in plain language* and a
*small spatial diagram*, ordered by *how much it needs you*. Raw counts stay
available but stop being the headline.

---

## 2. Proposed HQ information architecture

Three layers, strict progressive disclosure:

```
FLEET SUMMARY     → "How is the whole workspace? What needs me?"        (always visible)
REPOSITORY LIST   → "Per repo: where am I, is it clean, is it urgent?"  (dense rows, grouped by attention)
REPOSITORY DETAILS→ "Exactly what is happening in this one repo?"       (separate screen, same visual language)
```

**HQ never shows:** full branch lists, remote URLs, per-file breakdowns, commit
hashes beyond the short latest one. Those live in Details.

**The list is grouped into attention tiers** (section 7), each an
optionally-collapsible band. Within a tier, rows sort by `latestCommit.date`
descending (most recently touched first) — this is also the answer to *"where
should I continue working?"*

**One derivation module** (`src/fleet.ts`, a new **frontend-only** file) turns
each `RepoView` into a `RepoStatus`:

```ts
type RepoStatus = {
  tier: 'blocked' | 'attention' | 'ahead' | 'healthy';
  facts: Fact[];                  // may be several at once
  stale: boolean;                 // modifier, not a tier
  local:  PositionVsRef | null;   // vs localBranches.baseBranch
  upstream: PositionVsRef | 'none' | 'gone' | null;
  headline: HeadlineKey;          // one verdict key; personality picks the words
};
```

Every personality renders from `RepoStatus` + `RepositoryState`. No personality
recomputes Git facts, tier logic, or freshness thresholds.

---

## 3. Full HQ wireframe (desktop, ~1400px)

### 3.1 Implemented layout — horizontal header, full-width list

Per approved adjustment 1, the first implementation uses a **horizontal header
band** above a full-width grouped list. No sidebar. The topology and rows own the
horizontal space.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  Git Sentinel                                                            HQ    Settings       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  Good afternoon, Samuel.                                                                      │
│  Two repositories need your attention. One has changes to review.                             │
│                                                                                              │
│  12 repositories · 6 healthy · 3 modified · 1 diverged · 1 ahead · 1 never fetched            │
│                                                                                              │
│  [ All 12 ] [ Attention 2 ] [ Ahead 1 ] [ Modified 3 ] [ Stale 1 ] [ Healthy 6 ]             │
│                                                                                              │
│  ┌─────────────────────────────────────────────────┐   [ + Add repository ]  [ Fetch all (12)]│
│  │ Search repositories…                            │                                          │
│  └─────────────────────────────────────────────────┘                                          │
│                                                                                              │
│  ── NEEDS ATTENTION ─────────────────────────────────────────────────────────────────────  2 │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ maya-lms          ✎ modified    main  ●────────◉ feature/quiz-refactor       ↑7 of main │  │
│  │ ~/dev/maya-lms    4 mod · 1 new  origin/feature/quiz-refactor ●╌╌╌╌◉  ↑2?               │  │
│  │                                  Fetched 6d ago            a3f9c21 · 2h ago    [>_]  ⋯  │  │
│  ├────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ job-watcher       ▲ diverged     origin/feature/foo ●──○─▶ your 3 / remote 2  ↑3 ↓2 div │  │
│  │ ~/dev/job-watcher clean · main   Fetched 1h ago            1c4d900 · 1d ago    [>_]  ⋯  │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                              │
│  ── AHEAD ───────────────────────────────────────────────────────────────────────────────  1 │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ portfolio     ✓ clean   ◉ main  ●───◉ origin/main   ↑4 to push   0aa9f1 · 3h  [>_]  ⋯  │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                              │
│  ── HEALTHY ─────────────────────────────────────────────────────────────────────────────  6 │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ api-service   ✓ clean   ◉ main   ✓ synced · origin/main   Fetched 12m   9f0a1c · 5h [>_]⋯│ │
│  │ design-tokens ✓ clean   ◉ main   ✓ synced · origin/main   Fetched 12m   44be20 · 1d [>_]⋯│ │
│  │ clean-app     ✓ clean   ◉ main   ✓ synced · origin/main   Fetched 12m   0aa9f1 · 2d [>_]⋯│ │
│  │ … 3 more …                                                                              │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Header order is fixed: **greeting/interpretation → compact fleet summary →
  horizontal filter chips → search + Add + Fetch all → grouped list.**
- The fleet summary is a single readable line built from real derived counts
  (section 7); the "never fetched" / "stale" figure is shown as neutral context,
  never styled as a warning.
- **Healthy rows are single-line** (~40px). **Attention rows grow** to 2–3 lines.
  Problems take up more space.
- Group headers show a count. Groups: **Needs attention** (blocked + attention
  tiers), **Ahead**, **Healthy**. Healthy collapses to a summary once there are
  more than ~20 repos.
- The `[>_]` (Open in Terminal) button appears on hover for healthy rows,
  always-visible for attention rows.
- **Responsive:** at ≤1000px the latest-commit *subject* drops (keep the relative
  time), the topology stays. Design targets: ~1000px minimum, ~1400px
  comfortable, maximized desktop window optimal. No mobile.

### 3.2 Deferred alternative — left operations rail

Kept on record for a later iteration. A thin left rail holding fleet stats,
filters, and Add; the list to its right. Uses horizontal space differently and
reads more like a console. **Not implemented now** (adjustment 1). If revisited,
the rail collapses to an icon strip at ≤1100px.

---

## 4. Repository row anatomy

Collapsed attention row, zoned:

```
   IDENTITY (≈220px)      STATE (≈120)     GIT POSITION (flex, ≈560)                 ACTIVITY (≈190)     ACTIONS
┌────────────────────┬───────────────┬──────────────────────────────────────────┬───────────────────┬──────────┐
│ maya-lms           │ ✎ modified    │ main ●────────◉ feature/quiz-refactor     │ a3f9c21           │ [>_]  ⋯  │
│ ~/dev/maya-lms     │ 4 mod · 1 new │ ↑7 of main                               │ "wip: quiz timer" │          │
│                    │               │ origin/feature/… ●╌╌╌╌◉  ↑2?  · stale 6d  │ 2h ago            │          │
└────────────────────┴───────────────┴──────────────────────────────────────────┴───────────────────┴──────────┘
```

Zone rules:

- **IDENTITY** — `name` (display font) + `path` with `~` collapsed, muted, one
  line, ellipsis in the middle for long paths. The whole row is a click target →
  Details.
- **STATE** — the working-*copy* condition only (never divergence). One of:
  `✓ clean` / `✎ modified` / `⚠ conflicted` / `⚑ detached`. Second line: the
  smallest useful count breakdown (`4 mod · 1 new`, `2 unresolved`). Counts from
  `workingTree.*`.
- **GIT POSITION** — the semantic topology (sections 5–6). Two rails max, `◉`
  (YOU) column-aligned between them. Local rail present only if `localDivergence`;
  upstream rail always represented (as a diagram, or the words `no upstream`).
- **ACTIVITY** — `latestCommit.hash` + subject (truncated) +
  `relativeTime(latestCommit.date)`. Third line when relevant: fetch freshness
  (`fetched 6d ago`, `never fetched here`).
- **ACTIONS** — `[>_] Open in Terminal` primary (icon, tooltip). `⋯` overflow
  (section 8). No other buttons in the row.

Healthy row collapses zones onto one line:

```
│ api-service   │ ✓ clean │ ◉ main  ✓ synced · origin/main │ 9f0a1c · 5h │ [>_] ⋯ │
```

**Row interaction:** click anywhere on the row (except the two action targets) →
Repository Details. An optional expand chevron (`▸`) that reveals the full spine
+ counts inline without leaving HQ is possible but **not recommended for V1** —
the collapsed row already carries the compact spine, so keep it simple:
row click = Details.

---

## 5. The ten repository-state examples in the proposed topology

Legend is in section 6. Field is ~58 cols. `◉` = YOU, `●` = a ref tip,
`○` = fork point, `───` = commits (schematic; the number is exact),
`╌╌╌` = stale / untrusted span.

### 5.1 — clean `main`, synced with upstream

```
◉ main   ✓ synced with origin/main            · fetched 3m ago
```

On the trunk there is no local base to compare, so no base rail. Synced
collapses `●` and `◉` into one node; the diagram degrades to a single reassuring
line.

### 5.2 — feature branch ahead of local `main` (no upstream)

```
main  ●───────────────◉  feature/payments-v2         ↑ 7 of main
⚑ no upstream — nothing pushed yet
```

`localDivergence = {ahead:7, behind:0}`, `upstream = null`.

### 5.3 — feature branch ahead of upstream

```
main               ●──────◉  feature/foo             ↑ 4 of main
origin/feature/foo  ●──────◉                          ↑ 2 to push   · fetched 6m ago
```

Two independent facts, two rails. "of main" = local comparison; "to push" =
tracking comparison. Never merged into one number.

### 5.4 — feature branch behind upstream

```
main               ●──◉  feature/foo                 ↑ 1 of main
origin/feature/foo  ◉────▶●  2 new upstream           ↓ 2 to pull   · fetched 1m ago
```

Behind is drawn as the remote node sitting *ahead* of `◉` on the rail, with the
count of incoming commits named.

### 5.5 — diverged from upstream

```
main                    ●─────◉  feature/foo         ↑ 6 of main
                              ┌──▶ ◉  your 3
origin/feature/foo  ●────○
                              └──▶ ●  remote 2        ↑ 3 ↓ 2  diverged  · fetched 1h ago
```

The fork node `○` (common ancestor) makes "diverged" a *shape*, not two arrows
you have to reconcile.

### 5.6 — dirty working tree

```
main  ●─────◉  feature/foo   ✎                        ↑ 3 of main
      working tree: 4 modified · 1 untracked
```

The `✎` rides on the `◉` node — uncommitted work sits *on top of* HEAD. Topology
is otherwise normal; the STATE zone carries the detail.

### 5.7 — conflicted repository

```
⚠ merge in progress on main — 2 files unresolved
```

Conflict outranks everything; the diagram is replaced by the conflict statement.
Tier = blocked.

### 5.8 — branch with no upstream

```
main  ●──────────────────◉  spike/new-idea            ↑ 12 of main
⚑ no upstream — this branch exists only on your machine
```

Distinct from "stale": there is no remote-tracking ref at all, so there is
nothing that could be out of date.

### 5.9 — detached HEAD

```
◌ detached at a3f9c21                                 not on any branch
  "fix: revert half-done parser change"
```

`◌` = a position that is not a branch. We can show the hash and subject from
`latestCommit`; we cannot show distance-from-base (see section 11).

### 5.10 — stale remote snapshot

```
main               ●────◉  feature/foo               ↑ 3 of main
origin/feature/foo  ●╌╌╌╌◉                            ↑ 1?   · last fetched 6 days ago
                    remote snapshot may be out of date — Fetch to refresh
```

The `╌╌╌` span and the trailing `?` on the count say *don't trust this number*.
An inline `Fetch` affordance appears only in this state.

---

## 6. Visual grammar

### 6.1 Nodes

| Glyph | Meaning | Rendered as (SVG/CSS) |
|---|---|---|
| `◉` | **YOU** — current HEAD checkout. Exactly one per repo, ever. | filled disc, `--accent`, slightly larger; the only node that gets `--glow` where a personality defines one |
| `●` | a **named reference tip** — the local base branch tip, or the upstream tip. Labeled with the ref name. | filled disc, `--text-dim` |
| `○` | **fork point** (merge-base) — drawn only when diverged | hollow ring, `--border-strong` |
| `◌` | a position that is **not trustworthy or not a branch** — detached HEAD, or an upstream never fetched | dotted ring |
| `⨯` | repository **unavailable** — inspection failed (path moved/deleted) | struck glyph, `--danger` |

### 6.2 Lines

| Mark | Meaning |
|---|---|
| `───` solid | commits that exist between two nodes (schematic length; the adjacent number is the true count) |
| `╌╌╌` dashed | the span is **stale or unknown** — data older than the freshness threshold, or upstream position unverified |
| fork `┌─ / └─` | the branch has **diverged**: your commits and the ref's commits both descend from `○` |

### 6.3 How each concept is represented

- **Current checkout (YOU):** always `◉`, always the pivot column that the base
  rail and upstream rail align to. You read one point with (up to) two
  relationships, not two separate graphs.
- **Local base:** a `●` on the **upper** rail, left-labeled with the branch name
  (`main`, `master`, `develop` — whatever `localBranches.baseBranch` resolved
  to). Absent entirely when you are on the base branch itself.
- **Upstream:** a `●` on the **lower** rail, labeled with the full tracking ref
  (`origin/feature/foo`). If `upstream` is null the rail is replaced by the
  literal sentence `no upstream …`. Upstream is visually *below* and always
  carries a freshness timestamp — it is a snapshot, never "the server".
- **Ahead:** `◉` sits to the right of `●`; annotation `↑ N`, with a verb phrase —
  `of main` (local) or `to push` (tracking).
- **Behind:** the `●` sits to the right of `◉` with the incoming count named
  (`2 new upstream`); annotation `↓ N to pull`.
- **Diverged:** the `○` fork with two arms; annotation `↑ A ↓ B diverged`.
- **Synced:** nodes collapse, `✓ synced`.
- **Remote freshness / aging:** the upstream rail always carries a plain fact —
  `Fetched 8m ago`, `Fetched 3d ago`, or `Never fetched through Sentinel`. Past an
  **aging** threshold (implementation: 72h) the upstream rail is drawn with a
  dashed span and any tracking count gets a `?` suffix — a **visual-confidence
  cue only**. Aging never changes the tier and never turns a healthy repository
  into an attention item (approved adjustment 2). `stale`/aging is exposed as a
  fact and an optional `Stale` filter.
- **Detached HEAD:** `◌` with hash + latest subject, `not on any branch`. No
  rails.
- **Unavailable** (inspect failed — path moved/deleted): `⨯ maya-lms — folder not
  found` row, blocked tier, only action is `⋯ → Remove` or `Refresh`.

### 6.4 Compact inline form

Used in the list; the fork/rails form is used in Details and on attention rows.

```
[✎|⚠] ◉ <branch>  ·  <local phrase>  ·  <upstream phrase>  ·  <freshness>
```

The phrases are drawn from a fixed vocabulary so direction is always words, never
mental math:

| Situation | local phrase | upstream phrase |
|---|---|---|
| on base branch | *(omitted)* | — |
| ahead of base | `↑7 of main` | — |
| behind base | `↓2 of main` | — |
| diverged from base | `↕ 3↑2↓ of main` | — |
| ahead of upstream | — | `↑2 to push` |
| behind upstream | — | `↓3 to pull` |
| diverged | — | `↕ diverged 3↑2↓` |
| synced | — | `✓ synced` |
| no upstream | — | `no upstream` |
| upstream gone | — | `upstream gone` |
| stale | — | `… · stale 6d` appended |

This "of main" / "to push" / "to pull" vocabulary is the key UX win: it replaces
`↑3 ↓1 vs origin/foo` with directional intent that does not require decoding.

---

## 7. Attention hierarchy & filtering model

A repo has **many facts at once** (`dirty + ahead + stale`). We keep all facts as
chips but compute **one tier** for sorting/grouping, by priority:

```
blocked    = unavailable  OR  conflicted>0  OR  (detached AND dirty)
attention  = diverged-from-upstream  OR  behind-upstream  OR  upstream-gone
             OR  dirty  OR  detached
ahead      = ahead-of-upstream  OR  ahead-of-base           (working tree clean)
healthy    = clean, attached, synced-or-no-upstream
```

**Freshness/aging is never a tier input** (approved adjustment 2). A healthy repo
that has not been fetched in weeks stays **Healthy**. It may carry an `aging`
fact (used only for the dashed rail / `?` cue and the optional `Stale` filter and
the fleet-summary context figure). `never fetched through Sentinel` and
`Fetched Nd ago` are plain facts shown on the row, not warnings.

**Fact set** (all that can co-exist on one repo):
`conflicted`, `dirty`, `detached`, `diverged-upstream`, `behind-upstream`,
`ahead-upstream`, `ahead-base`, `behind-base`, `diverged-base`, `upstream-gone`,
`no-upstream`, `synced`, `unavailable`.

**Fleet summary** (top of HQ):
`12 repositories · 6 healthy · 3 modified · 1 diverged · 1 ahead · 1 stale`.
Categories are the real derived facts, not a fixed list. Jarbas renders the same
numbers as prose.

**Filters** (left rail): `All` · `Attention` (blocked + attention) · `Ahead` ·
`Modified` · `Stale` · `Healthy`. Single-select, counts shown. Search filters by
name/path within the active filter.

**Default order:** blocked → attention → ahead → healthy; within each,
`latestCommit.date` desc. This makes the top of the list *both* "what is wrong"
and "what I touched last" — the two questions you actually open the app with.

---

## 8. Actions & overflow behavior

**In the row:**

- `[>_] Open in Terminal` — primary, icon + tooltip, always visible on attention
  rows, hover-visible on healthy rows. (`api.openInTerminal(path)`, already
  wired.) Rationale: the core workflow is *Git Sentinel → find repo → Open in
  Terminal → run Claude Code or another CLI*.
- Click anywhere else on the row → Repository Details.
- `⋯` overflow menu:

```
⋯
  Open folder
  Fetch                (also appears inline when stale)
  Refresh              (re-inspect, local only)
  Copy path
  ─────────────
  Remove from Sentinel   (danger, confirm dialog — unchanged)
```

**Bulk, above the list:** `Fetch all (n)` with the existing concurrency-limited
summary toast. `Refresh all` moves into a small `⋯` next to it (it is cheap and
rarely needed manually).

This removes 4 of the 6 always-visible buttons per repo
(`src/components/RepoCard.tsx:129-142`).

---

## 9. Repository Details proposal

Same visual language as HQ — not the current key/value dump. One screen,
scrollable, sections in priority order:

```
← HQ                                              [>_] Terminal   Open folder   Fetch   Refresh   ⋯

maya-lms                                                              ✎ MODIFIED
~/dev/maya-lms

┌─ CHECKOUT ───────────────────────────────────────────────────────────────────┐
│                                                                              │
│   main               ●──────────────◉  feature/quiz-refactor    ↑ 7 of main   │
│                                     │                                         │
│   origin/feature/quiz-refactor ●╌╌╌╌◉                           ↑ 2?  stale    │
│                                                                              │
│   Local base: main  ·  7 commits ahead, 0 behind                              │
│   Upstream:   origin/feature/quiz-refactor  ·  2 ahead  ·  last fetched 6d ago │
│              This is a local snapshot from your last fetch, not the server.   │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ WORKING TREE ───────────────┐  ┌─ LATEST COMMIT ─────────────────────────────┐
│  4 modified                  │  │ a3f9c21  "wip: quiz timer"                   │
│  1 untracked                 │  │ 2 hours ago · 2026-09-06 14:08              │
│  0 staged · 0 deleted        │  └─────────────────────────────────────────────┘
│  0 conflicts                 │
└──────────────────────────────┘

┌─ BRANCHES · 14 ──────────────────────────────────────────────────────────────┐
│  [ Filter branches…                                     ]                     │
│  › feature/quiz-refactor        (current)                                     │
│    main                                                                       │
│    feature/login-rework                                                       │
│    …                                                                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ REMOTES ────────────────────────────────────────────────────────────────────┐
│  origin   git@github.com:samuel/maya-lms.git                                  │
│  upstream origin/feature/quiz-refactor  ·  fetched 6d ago  ·  [ Fetch now ]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

- The **checkout spine is the hero** and is the same component instance as the HQ
  row's expanded form.
- Working tree and Latest commit are compact side-by-side blocks, not a 160px-
  label KV grid (current `src/screens/RepositoryDetails.tsx:62-88`).
- The searchable branch list (`src/screens/RepositoryDetails.tsx:91-101`) is kept
  as-is conceptually, restyled.
- "Local divergence" and "Remote-tracking divergence" stop being two lookalike
  rows (`src/screens/RepositoryDetails.tsx:102`, `:121`) — they are the two
  labeled rails of the spine plus a sentence each.
- The snapshot disclaimer is stated **once**, in the Checkout section, where the
  upstream rail is.

---

## 10. Personality presentation differences

**The architecture, the components, and `RepoStatus` / `RepositoryState` are
identical across all four.** A personality supplies only:

1. a **token set** (already exists in `src/personality/themes.css`),
2. a **glyph set** for the topology (`you`, `ref`, `fork`, `line`, `dashed`),
3. a **verdict vocabulary map** (the `<local phrase>` / `<upstream phrase>` /
   headline strings),
4. an optional **prose formatter** for the greeting + fleet summary + per-row
   interpretation,
5. motion / spacing flags.

No personality contains divergence math, tier logic, or freshness thresholds —
those are in `src/fleet.ts`. This is the hard architectural rule: **do not build
four applications.**

Same repo (state 5.5, diverged), four renderings:

### Technical

Serious infra tool. Dense (32px healthy rows), hairline row dividers, *no card
borders in the list* — it is a table. Mono topology, thin 1px rails, nodes are
5px squares. Verdict right-aligned: `↑3 ↓2 diverged`. No animation. Section
headers: `UPSTREAM`. Vocabulary: `↑2 to push`, `↓3 to pull`, `diverged`.

```
job-watcher   clean   origin/feature/foo ●──○──▶ 3 / 2   ↑3 ↓2 diverged   1c4d900 · 1d   [>_] ⋯
```

### Cute

Softer, still precise. Rows ~44px, more breathing room, `--radius` corners on
group bands (not every row). Nodes are rounded `◍`, rails drawn as a gently
curved stroke, `--behind` is a warm rose not alarm-red. Verdict:
`3 to share · 2 to catch up`. Node does a 1-frame settle on hover. Empty state:
"All your repos are happy right now." No emoji inside data. Not a children's app;
Git information is never hidden. Vocabulary: `2 to share`, `3 to catch up`,
`drifted apart`.

```
job-watcher · main
  origin/feature/foo  ◍──◜◝──◍  drifted apart — 3 yours, 2 theirs
```

### Sci-Fi

Restrained command console. Dark, mono, uppercase headers `// UPSTREAM`. `◉`
carries a subtle `--glow`; rails are `━━━`; on Refresh/Fetch a faint scanline
sweeps the row once. Verdict vocabulary: `DIVERGENCE Δ +3 / −2`, `NOMINAL`,
`CONFLICT`, `NO LINK`. Nodes pulse very slowly. No neon fills; contrast stays AA.
Avoid cyberpunk cliché and constant animation.

```
JOB-WATCHER            ORIGIN/FEATURE/FOO  ●━━○━━▶ +3 / −2      DIVERGENCE
STATE: CLEAN           LAST SYNC 1H                             Δ +3 / −2
```

### Jarbas

Elegant digital butler. Near-black `#14130f`, champagne `◉`, thin gold rails,
generous leading. Greeting in a serif display face; data in the mono/sans. The
row *interprets* rather than lists:

```
Good afternoon, Samuel.
Two repositories merit your attention.

  Job Watcher has diverged from its upstream — three of your commits,
  two from origin.                                    origin/feature/foo  ●──○──●
  Maya LMS has local changes you haven't committed.

  Everything else is in order.
```

Fleet summary as prose: *"Twelve repositories. Six in good order, three with
local changes, one diverged, one awaiting a fetch."* When all clear: *"All
repositories are accounted for, sir. Nothing requires your attention."* Uses
`formOfAddress` from onboarding naturally, never more than once per screen. No
animation beyond a soft fade. Competent, calm, understated — not a butler
gimmick. Portuguese example: *"Boa tarde, Samuel. Há dois repositórios que
merecem sua atenção."*

### Shared, non-negotiable across all four

The two-rail spine with `◉` as the pivot; local-vs-upstream never merged; the
freshness line on every upstream; the attention grouping and order; the same
three-layer disclosure. You can tell it is Git Sentinel in any skin. The
information architecture stays recognizable; personality changes typography,
density, spacing, borders, radius, glyphs, motion, microcopy, status vocabulary,
section treatment, empty states, and the greeting/interpretation.

---

## 11. `RepositoryState` capability & gaps

**Verdict: `RepositoryState` is already enough for V1 — with one optional gap.**

Everything the redesign needs is already derivable:

| Need | Source | Notes |
|---|---|---|
| identity, path | `name`, `path` | ✓ |
| current branch / detached | `currentBranch`, `detachedHead` | ✓ |
| clean / dirty / conflicted + counts | `workingTree.*` | ✓ |
| local base + ahead/behind | `localBranches.baseBranch`, `localDivergence` | ✓ |
| upstream + ahead/behind | `upstream`, `trackingDivergence` | ✓ |
| **no upstream** vs **upstream gone** | `upstream == null` → no upstream; `upstream != null && trackingDivergence == null` → gone | ✓ derivable, no new field |
| synced | `trackingDivergence.ahead == 0 && behind == 0` | ✓ |
| stale / never fetched | `RepoView.lastSuccessfulFetch` (already persisted in `RegisteredRepo`) + a frontend age threshold | ✓ no core change |
| unavailable | `RepoView.error` from a failed `inspect` | ✓ |
| latest commit + activity sort | `latestCommit.{hash,subject,date}` | ✓ |
| branch list (Details) | `localBranches.names` | ✓ |
| remotes (Details) | `remotes[]` | ✓ |

### The one gap — optional, recommend deferring

**Distance from base when HEAD is detached.** `core/src/inspect.rs:190` only
computes `localDivergence` when `status.branch_head` is `Some`, so a detached
checkout has `localDivergence == null` and `trackingDivergence == null`. The
redesign handles this fine (`◌ detached at <hash>` + subject), but it *cannot*
say "detached, 4 commits behind main". If that is wanted later, the exact
addition would be:

- **Field:** `RepositoryState.detached_position: Option<Divergence>` (ahead/behind
  of the picked base; `baseBranch` = the base).
- **Why:** it is the only "where am I" question the current model cannot answer,
  and only in the detached case.
- **Not required for V1** — detached HEAD is an edge state and "not on any
  branch" is already an adequate verdict.

### Smaller notes (no new fields, just awareness)

- `lastSuccessfulFetch` only updates on a fetch *through Sentinel*
  (`src/state/AppState.tsx:197-206`); a CLI `git fetch` will not move it. The copy
  already says "fetched … here / through Sentinel", so this is a known,
  acceptable limitation — not a core gap.
- The base-branch picker (`pick_base_branch`, `core/src/inspect.rs:98`) can return
  `None` legitimately (on `main`/`master`, or no candidate exists). The design
  treats "no base rail" as a valid, common state, not an error.
- "upstream gone" (`upstream` set, `trackingDivergence` null) is detectable in the
  frontend and gets its own fact/verdict without any core change.

---

## 12. Design decisions, constraints, and reasoning

### Decisions

1. **Dense vertical list, one repo per row — not a card grid.** Cards make repos
   feel like unrelated widgets and waste horizontal space while cramping
   verticals. A list is naturally scalable (3 → 100 repos) and reads as an
   operational console. No virtualization in V1; grouping + collapse handle
   scale.
2. **Attention tiers drive order and grouping.** The app is opened to answer
   "what needs me?" and "where do I continue?". Registration order answers
   neither. One computed tier per repo (by priority), all raw facts preserved as
   chips.
3. **Variable row height as signal.** Healthy = 1 line; attention = up to 3.
   Problems occupy more screen. This is deliberate, not a layout accident.
4. **Semantic Git topology, not a commit graph.** A small deterministic diagram
   derived from the normalized `RepositoryState`: two rails (`local base`,
   `upstream`) sharing one pivot node (`◉` = YOU). It is explicitly **not** the
   real commit DAG and must never attempt to reconstruct one.
5. **Local and remote-tracking state are never visually merged.** They are two
   separate rails with different labels and different verb vocabulary
   (`of main` vs `to push`/`to pull`). `origin/*` is always shown below, always
   with a freshness timestamp, and described once as "a local snapshot, not the
   server".
6. **Direction is always words.** `↑3 ↓1 vs origin/foo` becomes `3 to push` /
   `2 to pull` / `diverged`. The diagram carries spatial intuition; a 1–3 word
   verdict carries the meaning.
7. **Freshness is context, not an alarm** (approved adjustment 2). The upstream
   rail always shows a plain fact (`Fetched 8m ago` / `Fetched 3d ago` / `Never
   fetched through Sentinel`). Past a 72h aging threshold the rail loses visual
   authority (dashed span, `?` on counts) but the repo's tier is unchanged — an
   old fetch on an otherwise-healthy inactive repo keeps it in Healthy. `aging`
   stays available as a fact and an optional `Stale` filter.
8. **One primary action in the row: Open in Terminal.** It is the core workflow.
   Everything else (Open folder, Fetch, Refresh, Copy path, Remove) goes to a
   `⋯` overflow. Row click opens Details.
9. **Progressive disclosure.** HQ answers "what needs attention?"; Details answers
   "exactly what is happening here?". HQ never shows branch lists, remote URLs, or
   per-file breakdowns.
10. **Personalities share 100% of business logic.** Personality = tokens + glyph
    set + verdict vocabulary + optional prose formatter + motion flags. A single
    `src/fleet.ts` owns all Git-fact derivation. Explicitly not four apps.
11. **Horizontal header band** (approved) for greeting/interpretation, compact
    fleet summary, filter chips, search, Add, and Fetch all — above a full-width
    grouped list. No sidebar; the topology and rows own the horizontal space. The
    left operations rail is recorded in section 3.2 as a deferred alternative.

### Constraints honored

- No changes to the Rust/Git core (one optional future field named, not required).
- No new Git operations, no network beyond the existing explicit Fetch, no
  polling, no watchers, no external integrations, no decorative charts, no AI.
- Desktop Linux only; ~1000px min, ~1400px comfortable. No mobile.
- All copy remains translated (en / pt-BR / es) and personality only chooses tone
  — Git facts are never produced in the copy layer
  (`src/personality/copy.ts` contract preserved).
- Theme-token discipline preserved: components read tokens, never hard-coded
  colors (`src/personality/themes.css` contract).

### Anti-patterns explicitly avoided

Arbitrary card grids; huge border-radius everywhere; excessive pills; random
gradients; decorative metric cards; meaningless charts; excessive shadows; every
section in a floating card; oversized hero sections; giant empty spacing;
glassmorphism for no reason; icon + title + subtitle repeated endlessly. Every
visual element must earn its place by helping the user understand repository
state.

---

## 13. Source-of-truth: current code references

Frontend:

- `src/App.tsx` — shell, topbar, view routing (`hq` / `details` / `settings`).
- `src/state/AppState.tsx` — `RepoView` type, inspection pool, `fetchAll`
  concurrency, `lastSuccessfulFetch` persistence.
- `src/screens/Hq.tsx` — current HQ (greeting block, action row, `repo-grid`).
- `src/components/RepoCard.tsx` — current per-repo card (the thing being replaced).
- `src/screens/RepositoryDetails.tsx` — current details (KV dumps + branch list).
- `src/personality/index.ts` — `applyPersonality` sets `data-personality` on
  `<html>`.
- `src/personality/copy.ts` — `personaGreeting`, `personaStatus`.
- `src/personality/themes.css` — all design tokens + shared component CSS.
- `src/i18n/*` — `en` canonical dict, `fill`, `relativeTime`, `greetingPart`.
- `src/types.ts` — `RepositoryState` / `Divergence` mirror, `SentinelConfig`,
  `RegisteredRepo` (already has `lastSuccessfulFetch?`).
- `src/api.ts` — Tauri command wrappers (`inspectRepository`, `fetchRepository`,
  `openInTerminal`, `openFolder`, `validateRepository`, `pickFolder`).

Core (read-only for this redesign):

- `core/src/model.rs` — `RepositoryState`, `WorkingTree`, `LatestCommit`,
  `LocalBranches`, `Divergence`, `Remote`.
- `core/src/inspect.rs` — `inspect()`, `parse_status()`, `pick_base_branch()`,
  `parse_ahead_behind()`, `fetch()`. Note `:190` — divergence only computed for
  attached HEAD.

### New frontend artifacts this redesign introduces (when implemented)

- `src/fleet.ts` — `deriveRepoStatus(RepoView): RepoStatus`, tier logic,
  freshness threshold, fact set, fleet aggregation. Single source of Git-fact
  interpretation.
- A topology component (SVG/CSS) rendering the two-rail spine from
  `RepoStatus` + `RepositoryState`, with a compact inline variant and an expanded
  variant.
- A personality glyph/vocabulary map keyed on `data-personality`.
- Restructured `Hq.tsx` (operations rail + grouped list) and
  `RepositoryDetails.tsx` (checkout-spine hero + compact sections).
```
