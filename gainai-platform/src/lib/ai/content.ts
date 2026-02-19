import {
  generateContentCalendar as _generateContentCalendar,
  generateBulkCalendars,
} from './post-generator'
import type {
  CalendarGenerationOptions,
  CalendarGenerationResult,
  GeneratedPostRecord,
  BulkCalendarResult,
} from './post-generator'

/**
 * Wrapper that accepts a single options object (as the API route expects).
 */
export async function generateContentCalendar(options: {
  clientId: string
  month: number
  year: number
  postCount?: number
  contentTypes?: string[]
}): Promise<CalendarGenerationResult> {
  const { clientId, ...rest } = options
  return _generateContentCalendar(clientId, rest)
}

export { generateBulkCalendars }
export type {
  CalendarGenerationOptions,
  CalendarGenerationResult,
  GeneratedPostRecord,
  BulkCalendarResult,
}
