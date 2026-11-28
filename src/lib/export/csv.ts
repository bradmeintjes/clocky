import { formatHM } from '../time'
import type { ExportRow } from './timesheet'

export const CSV_HEADER = ['Date', 'Project', 'Task', 'Description', 'Tags', 'Start', 'End', 'Breaks', 'Worked', 'Manual', 'Links', 'Attachments']

/**
 * Quote when needed, and defuse cells a spreadsheet would run as a formula
 * (leading =, +, -, @, or tab/carriage return) with a leading apostrophe.
 */
export function csvCell(value: string | number): string {
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowValues(r: ExportRow): (string | number)[] {
  return [
    r.date,
    r.project,
    r.task,
    r.description,
    r.tags.join('; '),
    r.start,
    r.end,
    formatHM(r.breakMs),
    formatHM(r.workedMs),
    r.manual ? 'Yes' : 'No',
    r.links.join(' '),
    r.attachments,
  ]
}

/** UTF-8 with a byte order mark, so Excel reads accents correctly; CRLF line ends. */
export function toCsv(rows: ExportRow[]): string {
  const lines = [CSV_HEADER, ...rows.map(rowValues)].map((r) => r.map(csvCell).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
