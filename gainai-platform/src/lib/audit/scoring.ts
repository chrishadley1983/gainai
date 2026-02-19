import type { AuditCheck, AuditCategory } from './runner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryScore {
  category: AuditCategory
  score: number
  maxScore: number
  percentage: number
  passed: number
  total: number
}

export interface AuditScore {
  overallScore: number
  overallMaxScore: number
  overallPercentage: number
  letterGrade: string
  categories: CategoryScore[]
}

export type LetterGrade =
  | 'A+'
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D+'
  | 'D'
  | 'D-'
  | 'F'

// ---------------------------------------------------------------------------
// getLetterGrade – map a percentage score to a letter grade
// ---------------------------------------------------------------------------

/**
 * Convert a numerical percentage score (0-100) to a letter grade.
 *
 * @param score - The percentage score (0 to 100).
 * @returns A letter grade from A+ to F.
 */
export function getLetterGrade(score: number): LetterGrade {
  if (score >= 97) return 'A+'
  if (score >= 93) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 87) return 'B+'
  if (score >= 83) return 'B'
  if (score >= 80) return 'B-'
  if (score >= 77) return 'C+'
  if (score >= 73) return 'C'
  if (score >= 70) return 'C-'
  if (score >= 67) return 'D+'
  if (score >= 63) return 'D'
  if (score >= 60) return 'D-'
  return 'F'
}

// ---------------------------------------------------------------------------
// calculateAuditScore – compute overall and category scores from checks
// ---------------------------------------------------------------------------

/**
 * Calculate audit scores from a list of audit checks.
 *
 * Groups checks by category, computes weighted scores for each, and produces
 * an overall letter grade.
 *
 * @param checks - Array of audit check results from `runAuditChecks`.
 * @returns An AuditScore with overall and per-category breakdowns.
 */
export function calculateAuditScore(checks: AuditCheck[]): AuditScore {
  // Group checks by category
  const categoryMap = new Map<AuditCategory, AuditCheck[]>()

  for (const check of checks) {
    const existing = categoryMap.get(check.category) ?? []
    existing.push(check)
    categoryMap.set(check.category, existing)
  }

  // Calculate per-category scores
  const categories: CategoryScore[] = []

  // Ensure consistent ordering
  const categoryOrder: AuditCategory[] = [
    'BASIC_INFO',
    'PHOTOS',
    'REVIEWS',
    'POSTS',
    'ATTRIBUTES',
    'ENGAGEMENT',
  ]

  for (const category of categoryOrder) {
    const categoryChecks = categoryMap.get(category)
    if (!categoryChecks || categoryChecks.length === 0) continue

    const maxScore = categoryChecks.reduce((sum, c) => sum + c.weight, 0)
    const score = categoryChecks
      .filter((c) => c.passed)
      .reduce((sum, c) => sum + c.weight, 0)
    const passed = categoryChecks.filter((c) => c.passed).length
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

    categories.push({
      category,
      score,
      maxScore,
      percentage,
      passed,
      total: categoryChecks.length,
    })
  }

  // Calculate overall score
  const overallMaxScore = checks.reduce((sum, c) => sum + c.weight, 0)
  const overallScore = checks
    .filter((c) => c.passed)
    .reduce((sum, c) => sum + c.weight, 0)
  const overallPercentage =
    overallMaxScore > 0 ? Math.round((overallScore / overallMaxScore) * 100) : 0
  const letterGrade = getLetterGrade(overallPercentage)

  return {
    overallScore,
    overallMaxScore,
    overallPercentage,
    letterGrade,
    categories,
  }
}
