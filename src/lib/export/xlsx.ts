// Excel workbook: Timesheet (days x projects), optional By tag, and Entries.
// Durations are real Excel time values formatted [h]:mm, so they add up if summed by hand.
import type { Cell, Row, Sheet, SheetData } from 'write-excel-file/browser'
// Text goes in as string cells, which Excel never evaluates, so no formula defusing is needed here.
import { CSV_HEADER } from './csv'
import type { Grid, Timesheet } from './timesheet'

const DAY_MS = 86_400_000
const DURATION = '[h]:mm'
const DATE = 'yyyy-mm-dd'

const bold = (value: string): Cell => ({ value, fontWeight: 'bold' })
const dur = (ms: number, extra: Record<string, unknown> = {}): Cell =>
  ms ? { value: ms / DAY_MS, type: Number, format: DURATION, ...extra } : extra.fontWeight ? { value: '', ...extra } : null
const date = (key: string): Cell => {
  const [y, m, d] = key.split('-').map(Number)
  return { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: DATE }
}

function gridSheet(g: Grid, name: string, note?: string): Sheet<never> {
  const data: SheetData = []
  if (note) data.push([{ value: note, fontStyle: 'italic' }], [])
  data.push([bold('Date'), ...g.columns.map((c) => bold(c.name)), bold('Day total')])
  for (const d of g.days) data.push([date(d.date), ...d.cells.map((ms) => dur(ms)), dur(d.total, { fontWeight: 'bold' })])
  data.push([
    bold('Total'),
    ...g.totals.map((ms) => dur(ms, { fontWeight: 'bold' })),
    dur(g.total, { fontWeight: 'bold' }),
  ])
  return {
    sheet: name,
    data,
    columns: [{ width: 12 }, ...g.columns.map(() => ({ width: 14 })), { width: 11 }],
    stickyRowsCount: note ? 3 : 1,
  }
}

export function workbookSheets(ts: Timesheet, opts: { byTag: boolean }): Sheet<never>[] {
  const sheets = [gridSheet(ts.byProject, 'Timesheet')]
  if (opts.byTag) {
    sheets.push(
      gridSheet(
        ts.byTag,
        'By tag',
        'An entry with more than one tag counts under each of its tags, so tag columns can add up to more than the day total.',
      ),
    )
  }
  const entries: Row[] = [CSV_HEADER.map(bold)]
  for (const r of ts.rows) {
    entries.push([
      date(r.date),
      r.project,
      r.task,
      r.description,
      r.tags.join('; '),
      r.start,
      r.end,
      dur(r.breakMs),
      dur(r.workedMs),
      r.manual ? 'Yes' : 'No',
      r.links.join(' '),
      r.attachments,
    ])
  }
  sheets.push({
    sheet: 'Entries',
    data: entries,
    columns: [{ width: 12 }, { width: 20 }, { width: 28 }, { width: 48 }, { width: 20 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 40 }, { width: 11 }],
    stickyRowsCount: 1,
  })
  return sheets
}

export async function downloadXlsx(ts: Timesheet, opts: { byTag: boolean }, fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(workbookSheets(ts, opts) as Sheet<Blob>[]).toFile(fileName)
}
