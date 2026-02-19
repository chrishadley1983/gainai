import { createAdminClient } from '@/lib/supabase/admin'
import { generateContent } from './client'
import { contentCalendarPrompt } from './prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarGenerationOptions {
  month: number
  year: number
  postCount?: number
  contentTypes?: string[]
}

interface GeneratedPost {
  day: number
  content_type: string
  title: string
  body: string
  cta_type: string
  suggested_time: string
}

export interface GeneratedPostRecord {
  id: string
  location_id: string
  client_id: string
  content_type: string
  title: string | null
  body: string
  cta_type: string | null
  scheduled_for: string
  status: string
  ai_generated: boolean
  ai_model: string
}

export interface CalendarGenerationResult {
  clientId: string
  clientName: string
  postsGenerated: number
  posts: GeneratedPostRecord[]
  error?: string
}

export interface BulkCalendarResult {
  totalClients: number
  successCount: number
  failureCount: number
  results: CalendarGenerationResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBrandVoice(brandVoice: unknown): {
  description: string
  tone: string
  avoidWords: string
} {
  if (brandVoice && typeof brandVoice === 'object') {
    const bv = brandVoice as Record<string, unknown>
    return {
      description: (bv.description as string) || 'Friendly and professional',
      tone: (bv.tone as string) || 'conversational',
      avoidWords: (bv.avoid_words as string) || '',
    }
  }
  return {
    description: 'Friendly and professional',
    tone: 'conversational',
    avoidWords: '',
  }
}

function parseAddress(address: unknown): { city: string; county: string } {
  if (address && typeof address === 'object') {
    const addr = address as Record<string, unknown>
    return {
      city: (addr.city as string) || (addr.locality as string) || '',
      county: (addr.county as string) || (addr.administrative_area as string) || '',
    }
  }
  return { city: '', county: '' }
}

function parseCalendarJSON(content: string): GeneratedPost[] {
  // Try to extract JSON array from the response
  // Claude may wrap the JSON in markdown code fences
  let jsonStr = content.trim()

  // Strip markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  // Find the first [ and last ] to extract the array
  const startIdx = jsonStr.indexOf('[')
  const endIdx = jsonStr.lastIndexOf(']')
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    jsonStr = jsonStr.slice(startIdx, endIdx + 1)
  }

  const parsed = JSON.parse(jsonStr)

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of posts from AI response')
  }

  return parsed.map((item: unknown) => {
    const post = item as Record<string, unknown>
    return {
      day: Number(post.day) || 1,
      content_type: (post.content_type as string) || 'whats_new',
      title: (post.title as string) || '',
      body: (post.body as string) || '',
      cta_type: (post.cta_type as string) || 'LEARN_MORE',
      suggested_time: (post.suggested_time as string) || '10:00',
    }
  })
}

// ---------------------------------------------------------------------------
// Generate content calendar for a single client
// ---------------------------------------------------------------------------

/**
 * Generate a full month's content calendar for one client using AI.
 *
 * Fetches the client's data, brand voice, location, and previous posts from
 * the database, generates posts via Claude, and saves them as drafts.
 */
export async function generateContentCalendar(
  clientId: string,
  options: CalendarGenerationOptions
): Promise<CalendarGenerationResult> {
  const { month, year, postCount = 12, contentTypes } = options
  const supabase = createAdminClient()

  // --- Fetch client data ---
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, industry, address, brand_voice, settings')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    throw new Error(`Client not found: ${clientError?.message || 'Unknown error'}`)
  }

  // --- Fetch primary location ---
  const { data: location, error: locationError } = await supabase
    .from('gbp_locations')
    .select('id, name, address, primary_category')
    .eq('client_id', clientId)
    .eq('status', 'verified')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (locationError || !location) {
    throw new Error(
      `No verified location found for client ${client.name}: ${locationError?.message || 'Unknown error'}`
    )
  }

  // --- Fetch previous posts for context ---
  const { data: previousPosts } = await supabase
    .from('posts')
    .select('body')
    .eq('client_id', clientId)
    .in('status', ['published', 'scheduled', 'approved', 'draft'])
    .order('created_at', { ascending: false })
    .limit(10)

  const previousPostBodies = previousPosts?.map((p) => p.body) || []

  // --- Build prompt ---
  const brandVoice = parseBrandVoice(client.brand_voice)
  const clientAddress = parseAddress(client.address || location.address)

  const { systemPrompt, userPrompt } = contentCalendarPrompt({
    businessName: client.name,
    industry: client.industry || 'local business',
    city: clientAddress.city,
    county: clientAddress.county,
    brandVoice: brandVoice.description,
    month,
    year,
    postCount,
    previousPosts: previousPostBodies,
  })

  // --- Generate with Claude ---
  const aiResult = await generateContent(systemPrompt, userPrompt, {
    maxTokens: 8192,
    temperature: 0.8,
  })

  // --- Parse generated posts ---
  let generatedPosts: GeneratedPost[]
  try {
    generatedPosts = parseCalendarJSON(aiResult.content)
  } catch (parseError) {
    throw new Error(
      `Failed to parse AI-generated calendar: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
    )
  }

  // Filter by requested content types if specified
  if (contentTypes && contentTypes.length > 0) {
    generatedPosts = generatedPosts.filter((p) =>
      contentTypes.includes(p.content_type)
    )
  }

  // --- Save posts as drafts ---
  const daysInMonth = new Date(year, month, 0).getDate()

  const postRecords = generatedPosts.map((post) => {
    // Clamp day to valid range
    const day = Math.min(Math.max(post.day, 1), daysInMonth)
    const [hours, minutes] = (post.suggested_time || '10:00').split(':').map(Number)
    const scheduledDate = new Date(year, month - 1, day, hours || 10, minutes || 0)

    return {
      location_id: location.id,
      client_id: clientId,
      content_type: post.content_type || 'whats_new',
      title: post.title || null,
      body: post.body,
      cta_type: post.cta_type || null,
      scheduled_for: scheduledDate.toISOString(),
      status: 'draft',
      ai_generated: true,
      ai_model: aiResult.model,
      ai_prompt: systemPrompt.slice(0, 500), // Store truncated prompt for reference
    }
  })

  const { data: savedPosts, error: insertError } = await supabase
    .from('posts')
    .insert(postRecords)
    .select('id, location_id, client_id, content_type, title, body, cta_type, scheduled_for, status, ai_generated, ai_model')

  if (insertError) {
    throw new Error(`Failed to save generated posts: ${insertError.message}`)
  }

  // --- Log activity ---
  await supabase.from('activity_log').insert({
    client_id: clientId,
    location_id: location.id,
    actor_type: 'ai',
    action: 'content_calendar_generated',
    description: `AI generated ${savedPosts?.length || 0} posts for ${new Date(year, month - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`,
    metadata: {
      month,
      year,
      post_count: savedPosts?.length || 0,
      model: aiResult.model,
      usage: aiResult.usage,
    },
  })

  return {
    clientId,
    clientName: client.name,
    postsGenerated: savedPosts?.length || 0,
    posts: (savedPosts || []) as GeneratedPostRecord[],
  }
}

// ---------------------------------------------------------------------------
// Generate content calendars for multiple clients
// ---------------------------------------------------------------------------

/**
 * Generate content calendars for multiple clients sequentially.
 *
 * Processes one client at a time to stay within API rate limits.
 * Continues processing remaining clients even if one fails.
 */
export async function generateBulkCalendars(
  clientIds: string[],
  options: CalendarGenerationOptions
): Promise<BulkCalendarResult> {
  const results: CalendarGenerationResult[] = []
  let successCount = 0
  let failureCount = 0

  for (const clientId of clientIds) {
    try {
      const result = await generateContentCalendar(clientId, options)
      results.push(result)
      successCount++
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      results.push({
        clientId,
        clientName: 'Unknown',
        postsGenerated: 0,
        posts: [],
        error: errorMessage,
      })
      failureCount++
    }

    // Brief pause between clients to respect rate limits
    if (clientIds.indexOf(clientId) < clientIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return {
    totalClients: clientIds.length,
    successCount,
    failureCount,
    results,
  }
}
