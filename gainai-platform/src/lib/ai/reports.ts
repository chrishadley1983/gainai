import {
  generateMonthlyReport as _generateMonthlyReport,
  generateReportSummary,
} from './report-summariser'
import type {
  MonthlyReportResult,
  ReportSummaryResult,
  MonthlyReportData,
} from './report-summariser'

/**
 * Wrapper that accepts a single options object (as the API route expects).
 */
export async function generateMonthlyReport(options: {
  clientId: string
  month: number
  year: number
}): Promise<MonthlyReportResult> {
  return _generateMonthlyReport(options.clientId, options.month, options.year)
}

export { generateReportSummary }
export type { MonthlyReportResult, ReportSummaryResult, MonthlyReportData }
