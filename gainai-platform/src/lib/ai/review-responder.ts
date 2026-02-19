import { createAdminClient } from '@/lib/supabase/admin'
import { generateContent } from './client'
import { reviewResponsePrompt } from './prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftResponseResult {
  reviewId: string
  response: string
  model: string
  responseStatus: string
}

export interface ProcessedReview {
  reviewId: string
  starRating: number
  action: 'template_response' | 'ai_draft_auto_publish' | 'ai_draft_team_review' | 'ai_draft_urgent'
  response: string
  published: boolean
  error?: string
}

export interface ProcessNewReviewsResult {
  locationId: string
  totalProcessed: number
  results: ProcessedReview[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBrandVoice(brandVoice: unknown): string {
  if (brandVoice && typeof brandVoice === 'object') {
    const bv = brandVoice as Record<string, unknown>
    return (bv.description as string) || 'Friendly and professional'
  }
  return 'Friendly and professional'
}

function getTemplateResponse(reviewerName: string, businessName: string): string {
  const templates = [
    `Thank you so much for the 5-star review, ${reviewerName}! We really appreciate your support and look forward to seeing you again at ${businessName}.`,
    `Thanks for the wonderful review, ${reviewerName}! It means a lot to the team at ${businessName}. We hope to welcome you back soon.`,
    `We're thrilled you had a great experience, ${reviewerName}! Thank you for taking the time to leave us a review. See you again soon at ${businessName}.`,
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

// ---------------------------------------------------------------------------
// Draft a review response for a single review
// ---------------------------------------------------------------------------

/**
 * Generate an AI draft response for a single review.
 *
 * Fetches the review and its client's brand voice from the database,
 * generates a response via Claude, and saves the draft.
 */
export async function draftReviewResponse(
  reviewId: string
): Promise<DraftResponseResult> {
  const supabase = createAdminClient()

  // --- Fetch review with client data ---
  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .select(`
      id,
      star_rating,
      reviewer_name,
      comment,
      response_status,
      client_id,
      location_id,
      clients!inner (
        id,
        name,
        brand_voice
      )
    `)
    .eq('id', reviewId)
    .single()

  if (reviewError || !review) {
    throw new Error(
      `Review not found: ${reviewError?.message || 'Unknown error'}`
    )
  }

  const clientData = review.clients as unknown as {
    id: string
    name: string
    brand_voice: unknown
  }

  const reviewComment = review.comment || 'No comment provided.'

  // --- Generate AI response ---
  const { systemPrompt, userPrompt } = reviewResponsePrompt({
    businessName: clientData.name,
    brandVoice: parseBrandVoice(clientData.brand_voice),
    starRating: review.star_rating,
    reviewerName: review.reviewer_name || 'Customer',
    reviewComment,
  })

  const aiResult = await generateContent(systemPrompt, userPrompt, {
    maxTokens: 1024,
    temperature: 0.6,
  })

  // --- Save draft to review record ---
  const { error: updateError } = await supabase
    .from('reviews')
    .update({
      ai_draft_response: aiResult.content,
      response_status: 'draft_ready',
    })
    .eq('id', reviewId)

  if (updateError) {
    throw new Error(
      `Failed to save AI draft response: ${updateError.message}`
    )
  }

  // --- Log activity ---
  await supabase.from('activity_log').insert({
    client_id: review.client_id,
    location_id: review.location_id,
    actor_type: 'ai',
    action: 'review_response_drafted',
    description: `AI drafted response for ${review.star_rating}-star review from ${review.reviewer_name || 'Customer'}`,
    metadata: {
      review_id: reviewId,
      star_rating: review.star_rating,
      model: aiResult.model,
      usage: aiResult.usage,
    },
  })

  return {
    reviewId,
    response: aiResult.content,
    model: aiResult.model,
    responseStatus: 'draft_ready',
  }
}

// ---------------------------------------------------------------------------
// Process all pending reviews for a location
// ---------------------------------------------------------------------------

/**
 * Process all unresponded reviews for a given location.
 *
 * Applies the auto-response rules:
 * - 5-star, no comment: use template response
 * - 5-star with comment: AI draft, auto-publish if client setting allows
 * - 4-star: AI draft, queue for team review
 * - 1-3 star: AI draft, flag as urgent
 *
 * All actions are logged to activity_log.
 */
export async function processNewReviews(
  locationId: string
): Promise<ProcessNewReviewsResult> {
  const supabase = createAdminClient()

  // --- Fetch location and client data ---
  const { data: location, error: locationError } = await supabase
    .from('gbp_locations')
    .select(`
      id,
      client_id,
      name,
      clients!inner (
        id,
        name,
        brand_voice,
        settings
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
    brand_voice: unknown
    settings: Record<string, unknown> | null
  }

  const clientSettings = clientData.settings || {}
  const autoPublish5Star = clientSettings.auto_publish_5_star === true

  // --- Fetch unresponded reviews ---
  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('id, star_rating, reviewer_name, comment, response_status')
    .eq('location_id', locationId)
    .eq('response_status', 'pending')
    .order('reviewed_at', { ascending: true })

  if (reviewsError) {
    throw new Error(
      `Failed to fetch reviews: ${reviewsError.message}`
    )
  }

  if (!reviews || reviews.length === 0) {
    return {
      locationId,
      totalProcessed: 0,
      results: [],
    }
  }

  const results: ProcessedReview[] = []

  for (const review of reviews) {
    try {
      const result = await processReview(
        supabase,
        review,
        clientData,
        locationId,
        autoPublish5Star
      )
      results.push(result)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      results.push({
        reviewId: review.id,
        starRating: review.star_rating,
        action: 'ai_draft_team_review',
        response: '',
        published: false,
        error: errorMessage,
      })
    }

    // Brief pause between reviews to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return {
    locationId,
    totalProcessed: results.length,
    results,
  }
}

// ---------------------------------------------------------------------------
// Process a single review (internal helper)
// ---------------------------------------------------------------------------

async function processReview(
  supabase: ReturnType<typeof createAdminClient>,
  review: {
    id: string
    star_rating: number
    reviewer_name: string | null
    comment: string | null
    response_status: string
  },
  clientData: {
    id: string
    name: string
    brand_voice: unknown
  },
  locationId: string,
  autoPublish5Star: boolean
): Promise<ProcessedReview> {
  const reviewerName = review.reviewer_name || 'Customer'

  // ---- 5-star, no comment: template response ----
  if (review.star_rating === 5 && (!review.comment || review.comment.trim() === '')) {
    const templateResponse = getTemplateResponse(reviewerName, clientData.name)

    await supabase
      .from('reviews')
      .update({
        ai_draft_response: templateResponse,
        response_status: autoPublish5Star ? 'approved' : 'draft_ready',
      })
      .eq('id', review.id)

    await logReviewAction(supabase, {
      clientId: clientData.id,
      locationId,
      reviewId: review.id,
      action: 'template_response_generated',
      description: `Template response generated for 5-star review (no comment) from ${reviewerName}`,
      starRating: review.star_rating,
      autoPublished: autoPublish5Star,
    })

    return {
      reviewId: review.id,
      starRating: review.star_rating,
      action: 'template_response',
      response: templateResponse,
      published: autoPublish5Star,
    }
  }

  // ---- 5-star with comment: AI draft, auto-publish if allowed ----
  if (review.star_rating === 5) {
    const { systemPrompt, userPrompt } = reviewResponsePrompt({
      businessName: clientData.name,
      brandVoice: parseBrandVoice(clientData.brand_voice),
      starRating: review.star_rating,
      reviewerName,
      reviewComment: review.comment || '',
    })

    const aiResult = await generateContent(systemPrompt, userPrompt, {
      maxTokens: 1024,
      temperature: 0.6,
    })

    const newStatus = autoPublish5Star ? 'approved' : 'draft_ready'

    await supabase
      .from('reviews')
      .update({
        ai_draft_response: aiResult.content,
        response_status: newStatus,
      })
      .eq('id', review.id)

    await logReviewAction(supabase, {
      clientId: clientData.id,
      locationId,
      reviewId: review.id,
      action: autoPublish5Star
        ? 'ai_draft_auto_approved'
        : 'ai_draft_generated',
      description: `AI drafted response for 5-star review from ${reviewerName}${autoPublish5Star ? ' (auto-approved)' : ''}`,
      starRating: review.star_rating,
      autoPublished: autoPublish5Star,
      model: aiResult.model,
    })

    return {
      reviewId: review.id,
      starRating: review.star_rating,
      action: 'ai_draft_auto_publish',
      response: aiResult.content,
      published: autoPublish5Star,
    }
  }

  // ---- 4-star: AI draft, queue for team review ----
  if (review.star_rating === 4) {
    const { systemPrompt, userPrompt } = reviewResponsePrompt({
      businessName: clientData.name,
      brandVoice: parseBrandVoice(clientData.brand_voice),
      starRating: review.star_rating,
      reviewerName,
      reviewComment: review.comment || '',
    })

    const aiResult = await generateContent(systemPrompt, userPrompt, {
      maxTokens: 1024,
      temperature: 0.6,
    })

    await supabase
      .from('reviews')
      .update({
        ai_draft_response: aiResult.content,
        response_status: 'draft_ready',
      })
      .eq('id', review.id)

    await logReviewAction(supabase, {
      clientId: clientData.id,
      locationId,
      reviewId: review.id,
      action: 'ai_draft_team_review',
      description: `AI drafted response for 4-star review from ${reviewerName} — queued for team review`,
      starRating: review.star_rating,
      autoPublished: false,
      model: aiResult.model,
    })

    return {
      reviewId: review.id,
      starRating: review.star_rating,
      action: 'ai_draft_team_review',
      response: aiResult.content,
      published: false,
    }
  }

  // ---- 1-3 star: AI draft, flag as urgent ----
  const { systemPrompt, userPrompt } = reviewResponsePrompt({
    businessName: clientData.name,
    brandVoice: parseBrandVoice(clientData.brand_voice),
    starRating: review.star_rating,
    reviewerName,
    reviewComment: review.comment || '',
  })

  const aiResult = await generateContent(systemPrompt, userPrompt, {
    maxTokens: 1024,
    temperature: 0.5, // Lower temperature for sensitive responses
  })

  await supabase
    .from('reviews')
    .update({
      ai_draft_response: aiResult.content,
      response_status: 'draft_ready',
      flagged: true,
      flag_reason: `Negative review (${review.star_rating} star${review.star_rating === 1 ? '' : 's'}) — requires team review before publishing`,
    })
    .eq('id', review.id)

  await logReviewAction(supabase, {
    clientId: clientData.id,
    locationId,
    reviewId: review.id,
    action: 'ai_draft_urgent_flagged',
    description: `AI drafted response for ${review.star_rating}-star review from ${reviewerName} — FLAGGED AS URGENT`,
    starRating: review.star_rating,
    autoPublished: false,
    model: aiResult.model,
  })

  return {
    reviewId: review.id,
    starRating: review.star_rating,
    action: 'ai_draft_urgent',
    response: aiResult.content,
    published: false,
  }
}

// ---------------------------------------------------------------------------
// Activity log helper
// ---------------------------------------------------------------------------

async function logReviewAction(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    clientId: string
    locationId: string
    reviewId: string
    action: string
    description: string
    starRating: number
    autoPublished: boolean
    model?: string
  }
): Promise<void> {
  await supabase.from('activity_log').insert({
    client_id: params.clientId,
    location_id: params.locationId,
    actor_type: 'ai',
    action: params.action,
    description: params.description,
    metadata: {
      review_id: params.reviewId,
      star_rating: params.starRating,
      auto_published: params.autoPublished,
      ...(params.model ? { model: params.model } : {}),
    },
  })
}
