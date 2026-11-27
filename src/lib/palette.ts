// Fixed project colours (from the mockup). Saturated enough to read on light and dark.
export const PALETTE = [
  { name: 'Red', color: '#E5484D' },
  { name: 'Orange', color: '#F76B15' },
  { name: 'Amber', color: '#E8A400' },
  { name: 'Lime', color: '#7CB518' },
  { name: 'Green', color: '#30A46C' },
  { name: 'Teal', color: '#12A594' },
  { name: 'Sky', color: '#0091E6' },
  { name: 'Indigo', color: '#3E63DD' },
  { name: 'Purple', color: '#8E4EC6' },
  { name: 'Pink', color: '#D6409F' },
  { name: 'Brown', color: '#A07553' },
  { name: 'Slate', color: '#697386' },
] as const

export const DEFAULT_COLOR = '#0091E6'

/** Pick the first palette colour not used yet, so new projects look distinct. */
export function nextColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()))
  return PALETTE.find((p) => !taken.has(p.color.toUpperCase()))?.color ?? DEFAULT_COLOR
}
