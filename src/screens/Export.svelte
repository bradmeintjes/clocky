<script lang="ts">
  import { liveQuery } from 'dexie'
  import { db } from '../lib/db'
  import Icon from '../lib/Icon.svelte'
  import TopBar from '../lib/TopBar.svelte'
  import Switch from '../lib/ui/Switch.svelte'
  import Swatch from '../lib/ui/Swatch.svelte'
  import { projects, tags } from '../lib/queries'
  import { weekStartDay } from '../lib/settings.svelte'
  import { DAY, formatHM } from '../lib/time'
  import { periodFor, type PeriodKind } from '../lib/export/period'
  import { buildTimesheet } from '../lib/export/timesheet'
  import { toCsv } from '../lib/export/csv'
  import { saveBlob } from '../lib/export/download'
  import { downloadXlsx } from '../lib/export/xlsx'
  import { ui } from '../lib/ui-state.svelte'

  const kinds: { kind: PeriodKind; label: string }[] = [
    { kind: 'this-month', label: 'This month' },
    { kind: 'last-month', label: 'Last month' },
    { kind: 'this-week', label: 'This week' },
    { kind: 'last-week', label: 'Last week' },
    { kind: 'custom', label: 'Custom' },
  ]

  let kind = $state<PeriodKind>('this-month')
  const initial = periodFor('this-month')
  let customFrom = $state(initial.from)
  let customTo = $state(initial.to)
  let selected = $state<string[]>([])
  let byTag = $state(false)
  let busy = $state(false)

  const period = $derived(periodFor(kind, { weekStart: weekStartDay(), from: customFrom, to: customTo }))

  // Entries are filtered by their own zone's date, so fetch a day either side.
  const rangeStart = $derived(new Date(period.from + 'T00:00').getTime() - DAY)
  const rangeEnd = $derived(new Date(period.to + 'T00:00').getTime() + 2 * DAY)
  const entries = $derived(
    liveQuery(() => db.entries.where('start').between(rangeStart, rangeEnd, true, false).toArray()),
  )
  const attachments = liveQuery(() => db.attachments.toArray())

  const projectChoices = $derived(($projects ?? []).filter((p) => !p.archived || selected.includes(p.id)))

  const ts = $derived(
    buildTimesheet({
      period,
      entries: $entries ?? [],
      projects: $projects ?? [],
      tags: $tags ?? [],
      attachments: $attachments ?? [],
      projectIds: selected,
    }),
  )
  const grid = $derived(byTag ? ts.byTag : ts.byProject)
  const daysWorked = $derived(ts.byProject.days.filter((d) => d.total > 0).length)

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
  }

  const dayName = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function csv() {
    saveBlob(new Blob([toCsv(ts.rows)], { type: 'text/csv;charset=utf-8' }), `clocky-${period.slug}.csv`)
  }

  async function xlsx() {
    busy = true
    try {
      await downloadXlsx(ts, { byTag }, `clocky-${period.slug}.xlsx`)
    } catch (err) {
      console.error(err)
      ui.showToast("Couldn't create the Excel file")
    } finally {
      busy = false
    }
  }
</script>

<TopBar><h1>Export</h1></TopBar>

<div class="section">
  <h3>Period</h3>
  <div class="seg" role="radiogroup" aria-label="Period">
    {#each kinds as k (k.kind)}
      <button role="radio" aria-checked={kind === k.kind} class:on={kind === k.kind} onclick={() => (kind = k.kind)}>
        {k.label}
      </button>
    {/each}
  </div>
  {#if kind === 'custom'}
    <div class="range">
      <div class="field">
        <label for="ex-from">From</label>
        <input id="ex-from" class="input" type="date" bind:value={customFrom} />
      </div>
      <div class="field">
        <label for="ex-to">To</label>
        <input id="ex-to" class="input" type="date" bind:value={customTo} />
      </div>
    </div>
  {/if}
</div>

{#if projectChoices.length > 1}
  <div class="section">
    <div class="row-between">
      <h3>Projects</h3>
      {#if selected.length}
        <button class="btn ghost sm" onclick={() => (selected = [])}>All projects</button>
      {/if}
    </div>
    <div class="pchips">
      {#each projectChoices as p (p.id)}
        <button class="pchip" aria-pressed={selected.includes(p.id)} onclick={() => toggle(p.id)}>
          <span class="dot" style:background={p.color}></span>{p.name}
        </button>
      {/each}
    </div>
    {#if !selected.length}<p class="small muted hint">All projects are included. Tap to pick some.</p>{/if}
  </div>
{/if}

<div class="section">
  <div class="summary">
    <div>
      <div class="lbl">{period.label}</div>
      <div class="big mono">{formatHM(ts.byProject.total)}</div>
    </div>
    <div class="facts small muted">
      <span>{ts.rows.length} entr{ts.rows.length === 1 ? 'y' : 'ies'}</span>
      <span>{daysWorked} day{daysWorked === 1 ? '' : 's'}</span>
    </div>
  </div>

  {#if ts.runningExcluded}
    <div class="notice">
      <Icon name="info" />
      <span>A running timer isn't included. Stop it to add it to the export.</span>
    </div>
  {/if}

  <div class="group">
    <div class="srow">
      <div class="grow">
        <div class="t">Group by tag</div>
        <div class="d">Preview by tag, and add a By tag sheet to the Excel file.</div>
      </div>
      <Switch bind:checked={byTag} label="Group by tag" />
    </div>
  </div>
</div>

<div class="section">
  <h3>Preview</h3>
  {#if ts.rows.length === 0}
    <div class="empty">
      <h2>Nothing to export</h2>
      <p class="muted">No finished entries in this period.</p>
    </div>
  {:else}
    <div class="tablewrap">
      <table class="mono">
        <thead>
          <tr>
            <th class="day">Day</th>
            {#each grid.columns as c (c.key)}
              <th>
                <span class="colname">
                  {#if c.color}<Swatch name={c.name} color={c.color} size={16} />{/if}{c.name}
                </span>
              </th>
            {/each}
            <th class="tot">Total</th>
          </tr>
        </thead>
        <tbody>
          {#each grid.days as d (d.date)}
            <tr>
              <th class="day">{dayName(d.date)}</th>
              {#each d.cells as v, i (i)}
                <td>{v ? formatHM(v) : ''}</td>
              {/each}
              <td class="tot">{d.total ? formatHM(d.total) : ''}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <th class="day">Total</th>
            {#each grid.totals as v, i (i)}
              <td>{formatHM(v)}</td>
            {/each}
            <td class="tot">{formatHM(grid.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    {#if byTag}
      <p class="small muted">An entry with more than one tag counts under each tag, so the columns can add up to more than the total.</p>
    {/if}
  {/if}
</div>

<div class="section actions">
  <button class="btn" disabled={!ts.rows.length} onclick={csv}><Icon name="export" /> Download CSV</button>
  <button class="btn primary" disabled={!ts.rows.length || busy} onclick={xlsx}>
    <Icon name="export" />
    {busy ? 'Preparing…' : 'Download Excel'}
  </button>
</div>
<p class="small muted foot">CSV has one row per entry. Excel adds a timesheet of days by projects.</p>

<style>
  .seg {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 -16px;
    padding: 0 16px;
  }

  .seg button,
  .pchip {
    flex: none;
    height: 36px;
    padding: 0 14px;
    border-radius: 18px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-2);
    font-weight: 500;
    white-space: nowrap;
  }

  .seg button.on {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--bg);
  }

  .range {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .pchips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pchip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .pchip[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--ink);
  }

  .pchip .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .hint,
  .foot {
    margin: 0;
  }

  .foot {
    margin-top: 8px;
    text-align: center;
  }

  .summary {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-l);
  }

  .summary .big {
    font-size: 2rem;
    font-weight: 600;
    line-height: 1.1;
    margin-top: 4px;
  }

  .facts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .empty p {
    margin: 0;
  }

  .tablewrap {
    overflow-x: auto;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-m);
  }

  table {
    border-collapse: collapse;
    min-width: 100%;
    font-size: 0.8125rem;
  }

  th,
  td {
    padding: 8px 10px;
    text-align: right;
    white-space: nowrap;
    border-top: 1px solid var(--line);
  }

  thead th {
    border-top: 0;
    font-family: var(--f-body);
    font-weight: 600;
    color: var(--ink-2);
  }

  .colname {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  th.day {
    position: sticky;
    left: 0;
    text-align: left;
    background: var(--surface);
    font-family: var(--f-body);
    font-weight: 500;
  }

  .tot {
    font-weight: 600;
  }

  tfoot th,
  tfoot td {
    font-weight: 700;
    border-top: 2px solid var(--line);
  }

  .actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
  }

  .actions .btn {
    padding: 0 10px;
  }
</style>
