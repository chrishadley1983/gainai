import { createAdminClient } from '@/lib/supabase/admin'
import { generateContent } from './client'
import { auditNarrativePrompt } from './prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditNarrativeResult {
  auditId: string
  narrative: string
  model: string
}

export interface AuditCategoryScore {
  category: string
  score: number
  maxScore: number
  checks: AuditCheck[]
}

export interface AuditCheck {
  name: string
  passed: boolean
  score: number
  maxScore: number
  details?: string
}

export interface AuditRecommendation {
  priority: 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
}

export interface FullAuditResult {
  auditId: string
  locationId: string
  overallScore: number
  maxScore: number
  letterGrade: string
  categories: AuditCategoryScore[]
  recommendations: AuditRecommendation[]
  narrative: string
}

// ---------------------------------------------------------------------------
// Generate narrative for an existing audit
// ---------------------------------------------------------------------------

/**
 * Generate a plain-English narrative for an existing audit record.
 *
 * Fetches audit data from the database and uses Claude to write a
 * readable explanation of the scores and recommendations.
 */
export async function generateAuditNarrative(
  auditId: string
): Promise<AuditNarrativeResult> {
  const supabase = createAdminClient()

  // --- Fetch audit with location + client data ---
  const { data: audit, error: auditError } = await supabase
    .from('gbp_audits')
    .select(`
      id,
      overall_score,
      scores,
      recommendations,
      location_id,
      gbp_locations!inner (
        id,
        name,
        client_id,
        clients!inner (
          id,
          name
        )
      )
    `)
    .eq('id', auditId)
    .single()

  if (auditError || !audit) {
    throw new Error(
      `Audit not found: ${auditError?.message || 'Unknown error'}`
    )
  }

  const locationData = audit.gbp_locations as unknown as {
    id: string
    name: string
    client_id: string
    clients: { id: string; name: string }
  }

  const businessName = locationData.clients.name

  // --- Generate with Claude ---
  const { systemPrompt, userPrompt } = auditNarrativePrompt({
    businessName,
    overallScore: audit.overall_score || 'N/A',
    scoresJson: JSON.stringify(audit.scores, null, 2),
  })

  const aiResult = await generateContent(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.5,
  })

  return {
    auditId,
    narrative: aiResult.content,
    model: aiResult.model,
  }
}

// ---------------------------------------------------------------------------
// Run a full profile audit
// ---------------------------------------------------------------------------

/**
 * Run a complete GBP profile audit for a location.
 *
 * Checks all audit criteria, calculates scores per category,
 * determines the overall letter grade, generates recommendations,
 * saves to gbp_audits, and generates an AI narrative.
 */
export async function runFullAudit(
  locationId: string
): Promise<FullAuditResult> {
  const supabase = createAdminClient()

  // --- Fetch location with all related data ---
  const { data: location, error: locationError } = await supabase
    .from('gbp_locations')
    .select(`
      id,
      client_id,
      name,
      address,
      phone,
      website,
      primary_category,
      additional_categories,
      status,
      metadata,
      clients!inner (
        id,
        name
      )
    `)
    .eq('id', locationId)
    .single()

  if (locationError || !location) {
    throw new Error(
      `Location not found: ${locationError?.message || 'Unknown error'}`
    )
  }

  const clientData = location.clients as unknown as {
    id: string
    name: string
  }

  const metadata = (location.metadata || {}) as Record<string, unknown>

  // --- Fetch related data for audit ---
  const [
    { data: photos },
    { data: recentPosts },
    { data: monthPosts },
    { data: reviews },
    { data: respondedReviews },
  ] = await Promise.all([
    supabase
      .from('media')
      .select('id, media_type, category')
      .eq('location_id', locationId),
    supabase
      .from('posts')
      .select('id, published_at')
      .eq('location_id', locationId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1),
    supabase
      .from('posts')
      .select('id')
      .eq('location_id', locationId)
      .eq('status', 'published')
      .gte('published_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('reviews')
      .select('id, star_rating, response_status, reviewed_at, response_published_at')
      .eq('location_id', locationId),
    supabase
      .from('reviews')
      .select('id')
      .eq('location_id', locationId)
      .in('response_status', ['published', 'approved']),
  ])

  // --- Run audit checks ---
  const categories: AuditCategoryScore[] = []
  const recommendations: AuditRecommendation[] = []

  // ---- 1. Business Information ----
  const businessInfoChecks: AuditCheck[] = []

  // Business name accuracy (pass/fail = 10 points)
  const hasName = !!location.name && location.name.trim().length > 0
  businessInfoChecks.push({
    name: 'Business name set',
    passed: hasName,
    score: hasName ? 10 : 0,
    maxScore: 10,
  })
  if (!hasName) {
    recommendations.push({
      priority: 'high',
      category: 'Business Information',
      title: 'Add business name',
      description: 'Your Google Business Profile needs a business name. This is essential for customers to find you.',
      effort: 'low',
      impact: 'high',
    })
  }

  // Address completeness (pass/fail = 10 points)
  const addressData = location.address as Record<string, unknown> | null
  const hasAddress = !!addressData && (
    !!(addressData.address_lines || addressData.addressLines) ||
    !!(addressData.line1 || addressData.address_line1)
  )
  businessInfoChecks.push({
    name: 'Address completeness',
    passed: hasAddress,
    score: hasAddress ? 10 : 0,
    maxScore: 10,
  })
  if (!hasAddress) {
    recommendations.push({
      priority: 'high',
      category: 'Business Information',
      title: 'Complete your address',
      description: 'A complete and accurate address helps customers find your physical location and improves local search rankings.',
      effort: 'low',
      impact: 'high',
    })
  }

  // Phone number (pass/fail = 10 points)
  const hasPhone = !!location.phone && location.phone.trim().length > 0
  businessInfoChecks.push({
    name: 'Phone number present',
    passed: hasPhone,
    score: hasPhone ? 10 : 0,
    maxScore: 10,
  })
  if (!hasPhone) {
    recommendations.push({
      priority: 'high',
      category: 'Business Information',
      title: 'Add phone number',
      description: 'Adding a phone number makes it easy for customers to contact you directly from Google Search and Maps.',
      effort: 'low',
      impact: 'high',
    })
  }

  // Website URL (pass/fail = 10 points)
  const hasWebsite = !!location.website && location.website.trim().length > 0
  businessInfoChecks.push({
    name: 'Website URL set',
    passed: hasWebsite,
    score: hasWebsite ? 10 : 0,
    maxScore: 10,
  })
  if (!hasWebsite) {
    recommendations.push({
      priority: 'medium',
      category: 'Business Information',
      title: 'Add website URL',
      description: 'Linking your website drives traffic from your Google profile to your site.',
      effort: 'low',
      impact: 'medium',
    })
  }

  // Business hours (pass/fail = 10 points)
  const hasHours = !!(metadata.regular_hours || metadata.regularHours || metadata.hours_set)
  businessInfoChecks.push({
    name: 'Business hours set',
    passed: hasHours,
    score: hasHours ? 10 : 0,
    maxScore: 10,
  })
  if (!hasHours) {
    recommendations.push({
      priority: 'high',
      category: 'Business Information',
      title: 'Set business hours',
      description: 'Business hours help customers know when you are open and reduce frustrating wasted trips.',
      effort: 'low',
      impact: 'high',
    })
  }

  // Holiday hours (/5 points)
  const hasHolidayHours = !!(metadata.special_hours || metadata.specialHours || metadata.holiday_hours_set)
  businessInfoChecks.push({
    name: 'Holiday hours set',
    passed: hasHolidayHours,
    score: hasHolidayHours ? 5 : 0,
    maxScore: 5,
  })

  // Business description present & >250 chars (/10 points)
  const description = (metadata.description as string) || ''
  const hasDescription = description.length > 0
  const descriptionLongEnough = description.length >= 250
  const descScore = descriptionLongEnough ? 10 : hasDescription ? 5 : 0
  businessInfoChecks.push({
    name: 'Business description (250+ chars)',
    passed: descriptionLongEnough,
    score: descScore,
    maxScore: 10,
    details: hasDescription
      ? `Description is ${description.length} characters${descriptionLongEnough ? '' : ' (aim for 250+)'}`
      : 'No description set',
  })
  if (!descriptionLongEnough) {
    recommendations.push({
      priority: 'medium',
      category: 'Business Information',
      title: 'Improve business description',
      description: hasDescription
        ? `Your description is ${description.length} characters. Aim for at least 250 characters to give customers a thorough understanding of your business.`
        : 'Add a detailed business description (250+ characters) to help customers understand what you offer.',
      effort: 'low',
      impact: 'medium',
    })
  }

  categories.push({
    category: 'Business Information',
    score: businessInfoChecks.reduce((sum, c) => sum + c.score, 0),
    maxScore: businessInfoChecks.reduce((sum, c) => sum + c.maxScore, 0),
    checks: businessInfoChecks,
  })

  // ---- 2. Categories ----
  const categoryChecks: AuditCheck[] = []

  const hasPrimaryCategory = !!location.primary_category && location.primary_category.trim().length > 0
  categoryChecks.push({
    name: 'Primary category set',
    passed: hasPrimaryCategory,
    score: hasPrimaryCategory ? 10 : 0,
    maxScore: 10,
  })
  if (!hasPrimaryCategory) {
    recommendations.push({
      priority: 'high',
      category: 'Categories',
      title: 'Set primary category',
      description: 'Your primary category is one of the biggest ranking factors for local search.',
      effort: 'low',
      impact: 'high',
    })
  }

  const additionalCats = location.additional_categories || []
  const hasAdditionalCategories = additionalCats.length >= 2
  const additionalCatScore = Math.min(additionalCats.length, 2) * 2.5
  categoryChecks.push({
    name: 'Additional categories (2+)',
    passed: hasAdditionalCategories,
    score: additionalCatScore,
    maxScore: 5,
    details: `${additionalCats.length} additional categor${additionalCats.length === 1 ? 'y' : 'ies'} set`,
  })

  categories.push({
    category: 'Categories',
    score: categoryChecks.reduce((sum, c) => sum + c.score, 0),
    maxScore: categoryChecks.reduce((sum, c) => sum + c.maxScore, 0),
    checks: categoryChecks,
  })

  // ---- 3. Photos ----
  const photoChecks: AuditCheck[] = []
  const allPhotos = photos || []
  const totalPhotoCount = allPhotos.length
  const photoScore = Math.min(totalPhotoCount, 16) // Cap at 16 photos for max score
  const photoMaxScore = 15
  const normalizedPhotoScore = Math.round((photoScore / 16) * photoMaxScore)

  photoChecks.push({
    name: 'Photo count (target: 10+ business, 3+ interior, 3+ exterior)',
    passed: totalPhotoCount >= 10,
    score: normalizedPhotoScore,
    maxScore: photoMaxScore,
    details: `${totalPhotoCount} photo${totalPhotoCount === 1 ? '' : 's'} uploaded`,
  })

  if (totalPhotoCount < 10) {
    recommendations.push({
      priority: 'medium',
      category: 'Photos',
      title: 'Upload more photos',
      description: `You have ${totalPhotoCount} photo${totalPhotoCount === 1 ? '' : 's'}. Aim for at least 10 business photos, including interior, exterior, and team shots.`,
      effort: 'medium',
      impact: 'medium',
    })
  }

  categories.push({
    category: 'Photos',
    score: photoChecks.reduce((sum, c) => sum + c.score, 0),
    maxScore: photoChecks.reduce((sum, c) => sum + c.maxScore, 0),
    checks: photoChecks,
  })

  // ---- 4. Posts & Content ----
  const postChecks: AuditCheck[] = []

  // Recent post (within 7 days) /10
  const latestPost = recentPosts?.[0]
  const hasRecentPost = latestPost?.published_at
    ? Date.now() - new Date(latestPost.published_at).getTime() < 7 * 24 * 60 * 60 * 1000
    : false
  postChecks.push({
    name: 'Recent post (within 7 days)',
    passed: hasRecentPost,
    score: hasRecentPost ? 10 : 0,
    maxScore: 10,
    details: latestPost?.published_at
      ? `Last post: ${new Date(latestPost.published_at).toLocaleDateString('en-GB')}`
      : 'No published posts found',
  })
  if (!hasRecentPost) {
    recommendations.push({
      priority: 'high',
      category: 'Posts & Content',
      title: 'Publish a post',
      description: 'Regular Google Business Profile posts keep your listing active and engaging. Aim to post at least weekly.',
      effort: 'low',
      impact: 'high',
    })
  }

  // Post frequency (4+ per month) /10
  const monthPostCount = monthPosts?.length || 0
  const frequencyScore = Math.min(monthPostCount, 4) * 2.5
  postChecks.push({
    name: 'Post frequency (4+ per month)',
    passed: monthPostCount >= 4,
    score: frequencyScore,
    maxScore: 10,
    details: `${monthPostCount} post${monthPostCount === 1 ? '' : 's'} in the last 30 days`,
  })

  categories.push({
    category: 'Posts & Content',
    score: postChecks.reduce((sum, c) => sum + c.score, 0),
    maxScore: postChecks.reduce((sum, c) => sum + c.maxScore, 0),
    checks: postChecks,
  })

  // ---- 5. Reviews ----
  const reviewChecks: AuditCheck[] = []
  const allReviews = reviews || []
  const totalReviewCount = allReviews.length
  const respondedCount = respondedReviews?.length || 0

  // Average review rating /10
  const avgRating =
    totalReviewCount > 0
      ? allReviews.reduce((sum, r) => sum + r.star_rating, 0) / totalReviewCount
      : 0
  const ratingScore = Math.round((Math.min(avgRating, 5) / 5) * 10)
  reviewChecks.push({
    name: 'Average review rating',
    passed: avgRating >= 4.0,
    score: ratingScore,
    maxScore: 10,
    details:
      totalReviewCount > 0
        ? `${avgRating.toFixed(1)} stars from ${totalReviewCount} review${totalReviewCount === 1 ? '' : 's'}`
        : 'No reviews yet',
  })

  // Review count /10
  const reviewCountScore = Math.min(totalReviewCount, 20) * 0.5
  reviewChecks.push({
    name: 'Review count',
    passed: totalReviewCount >= 10,
    score: reviewCountScore,
    maxScore: 10,
    details: `${totalReviewCount} total review${totalReviewCount === 1 ? '' : 's'}`,
  })
  if (totalReviewCount < 10) {
    recommendations.push({
      priority: 'medium',
      category: 'Reviews',
      title: 'Encourage more reviews',
      description: `You have ${totalReviewCount} review${totalReviewCount === 1 ? '' : 's'}. More reviews build trust and improve your local ranking. Consider asking satisfied customers to leave a review.`,
      effort: 'medium',
      impact: 'high',
    })
  }

  // Review response rate (target: 100%) /10
  const responseRate =
    totalReviewCount > 0 ? respondedCount / totalReviewCount : 0
  const responseRateScore = Math.round(responseRate * 10)
  reviewChecks.push({
    name: 'Review response rate (target: 100%)',
    passed: responseRate >= 0.9,
    score: responseRateScore,
    maxScore: 10,
    details: `${Math.round(responseRate * 100)}% response rate (${respondedCount}/${totalReviewCount})`,
  })
  if (responseRate < 0.9) {
    recommendations.push({
      priority: 'high',
      category: 'Reviews',
      title: 'Respond to all reviews',
      description: `Your response rate is ${Math.round(responseRate * 100)}%. Responding to every review shows customers you value their feedback.`,
      effort: 'low',
      impact: 'high',
    })
  }

  // Review response time (/5)
  // Simplified: check if any reviews are pending for >24 hours
  const pendingReviews = allReviews.filter(
    (r) => r.response_status === 'pending'
  )
  const oldPendingReviews = pendingReviews.filter((r) => {
    const reviewAge = Date.now() - new Date(r.reviewed_at).getTime()
    return reviewAge > 24 * 60 * 60 * 1000
  })
  const responseTimeScore = oldPendingReviews.length === 0 ? 5 : Math.max(0, 5 - oldPendingReviews.length)
  reviewChecks.push({
    name: 'Review response time (<24 hours)',
    passed: oldPendingReviews.length === 0,
    score: Math.max(0, responseTimeScore),
    maxScore: 5,
    details:
      oldPendingReviews.length > 0
        ? `${oldPendingReviews.length} review${oldPendingReviews.length === 1 ? '' : 's'} pending for over 24 hours`
        : 'All reviews responded to promptly',
  })

  categories.push({
    category: 'Reviews',
    score: reviewChecks.reduce((sum, c) => sum + c.score, 0),
    maxScore: reviewChecks.reduce((sum, c) => sum + c.maxScore, 0),
    checks: reviewChecks,
  })

  // ---- 6. Extras ----
  const extraChecks: AuditCheck[] = []

  // Attributes completed /5
  const hasAttributes = !!(metadata.attributes_completed || metadata.attributes)
  extraChecks.push({
    name: 'Attributes completed',
    passed: hasAttributes,
    score: hasAttributes ? 5 : 0,
    maxScore: 5,
  })

  // Products/services listed /5
  const hasProducts = !!(metadata.products_listed || metadata.services_listed || metadata.has_products)
  extraChecks.push({
    name: 'Products/services listed',
    passed: hasProducts,
    score: hasProducts ? 5 : 0,
    maxScore: 5,
  })

  categories.push({
    category: 'Extras',
    score: extraChecks.reduce((sum, c) => sum + c.score, 0),
    maxScore: extraChecks.reduce((sum, c) => sum + c.maxScore, 0),
    checks: extraChecks,
  })

  // --- Calculate overall score ---
  const overallScore = categories.reduce((sum, c) => sum + c.score, 0)
  const maxScore = categories.reduce((sum, c) => sum + c.maxScore, 0)
  const percentage = maxScore > 0 ? (overallScore / maxScore) * 100 : 0
  const letterGrade = calculateLetterGrade(percentage)

  // --- Sort recommendations by priority ---
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  // --- Build audit data for storage ---
  const auditData: Record<string, unknown> = {
    location_name: location.name,
    client_name: clientData.name,
    has_name: hasName,
    has_address: hasAddress,
    has_phone: hasPhone,
    has_website: hasWebsite,
    has_hours: hasHours,
    has_holiday_hours: hasHolidayHours,
    description_length: description.length,
    has_primary_category: hasPrimaryCategory,
    additional_category_count: additionalCats.length,
    photo_count: totalPhotoCount,
    has_recent_post: hasRecentPost,
    monthly_post_count: monthPostCount,
    average_rating: avgRating,
    total_review_count: totalReviewCount,
    response_rate: responseRate,
    overdue_responses: oldPendingReviews.length,
    has_attributes: hasAttributes,
    has_products: hasProducts,
  }

  const scoresData = categories.map((c) => ({
    category: c.category,
    score: c.score,
    maxScore: c.maxScore,
    percentage: c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0,
  }))

  // --- Save audit to database ---
  const { data: savedAudit, error: insertError } = await supabase
    .from('gbp_audits')
    .insert({
      location_id: locationId,
      audit_data: auditData,
      overall_score: letterGrade,
      scores: scoresData,
      recommendations,
    })
    .select('id')
    .single()

  if (insertError || !savedAudit) {
    throw new Error(
      `Failed to save audit: ${insertError?.message || 'Unknown error'}`
    )
  }

  // --- Generate AI narrative ---
  const { systemPrompt, userPrompt } = auditNarrativePrompt({
    businessName: clientData.name,
    overallScore: `${letterGrade} (${Math.round(percentage)}%)`,
    scoresJson: JSON.stringify(scoresData, null, 2),
  })

  const aiResult = await generateContent(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.5,
  })

  // --- Log activity ---
  await supabase.from('activity_log').insert({
    client_id: location.client_id,
    location_id: locationId,
    actor_type: 'ai',
    action: 'profile_audit_completed',
    description: `Profile audit completed: ${letterGrade} (${Math.round(percentage)}%) — ${recommendations.length} recommendation${recommendations.length === 1 ? '' : 's'}`,
    metadata: {
      audit_id: savedAudit.id,
      overall_score: letterGrade,
      percentage: Math.round(percentage),
      recommendation_count: recommendations.length,
      model: aiResult.model,
    },
  })

  return {
    auditId: savedAudit.id,
    locationId,
    overallScore,
    maxScore,
    letterGrade,
    categories,
    recommendations,
    narrative: aiResult.content,
  }
}

// ---------------------------------------------------------------------------
// Grade calculation
// ---------------------------------------------------------------------------

function calculateLetterGrade(percentage: number): string {
  if (percentage >= 97) return 'A+'
  if (percentage >= 93) return 'A'
  if (percentage >= 90) return 'A-'
  if (percentage >= 87) return 'B+'
  if (percentage >= 83) return 'B'
  if (percentage >= 80) return 'B-'
  if (percentage >= 77) return 'C+'
  if (percentage >= 73) return 'C'
  if (percentage >= 70) return 'C-'
  if (percentage >= 67) return 'D+'
  if (percentage >= 63) return 'D'
  if (percentage >= 60) return 'D-'
  return 'F'
}
