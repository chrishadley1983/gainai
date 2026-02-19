import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditCheck {
  id: string
  category: AuditCategory
  label: string
  description: string
  passed: boolean
  weight: number
  details?: string
}

export type AuditCategory =
  | 'BASIC_INFO'
  | 'PHOTOS'
  | 'REVIEWS'
  | 'POSTS'
  | 'ATTRIBUTES'
  | 'ENGAGEMENT'

export interface AuditResult {
  locationId: string
  checks: AuditCheck[]
  runAt: string
}

// ---------------------------------------------------------------------------
// runAuditChecks – run all audit criteria against a location
// ---------------------------------------------------------------------------

/**
 * Run a comprehensive profile audit against a GBP location.
 *
 * Evaluates completeness and best-practice criteria across multiple
 * categories, returning a checklist of pass/fail checks with weights.
 *
 * @param locationId - The internal location ID.
 */
export async function runAuditChecks(locationId: string): Promise<AuditResult> {
  const supabase = createAdminClient()

  // Fetch the location and related data in parallel
  const [locationResult, postsResult, reviewsResult, mediaResult] =
    await Promise.all([
      supabase
        .from('gbp_locations')
        .select('*')
        .eq('id', locationId)
        .single(),
      supabase
        .from('posts')
        .select('id, status, published_at, content_type')
        .eq('location_id', locationId)
        .order('published_at', { ascending: false })
        .limit(30),
      supabase
        .from('reviews')
        .select('id, star_rating, response_status, comment, reviewed_at')
        .eq('location_id', locationId)
        .order('reviewed_at', { ascending: false })
        .limit(100),
      supabase
        .from('media')
        .select('id, category, url')
        .eq('location_id', locationId),
    ])

  if (locationResult.error || !locationResult.data) {
    throw new Error(
      `Location ${locationId} not found: ${locationResult.error?.message ?? 'no data'}`
    )
  }

  const location = locationResult.data
  const posts = postsResult.data ?? []
  const reviews = reviewsResult.data ?? []
  const media = mediaResult.data ?? []

  const checks: AuditCheck[] = []

  // -------------------------------------------------------------------------
  // BASIC_INFO checks
  // -------------------------------------------------------------------------

  checks.push({
    id: 'basic_name',
    category: 'BASIC_INFO',
    label: 'Business name set',
    description: 'The location has a business name configured.',
    passed: !!location.name?.trim(),
    weight: 10,
  })

  checks.push({
    id: 'basic_address',
    category: 'BASIC_INFO',
    label: 'Address set',
    description: 'The location has a physical address configured.',
    passed: !!location.address?.trim(),
    weight: 10,
  })

  checks.push({
    id: 'basic_phone',
    category: 'BASIC_INFO',
    label: 'Phone number set',
    description: 'The location has a phone number configured.',
    passed: !!location.phone?.trim(),
    weight: 8,
  })

  checks.push({
    id: 'basic_website',
    category: 'BASIC_INFO',
    label: 'Website set',
    description: 'The location has a website URL configured.',
    passed: !!location.website?.trim(),
    weight: 8,
  })

  checks.push({
    id: 'basic_category',
    category: 'BASIC_INFO',
    label: 'Primary category set',
    description: 'The location has a primary business category.',
    passed: !!location.primary_category?.trim(),
    weight: 10,
  })

  checks.push({
    id: 'basic_description',
    category: 'BASIC_INFO',
    label: 'Business description set',
    description: 'The location has a business description.',
    passed: !!location.description?.trim(),
    weight: 7,
    details: location.description
      ? `Description length: ${location.description.length} characters`
      : 'No description set',
  })

  // -------------------------------------------------------------------------
  // PHOTOS checks
  // -------------------------------------------------------------------------

  const coverPhotos = media.filter(
    (m: Record<string, unknown>) => m.category === 'COVER'
  )
  const profilePhotos = media.filter(
    (m: Record<string, unknown>) => m.category === 'PROFILE'
  )
  const additionalPhotos = media.filter(
    (m: Record<string, unknown>) => m.category === 'ADDITIONAL'
  )

  checks.push({
    id: 'photos_cover',
    category: 'PHOTOS',
    label: 'Cover photo uploaded',
    description: 'A cover photo is set for the listing.',
    passed: coverPhotos.length > 0,
    weight: 8,
  })

  checks.push({
    id: 'photos_profile',
    category: 'PHOTOS',
    label: 'Profile photo uploaded',
    description: 'A profile/logo photo is set for the listing.',
    passed: profilePhotos.length > 0,
    weight: 8,
  })

  checks.push({
    id: 'photos_minimum',
    category: 'PHOTOS',
    label: 'At least 5 additional photos',
    description: 'Having multiple photos improves listing engagement.',
    passed: additionalPhotos.length >= 5,
    weight: 6,
    details: `${additionalPhotos.length} additional photo(s) uploaded`,
  })

  // -------------------------------------------------------------------------
  // REVIEWS checks
  // -------------------------------------------------------------------------

  const totalReviews = reviews.length
  const avgRating =
    totalReviews > 0
      ? reviews.reduce(
          (sum: number, r: Record<string, unknown>) =>
            sum + (r.star_rating as number),
          0
        ) / totalReviews
      : 0

  const respondedReviews = reviews.filter(
    (r: Record<string, unknown>) =>
      r.response_status === 'PUBLISHED' || r.response_status === 'APPROVED'
  )
  const responseRate =
    totalReviews > 0 ? (respondedReviews.length / totalReviews) * 100 : 0

  checks.push({
    id: 'reviews_count',
    category: 'REVIEWS',
    label: 'At least 10 reviews',
    description: 'A minimum review count helps build trust.',
    passed: totalReviews >= 10,
    weight: 7,
    details: `${totalReviews} review(s)`,
  })

  checks.push({
    id: 'reviews_rating',
    category: 'REVIEWS',
    label: 'Average rating 4.0+',
    description: 'Maintaining a strong average rating is important for visibility.',
    passed: avgRating >= 4.0,
    weight: 8,
    details: `Average rating: ${avgRating.toFixed(1)}`,
  })

  checks.push({
    id: 'reviews_response_rate',
    category: 'REVIEWS',
    label: 'Review response rate 80%+',
    description: 'Responding to reviews shows engagement with customers.',
    passed: responseRate >= 80,
    weight: 8,
    details: `Response rate: ${responseRate.toFixed(0)}%`,
  })

  // -------------------------------------------------------------------------
  // POSTS checks
  // -------------------------------------------------------------------------

  const publishedPosts = posts.filter(
    (p: Record<string, unknown>) => p.status === 'PUBLISHED'
  )

  // Check if there are posts in the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentPosts = publishedPosts.filter(
    (p: Record<string, unknown>) =>
      p.published_at && new Date(p.published_at as string) >= sevenDaysAgo
  )

  // Check if there are posts in the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const monthlyPosts = publishedPosts.filter(
    (p: Record<string, unknown>) =>
      p.published_at && new Date(p.published_at as string) >= thirtyDaysAgo
  )

  checks.push({
    id: 'posts_recent',
    category: 'POSTS',
    label: 'Post in the last 7 days',
    description: 'Regular posting signals an active business.',
    passed: recentPosts.length > 0,
    weight: 7,
    details: `${recentPosts.length} post(s) in the last 7 days`,
  })

  checks.push({
    id: 'posts_monthly',
    category: 'POSTS',
    label: 'At least 4 posts in the last 30 days',
    description: 'Weekly posting cadence is recommended.',
    passed: monthlyPosts.length >= 4,
    weight: 6,
    details: `${monthlyPosts.length} post(s) in the last 30 days`,
  })

  checks.push({
    id: 'posts_variety',
    category: 'POSTS',
    label: 'Multiple content types used',
    description: 'Using different post types (offers, events, updates) improves engagement.',
    passed:
      new Set(
        monthlyPosts.map((p: Record<string, unknown>) => p.content_type)
      ).size >= 2,
    weight: 4,
  })

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    locationId,
    checks,
    runAt: new Date().toISOString(),
  }
}
