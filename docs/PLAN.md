# Clocky build plan

Clocky is a small, personal time tracker. It does little on purpose: track time against a project and task, attach proof of work, and export a clean timesheet. Export is the main reason it exists, so it gets the most care.

This document is for review before any code is written. Items marked **Decision** are choices I made that you may want to change. Open questions are at the end.

## 1. Scope

**In scope**

- One user, one device. Data is designed so a second device can be added later without a migration.
- Sign in with Google only.
- Projects with a name, a color and an archived flag. Projects are set up before use.
- Time entries against a project, with a free-text task, tags, a description, start and stop times and breaks.
- A live timer (one at a time) with pause and resume for breaks, plus manual entries.
- Links, files and photos added to an entry after a session, up to about 100 MB per file.
- Timesheet export to CSV for any period, defaulting to the current month.
- Works offline. Syncs data and attachments to your Google Drive.

**Out of scope**

- Clients, rates, billing, invoices, teams, approvals, reports beyond the export.
- Task lists or task autocomplete (tasks are free text).
- Servers of any kind. No backend, no database outside your browser and your Drive.
- Encryption of synced data.

## 2. Platform and stack

| Area | Choice | Notes |
|---|---|---|
| App type | Installable PWA | Mobile first, responsive layout on desktop. |
| UI | Svelte 5 + TypeScript | Plain CSS with custom properties, no UI kit. |
| Build | Vite + `vite-plugin-pwa` | Service worker precaches the app shell, so it opens with no network. |
| Local data | Dexie on IndexedDB | All reads and writes go to IndexedDB first. |
| Routing | Hash routes (`#/project/abc`) | GitHub Pages has no SPA fallback, and hash routes avoid 404s on refresh. |
| Excel export | `write-excel-file` | Small, writes real `.xlsx` with several sheets and number formats. Loaded only when you export, so it never slows the app's start. |
| Tests | Vitest for logic, Playwright for a few end-to-end flows | Export maths and sync merge get the most unit tests. |
| Hosting | GitHub Pages, deployed by a GitHub Actions workflow on every push to `main` | **Decision.** Pages is built into GitHub, needs no extra account, and serves at `https://bradmeintjes.github.io/clocky/`. The repo will be public, which free Pages requires. Nothing secret goes in it: the Google OAuth client ID is public by design, and your data lives only in your browser and your Drive. |

Dependencies stay few: `dexie`, `write-excel-file`, `vite-plugin-pwa`, and dev tooling. Anything else needs a reason.

On first launch the app calls `navigator.storage.persist()` so the browser does not evict local data under storage pressure. Settings shows whether persistence was granted and how much space is used.

## 3. Data model

All records use a ULID string `id` (sortable by creation time, safe to create offline) and share sync fields:

```ts
interface Synced {
  id: string;          // ULID
  updatedAt: number;   // ms since epoch, set on every local change
  deleted?: 1;         // tombstone; record is hidden but kept for sync
  dirty?: 1;           // changed locally since the last successful push (local only, never synced)
}
```

### Project

```ts
interface Project extends Synced {
  name: string;
  color: string;       // hex, picked from a fixed palette of about 12 colors
  archived?: 1;        // hidden from pickers and the home list; still exported if it has entries in the period
}
```

### Tag

```ts
interface Tag extends Synced {
  name: string;        // one global list, unique case-insensitively
}
```

Entries store tag ids, so renaming a tag updates every entry. Deleting a tag removes it from entries.

### Entry

```ts
interface Entry extends Synced {
  projectId: string;
  task: string;               // free text, may be empty
  description: string;        // can be written before, during or after the session
  tagIds: string[];
  start: number;              // ms since epoch
  end: number | null;         // null while the timer is running
  breaks: [number, number | null][]; // [start, end] pairs; end null while paused
  tz: string;                 // IANA zone at start, e.g. "Europe/London", so dates in exports never shift
  manual?: 1;                 // created by hand, or any timestamp edited after creation
  attachmentIds: string[];
}
```

- **Worked time** is `(end - start) - sum(breaks)`. Breaks show on the entry (for example "2 breaks, 35 min") but never count towards worked time or the export.
- **One running timer.** At most one entry has `end === null`. Starting a new timer stops the running one first, after asking.
- **Manual flag.** Set when an entry is added by hand, or when start, end or any break time is edited. Editing task, description, tags or attachments does not set it. The flag shows as a small badge and is a column in the export.
- **Dates.** An entry belongs to the local date of its start time in its own `tz`. Entries that cross midnight stay on their start date. Overlaps are not checked, as agreed.

### Attachment

```ts
interface Attachment extends Synced {
  entryId: string;
  kind: 'link' | 'file' | 'photo';
  name: string;              // file name or link title
  url?: string;              // links only
  mime?: string;
  size?: number;             // bytes
  driveFileId?: string;      // set once the file is uploaded to Drive
}
```

The file bytes live in a separate local-only table, `blobs` (keyed by attachment id), so that listing entries never loads file data. Photos also get a small JPEG thumbnail (about 20 KB) stored on the attachment record for fast lists.

### Local-only tables

- `blobs`: attachment bytes, keyed by attachment id.
- `meta`: sync state (last sync time, Drive file ids and their `modifiedTime`), the signed-in account's email, and settings.

### Indexes

`entries` is indexed on `start`, `[projectId+start]` and `end` (to find the running timer fast). That covers the project screen, the export range query and the timer bar.

There is no separate `projectId` index because the compound `[projectId+start]` index already answers "all entries for this project" (Dexie can query a compound index by its first part), and it returns them already sorted by start time, which is what the project screen needs. A second index would only cost storage and write time.

### Keeping storage compact

- Timestamps are integers, ids are 26-character strings, booleans are omitted when false.
- Synced files are gzipped with the browser's built-in `CompressionStream`.
- Attachment bytes on entries older than a set period (a setting, default 3 months) are dropped from the device, but only once they are safely on Drive. The thumbnail and the record stay, and the full file downloads again when you open it.
- Photos are kept at their original resolution.
- Tombstones older than 90 days are purged after a successful sync.

## 4. Sign-in and sync

### Sign-in

- Google Identity Services, token flow, running entirely in the browser. The only scope requested is `drive.appdata` (a hidden app folder in your Drive that only Clocky can see), plus your email for display.
- You sign in once on first launch. After that the app works fully offline. Access tokens last an hour, and the app quietly asks for a fresh one when it next needs to sync and is online. If Google needs you to confirm, a "Sign in again to sync" banner appears; tracking keeps working meanwhile.
- **Setup you will need to do once:** create a Google Cloud project, turn on the Drive API, and create an OAuth web client ID with `https://bradmeintjes.github.io` as an allowed origin. I will write exact steps in the README. The app can stay in "Testing" mode with you as the only test user, so Google verification is not needed.

### What goes to Drive

All files go in `appDataFolder`:

| File | Contents |
|---|---|
| `projects.json.gz` | All projects, including tombstones. |
| `tags.json.gz` | All tags. |
| `entries-YYYY-MM.json.gz` | Entries whose start falls in that month, one file per month. |
| `attachments.json.gz` | Attachment records (metadata only). |
| `att-<attachmentId>` | The bytes of each file or photo, one Drive file each. |

Splitting entries by month keeps each sync small: a normal day only touches the current month's file.

### Sync algorithm

Sync runs on app start, after changes (debounced by about 10 seconds), when the device comes back online, and from a **Sync now** button in Settings.

1. **Pull.** List files in `appDataFolder` with their `modifiedTime`. For each file that changed since the last sync, download it and merge each record into IndexedDB: the copy with the higher `updatedAt` wins. Tombstones merge the same way.
2. **Push.** Group dirty records by the file they belong in. For each such file, merge with the remote copy just pulled, upload the result, then clear `dirty` on the records that were sent.
3. **Attachments.** Upload any attachment without a `driveFileId` using Drive's resumable upload, so a 100 MB file survives a dropped connection. Uploads run one at a time in the background and show progress on the entry.

With one device, merges never actually conflict. The per-record `updatedAt` and tombstones are what make a second device safe later: the same merge rule already handles two writers, and moving to a hybrid logical clock would only be needed if device clocks drift badly.

Sync stays out of the main views. Its status (last synced time, pending changes, uploads in progress, errors) and the **Sync now** button live in Settings. The only time sync shows elsewhere is the "Sign in again to sync" banner, when Google needs you to confirm.

### Backup

Settings also has "Download backup" (one JSON file of all data, without attachment bytes) and "Restore from backup", in case Drive is ever unavailable.

## 5. Screens

Bottom navigation on mobile, a left sidebar on desktop. Three tabs: **Projects**, **Export**, **Settings**. A **timer bar** sits above the navigation on every screen while a timer runs.

### Projects (home)

- List of active projects, each with its color, this week's total and a Start button.
- Tapping a project opens the project screen.
- Archived projects sit behind a "Show archived" toggle.
- First launch with no projects shows a short prompt to create one.

### Project screen

- Header with the project name and color, and a large **Start timer** button.
- Entries in reverse time order, grouped under **date separators** ("Today", "Yesterday", "Mon 24 Nov"), each separator showing that day's worked total.
- Each entry row shows the task, the start and end times, worked duration, tags, a break count, a manual badge and an attachment count.
- A **+** button adds a manual entry.

### Timer bar

- Project color, task and a running clock of worked time (breaks excluded).
- **Pause** starts a break, **Resume** ends it, **Stop** ends the entry.
- Tapping the bar opens the entry so you can fill in the task, description and tags while it runs.

### Start timer sheet

Pick the project (preset when started from a project), and optionally type a task, description and tags. All fields can be filled in later. Starting takes one tap.

### Entry editor (also used for manual entries)

- Project, task, description, tags (with autocomplete from the global list, and "Create tag 'x'" when there is no match).
- Date, start time, end time, and the list of breaks, each editable. Changing any time sets the manual flag.
- Attachments section: add a link, pick files, or take a photo (`<input capture>` opens the camera on phones).
- Delete entry, with an undo toast.

### After a session

When you stop a timer, the entry editor opens straight onto the description and attachments, so adding proof of work is one step. It can be dismissed.

### Long-running timer nudge

The nudge is measured from the **latest start or resume**, not from when the entry began. So a day with a lunch break only nudges after the threshold of unbroken work since lunch. The threshold is a setting, default 8 hours.

- **When you come back to the app** (open it, switch back to it, or open the running entry) and the threshold has passed, Clocky asks "Still working?" with an end time field, prefilled with the last start or resume time plus the threshold. You can set the real end time and stop, or dismiss the prompt and keep going, so working longer than 8 hours is still possible. Dismissing it keeps it quiet until the next start or resume.
- **While the app is open or in the background**, a system notification is shown too, if you allow notifications. A web app with no server can't wake itself up when closed, which is why the prompt on return is the main mechanism.
- Setting the end time from the prompt counts as a timestamp edit, so the entry is flagged manual.

### Export

Described in section 6.

### Settings

- Projects: create, rename, change color, archive or unarchive.
- Tags: rename, merge two tags, delete.
- Account, sync status, **Sync now**, Sign out.
- Preferences: week start (default Monday) and the nudge threshold (default 8 hours).
- Storage: space used, persistence status, and how long attachments stay on the device (default 3 months).
- Backup and restore.

## 6. Export

The export tab has a period picker (This month by default, plus Last month, This week, Last week and Custom range), a project filter (all by default), a "Group by tag" switch, a preview of the totals table, and two buttons: **Download CSV** and **Download Excel**. Each produces a single file named for the period, for example `clocky-2026-11.csv` or `clocky-2026-11.xlsx`.

### CSV: entries only

One row per entry, the detail behind the totals:

```csv
Date,Project,Task,Description,Tags,Start,End,Breaks,Worked,Manual,Links,Attachments
2026-11-03,Website,Header redesign,"Reworked nav, fixed mobile menu",design; frontend,09:02,12:47,0:15,3:30,No,https://...,2
```

### Excel: totals and entries

One `.xlsx` workbook with these sheets:

1. **Timesheet** — totals per project per day. One row per day in the period, one column per project, a **Day total** column at the end (the daily subtotals), and a **Total** row at the bottom (project totals and the period total). Days with no time are included as empty rows, so the sheet reads like a calendar.

   | Date | Website | Mobile app | Day total |
   |---|---|---|---|
   | 2026-11-03 | 3:30 | 1:15 | 4:45 |
   | 2026-11-04 | | 6:00 | 6:00 |
   | … | | | |
   | **Total** | **42:15** | **61:00** | **103:15** |

2. **By tag** — included only when "Group by tag" is on. Same layout, with one column per tag plus an **Untagged** column. An entry with two tags counts under both, so tag columns can add up to more than the day total; a note at the top of the sheet says so.

3. **Entries** — the same rows as the CSV.

Durations are real Excel time values formatted as `[h]:mm`, so they show as hours and minutes and still add up correctly if you sum them yourself. Totals are written as values, not formulas.

### Formatting rules

- Durations in hours and minutes (`3:30`), with no rounding: exact minutes.
- Dates as `YYYY-MM-DD`, times as 24-hour `HH:MM` in the entry's own time zone.
- CSV is UTF-8 with a byte order mark, so Excel shows accents correctly, and uses proper quoting. Cells starting with `=`, `+`, `-` or `@` get a leading apostrophe so a spreadsheet never runs them as formulas.
- A running timer is excluded from the export, and the screen says so.
- Archived projects still appear if they have time in the period.

The totals logic is pure TypeScript with thorough unit tests, including breaks, midnight crossing, time zone changes and empty periods. CSV and Excel share it, so they always agree.

## 7. Milestones

Each milestone ends with a pull request you can review, and the app deployed to GitHub Pages so you can try it on your phone.

| # | Milestone | What you can do at the end |
|---|---|---|
| M0 | Scaffold | Open an empty, installable Clocky at the Pages URL. CI runs type checks, unit tests and a build on every PR. |
| M1 | Projects and tags | Create, color and archive projects; manage tags. Data persists locally. |
| M2 | Timer and entries | Start, pause, resume and stop a timer; see entries under date separators; add and edit manual entries with the manual flag. |
| M3 | Export | Download the entries CSV or the Excel timesheet for any period. The app is useful for real work from here, local only. |
| M4 | Attachments | Add links, files and photos to entries, stored locally. |
| M5 | Google sign-in and sync | Sign in with Google; data and attachments sync to Drive; backup and restore. |
| M6 | Polish | Long-running timer nudge and notification, storage settings, offline and install checks, accessibility pass. |

Export comes before sync because it is the main pain point, and it lets you start using Clocky locally while sync is being built. Sign-in arrives in M5, so until then the app opens without a login.

## 8. Decisions from review

- **Export:** CSV holds entries only; Excel holds the timesheet, daily subtotals, optional tag sheet and entries. No zips.
- **Durations:** hours and minutes, no rounding.
- **Attachments:** dropped from the device for entries older than a set period (default 3 months), once on Drive. Photos stay at original resolution.
- **Week start:** Monday by default, changeable in Settings.
- **Nudge:** a setting, default 8 hours, measured from the latest start or resume.
- **Sync:** status and Sync now live in Settings only.
- **Google Cloud setup:** you will create the project and OAuth client from the README's steps.

## 9. Open questions

1. **UI toolkit.** Plain CSS, Bits UI (headless, styled with our own CSS), or shadcn-svelte (Bits UI with Tailwind)? I recommend shadcn-svelte; options are in the PR thread.
