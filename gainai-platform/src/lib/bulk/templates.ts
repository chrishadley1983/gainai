// ---------------------------------------------------------------------------
// Template CSV generators for bulk import
//
// Each function returns a CSV string (including headers) that users can
// download, fill in, and re-upload for bulk import.
// ---------------------------------------------------------------------------

/**
 * Generate a CSV template for client import.
 */
export function getClientTemplate(): string {
  const headers = [
    'name',
    'slug',
    'contact_name',
    'contact_email',
    'contact_phone',
    'industry',
    'website',
    'package',
    'monthly_fee',
    'status',
    'notes',
    'tags',
  ]

  const exampleRow = [
    'Acme Corp',
    'acme-corp',
    'John Smith',
    'john@acme.com',
    '+61 400 000 000',
    'Technology',
    'https://acme.com',
    'GROWTH',
    '499',
    'ONBOARDING',
    'New client signed via referral',
    'referral,priority',
  ]

  return [headers.join(','), exampleRow.join(',')].join('\n')
}

/**
 * Generate a CSV template for location import.
 */
export function getLocationTemplate(): string {
  const headers = [
    'client_id',
    'name',
    'address',
    'phone',
    'website',
    'primary_category',
    'latitude',
    'longitude',
    'timezone',
    'status',
  ]

  const exampleRow = [
    '<client-uuid>',
    'Acme Corp - Sydney CBD',
    '"123 George St, Sydney NSW 2000, Australia"',
    '+61 2 9000 0000',
    'https://acme.com/sydney',
    'Technology Company',
    '-33.8688',
    '151.2093',
    'Australia/Sydney',
    'PENDING_VERIFICATION',
  ]

  return [headers.join(','), exampleRow.join(',')].join('\n')
}

/**
 * Generate a CSV template for post import.
 */
export function getPostTemplate(): string {
  const headers = [
    'client_id',
    'location_id',
    'content_type',
    'title',
    'body',
    'status',
    'scheduled_for',
    'call_to_action_type',
    'call_to_action_url',
  ]

  const exampleRow = [
    '<client-uuid>',
    '<location-uuid>',
    'STANDARD',
    'Grand Opening Weekend',
    '"Join us this weekend for special offers and giveaways!"',
    'DRAFT',
    '2026-03-01T09:00:00Z',
    'LEARN_MORE',
    'https://acme.com/grand-opening',
  ]

  return [headers.join(','), exampleRow.join(',')].join('\n')
}

/**
 * Generate a CSV template for media import.
 */
export function getMediaTemplate(): string {
  const headers = [
    'client_id',
    'location_id',
    'url',
    'category',
    'mime_type',
    'file_name',
    'description',
  ]

  const exampleRow = [
    '<client-uuid>',
    '<location-uuid>',
    'https://storage.example.com/photos/storefront.jpg',
    'ADDITIONAL',
    'image/jpeg',
    'storefront.jpg',
    'Front view of our Sydney location',
  ]

  return [headers.join(','), exampleRow.join(',')].join('\n')
}

/**
 * Generate a CSV template for competitor import.
 */
export function getCompetitorTemplate(): string {
  const headers = [
    'client_id',
    'name',
    'place_id',
    'website',
    'address',
    'primary_category',
    'notes',
  ]

  const exampleRow = [
    '<client-uuid>',
    'Competitor Inc',
    'ChIJ...',
    'https://competitor.com',
    '"456 Pitt St, Sydney NSW 2000, Australia"',
    'Technology Company',
    'Main competitor in the Sydney CBD area',
  ]

  return [headers.join(','), exampleRow.join(',')].join('\n')
}
