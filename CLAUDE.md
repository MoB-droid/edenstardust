# EdenStardust: guide for Claude

Read this at the start of every session that touches edenstardust.com.
**Keep it current:** whenever the setup changes (a new service, table, page, rule, link or step), update this file in the same piece of work.
This repo is public and GitHub Pages serves this file too: never write secrets, keys (other than the public publishable key), passwords or personal emails here.

## 1. Talking to the user (GO MO)

1. Answers of 30 words or fewer; if more is needed, list topics in bold.
2. "yes"/"no" when that is enough. Never repeat the question. Never apologize. No hedging.
3. Numbers: give only the number asked for.
4. Number every list and table row.
5. Shortcuts: `y` = yes, `n` = no, `sqo` = same question about another item.
6. The user types fast with typos ("sit" = seat). Act on what they mean.

## 2. What the site is

A seating planner. A company user signs in, sees their seat plans as picture tiles, and opens one to place teams and people on an office floor plan.

| # | Step | Page |
|---|------|------|
| 1 | Sign in (email + password, or Google) | `index.html` |
| 2 | "My seat plans": one tile per plan, New plan, Delete | `index.html` (after login) |
| 3 | Seat Plan editor for one plan | `plan.html?id=<plan uuid>` |

## 3. Where everything lives

| # | Piece | Where | Notes |
|---|-------|-------|-------|
| 1 | Login + dashboard source | claude.ai artifact "EdenStardust" https://claude.ai/artifact/YZ99BHuSht2ngm1KEFZfg5 | copied to `src/index.html` |
| 2 | Seat Plan editor source (master) | claude.ai artifact "Seat Plan" https://claude.ai/artifact/8YvWWtMB5YLdyWt5fFQMAp | copied to `src/seatplan.html` |
| 3 | Seat Plan rules and spec | claude.ai artifact "Sitting arrangement" https://claude.ai/artifact/RaEdTRd7AEqCpkKp3uGVVD | read before changing the editor |
| 4 | Website files | this repo, branch `main`, GitHub Pages (root folder), custom domain edenstardust.com, HTTPS enforced | pushing `main` deploys |
| 5 | Users, plan data, files | Supabase project `edenstardust`, ref `ldvzztgzamahlftnbawr`, region Frankfurt | free plan |
| 6 | Domain + DNS | GoDaddy | A @ → 185.199.108–111.153; CNAME www → mob-droid.github.io; Resend records on `send.` and `resend._domainkey` |
| 7 | Google sign-in | Google Cloud project `edenstardust` (owner: the site's support Gmail, see privacy page), app "EdenStardust", in production | client ID/secret are set in Supabase → Auth → Providers → Google |
| 8 | Emails (sign-up confirmation) | Resend, domain edenstardust.com verified, Ireland region | Supabase custom SMTP: smtp.resend.com:465, user `resend`, sender noreply@edenstardust.com |
| 9 | Legal pages | `privacy.html`, `terms.html` (hand-written, in this repo) | linked from the login box; required by Google |

Only these artifacts belong on the user's Claude for this project. **Never create an artifact per seat plan**: users' plans live only in Supabase.

## 4. The pipeline (how a change reaches the site)

1. Edit the artifact (1 or 2 above). For an artifact not published from this session: `Artifact` action `read` with its URL, edit the saved file, publish back to the **same URL**. Send the link.
2. Wait for the user to say **"update site"**. Never push to `main` before that (pushing `main` deploys). Work-in-progress may go on a `claude/...` branch.
3. On "update site": copy the artifact's current HTML into `src/index.html` (artifact 1, page content only, no doctype wrapper) or `src/seatplan.html` (artifact 2, the full HTML the read returns), run `./build.sh`, commit, push `main`.
4. Wait for GitHub Pages (about 1 minute) and check the live site with `curl` or Playwright before reporting.

`build.py` turns the sources into pages:
- `src/index.html` → `index.html` (adds the HTML wrapper).
- `src/seatplan.html` → `plan.html`: loads Supabase + `js/eden-shim.js` and makes a few exact text swaps (each must match, or the build stops: then update the swap).
- `js/eden-shim.js` (hand-written, not an artifact) gives the editor the same `window.claude.use('db' | 'assets' | 'downloads')` API it has on claude.ai, backed by Supabase. `sample` (Claude reading Excel) returns null on the site, so the editor's built-in reader is used.

## 5. Supabase

- URL `https://ldvzztgzamahlftnbawr.supabase.co`, publishable key `sb_publishable_1BiE8kmut-C1AbXFck3QOA_11tONrHl` (public by design, already in the pages).
- **Management API access for Claude:** a Supabase access token named `claude` is saved as a network secret for `api.supabase.com` on the user's Default cloud environment (the proxy injects it; you never see it). Run SQL with `POST https://api.supabase.com/v1/projects/ldvzztgzamahlftnbawr/database/query` and body `{"query": "..."}`. It expires about 11 Dec 2026; if calls return 401, ask the user for a new token (`request_credential`, host `api.supabase.com`).
- Never put the secret/service-role key in the site or in this repo. If a test needs it, fetch it into the scratchpad, use it, then delete it.

| # | Table / bucket | Holds | Who can access (RLS) |
|---|----------------|-------|----------------------|
| 1 | `plans` | one row per seat plan: `owner`, `title`, `thumb` (storage path of the plan picture), `seats`, `updated_at` | owner only |
| 2 | `plan_docs` | the editor's data, one row per doc: `plan_id`, `col`, `doc_id`, `data` (jsonb). Collections as in the spec: names, teams, need, moves, deleted, gone, added, assign, meta, layouts, plan (doc `current` = the layout), flags, pseat | owner of the plan |
| 3 | storage bucket `plan-files` (private, 20 MB max) | uploaded floor plans and plan pictures, path `<user id>/<plan id>/<file>` | owner's folder only; shown through signed links |
| 4 | `logins` | one row per sign-in (email, method, time) | insert own; read: master + shared viewers |
| 5 | `entry_viewers` | emails the master shared the Entries list with | master manages; viewers read their own row |

- **Master account:** the email in `MASTER` in `src/index.html`. It sees the Entries list (people, first and last entry) and can share it from the share icon.
- **Auth settings:** Site URL `https://edenstardust.com`; email sign-up with **Confirm email ON**. Never turn it off: the master check relies on confirmed emails.

## 6. Privacy rules set by the user

1. The user's personal Gmail must never appear in commits, files or pages. Commits here use `noreply@anthropic.com`.
2. The user's other repo (`MoB-droid/1`) is private; only this repo is public.
3. Never paste secrets in chat; use the secure credential form.

## 7. Known gaps (backlog)

1. Image floor plans (JPG/PNG) and PDFs where no desks are found cannot be processed on the website (on claude.ai, Claude did it). Needs a server-side step.
2. Excel upload uses the built-in reader only; Claude-assisted reading would need a paid AI key in a Supabase Edge Function.
3. The user's older Seat Plan artifacts on claude.ai were not migrated to Supabase.
4. Supabase free plan pauses after a week without activity; move to Pro when real users arrive.
