// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

type Row = Record<string, string>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireField(
  row: Row,
  field: string,
  errors: string[]
): boolean {
  const value = row[field]?.trim()
  if (!value) {
    errors.push(`"${field}" is required`)
    return false
  }
  return true
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validateUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function validatePhone(value: string): boolean {
  // Accept digits, spaces, hyphens, parentheses, and leading +
  return /^\+?[\d\s\-().]{7,20}$/.test(value)
}

// ---------------------------------------------------------------------------
// validateClientImport
// ---------------------------------------------------------------------------

/**
 * Validate a single row for client import.
 *
 * Required fields: name, slug
 * Optional validated: contact_email, website, contact_phone, package, status
 */
export function validateClientImport(row: Row): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  requireField(row, 'name', errors)
  requireField(row, 'slug', errors)

  // Slug format
  if (row.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug.trim())) {
    errors.push('"slug" must be lowercase alphanumeric with hyphens only')
  }

  // Optional email validation
  if (row.contact_email?.trim() && !validateEmail(row.contact_email.trim())) {
    errors.push('"contact_email" is not a valid email address')
  }

  // Optional phone validation
  if (row.contact_phone?.trim() && !validatePhone(row.contact_phone.trim())) {
    warnings.push('"contact_phone" may not be a valid phone number')
  }

  // Optional website validation
  if (row.website?.trim() && !validateUrl(row.website.trim())) {
    warnings.push('"website" does not appear to be a valid URL')
  }

  // Package validation
  const validPackages = ['STARTER', 'GROWTH', 'PREMIUM', 'ENTERPRISE']
  if (row.package?.trim() && !validPackages.includes(row.package.trim().toUpperCase())) {
    errors.push(`"package" must be one of: ${validPackages.join(', ')}`)
  }

  // Status validation
  const validStatuses = ['ACTIVE', 'PAUSED', 'CHURNED', 'ONBOARDING']
  if (row.status?.trim() && !validStatuses.includes(row.status.trim().toUpperCase())) {
    errors.push(`"status" must be one of: ${validStatuses.join(', ')}`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// validateLocationImport
// ---------------------------------------------------------------------------

/**
 * Validate a single row for location import.
 *
 * Required fields: client_id, name, address
 */
export function validateLocationImport(row: Row): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  requireField(row, 'client_id', errors)
  requireField(row, 'name', errors)
  requireField(row, 'address', errors)

  // Optional phone
  if (row.phone?.trim() && !validatePhone(row.phone.trim())) {
    warnings.push('"phone" may not be a valid phone number')
  }

  // Optional website
  if (row.website?.trim() && !validateUrl(row.website.trim())) {
    warnings.push('"website" does not appear to be a valid URL')
  }

  // Status validation
  const validStatuses = ['ACTIVE', 'SUSPENDED', 'DISCONNECTED', 'PENDING_VERIFICATION']
  if (row.status?.trim() && !validStatuses.includes(row.status.trim().toUpperCase())) {
    errors.push(`"status" must be one of: ${validStatuses.join(', ')}`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// validatePostImport
// ---------------------------------------------------------------------------

/**
 * Validate a single row for post import.
 *
 * Required fields: client_id, location_id, body, content_type
 */
export function validatePostImport(row: Row): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  requireField(row, 'client_id', errors)
  requireField(row, 'location_id', errors)
  requireField(row, 'body', errors)
  requireField(row, 'content_type', errors)

  // Content type validation
  const validContentTypes = ['STANDARD', 'EVENT', 'OFFER', 'PRODUCT', 'ALERT']
  if (
    row.content_type?.trim() &&
    !validContentTypes.includes(row.content_type.trim().toUpperCase())
  ) {
    errors.push(`"content_type" must be one of: ${validContentTypes.join(', ')}`)
  }

  // Status validation (optional, defaults to DRAFT)
  const validStatuses = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'DELETED']
  if (row.status?.trim() && !validStatuses.includes(row.status.trim().toUpperCase())) {
    errors.push(`"status" must be one of: ${validStatuses.join(', ')}`)
  }

  // Scheduled date validation
  if (row.scheduled_for?.trim()) {
    const date = new Date(row.scheduled_for.trim())
    if (isNaN(date.getTime())) {
      errors.push('"scheduled_for" is not a valid date')
    } else if (date < new Date()) {
      warnings.push('"scheduled_for" is in the past')
    }
  }

  // Body length check
  if (row.body?.trim() && row.body.trim().length > 1500) {
    warnings.push('"body" exceeds 1500 characters; Google may truncate it')
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// validateMediaImport
// ---------------------------------------------------------------------------

/**
 * Validate a single row for media import.
 *
 * Required fields: client_id, location_id, url
 */
export function validateMediaImport(row: Row): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  requireField(row, 'client_id', errors)
  requireField(row, 'location_id', errors)
  requireField(row, 'url', errors)

  // URL validation
  if (row.url?.trim() && !validateUrl(row.url.trim())) {
    errors.push('"url" is not a valid URL')
  }

  // Category validation
  const validCategories = ['COVER', 'PROFILE', 'ADDITIONAL', 'POST']
  if (
    row.category?.trim() &&
    !validCategories.includes(row.category.trim().toUpperCase())
  ) {
    errors.push(`"category" must be one of: ${validCategories.join(', ')}`)
  }

  // Mime type check
  const validMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
  ]
  if (
    row.mime_type?.trim() &&
    !validMimeTypes.includes(row.mime_type.trim().toLowerCase())
  ) {
    warnings.push(`"mime_type" "${row.mime_type}" may not be supported by Google`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// validateCompetitorImport
// ---------------------------------------------------------------------------

/**
 * Validate a single row for competitor import.
 *
 * Required fields: client_id, name
 */
export function validateCompetitorImport(row: Row): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  requireField(row, 'client_id', errors)
  requireField(row, 'name', errors)

  // Optional website
  if (row.website?.trim() && !validateUrl(row.website.trim())) {
    warnings.push('"website" does not appear to be a valid URL')
  }

  // Optional place_id
  if (row.place_id?.trim() && row.place_id.trim().length < 10) {
    warnings.push('"place_id" looks too short to be a valid Google Place ID')
  }

  return { valid: errors.length === 0, errors, warnings }
}
