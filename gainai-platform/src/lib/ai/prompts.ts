// ---------------------------------------------------------------------------
// Prompt parameter types
// ---------------------------------------------------------------------------

export interface PostGenerationParams {
  businessName: string
  industry: string
  city: string
  county: string
  brandVoice: string
  tone: string
  avoidWords: string
  contentType: string
  previousPosts?: string[]
}

export interface ContentCalendarParams {
  businessName: string
  industry: string
  city: string
  county: string
  brandVoice: string
  month: number
  year: number
  postCount: number
  previousPosts?: string[]
}

export interface ReviewResponseParams {
  businessName: string
  brandVoice: string
  starRating: number
  reviewerName: string
  reviewComment: string
}

export interface ReportSummaryParams {
  businessName: string
  period: string
  performanceData: string
}

export interface AuditNarrativeParams {
  businessName: string
  overallScore: string
  scoresJson: string
}

export interface PromptPair {
  systemPrompt: string
  userPrompt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatPreviousPosts(posts?: string[]): string {
  if (!posts || posts.length === 0) return ''
  return posts
    .map((p, i) => `${i + 1}. ${p}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Post generation prompt
// ---------------------------------------------------------------------------

export function postGenerationPrompt(params: PostGenerationParams): PromptPair {
  const {
    businessName,
    industry,
    city,
    county,
    brandVoice,
    tone,
    avoidWords,
    contentType,
    previousPosts,
  } = params

  const previousPostsSection = previousPosts && previousPosts.length > 0
    ? `\nHere are recent posts to avoid repetition:\n${formatPreviousPosts(previousPosts)}`
    : ''

  const systemPrompt = `You are a local business content writer for ${businessName}, a ${industry} located in ${city}, ${county}.

Brand voice: ${brandVoice}
Tone: ${tone}
Things to avoid: ${avoidWords}

Write a Google Business Profile post for the "${contentType}" category.
Keep it under 1,500 characters. Include a clear call to action.
Do NOT include phone numbers (Google rejects these).
Make it locally relevant to ${city} and surrounding areas.
${previousPostsSection}`

  const userPrompt = `Write a single ${contentType} Google Business Profile post for ${businessName}. The post should be engaging, locally relevant to ${city}, and match the brand voice described above. Return only the post body text.`

  return { systemPrompt, userPrompt }
}

// ---------------------------------------------------------------------------
// Content calendar prompt
// ---------------------------------------------------------------------------

export function contentCalendarPrompt(params: ContentCalendarParams): PromptPair {
  const {
    businessName,
    industry,
    city,
    county,
    brandVoice,
    month,
    year,
    postCount,
    previousPosts,
  } = params

  const monthName = MONTH_NAMES[month - 1] || 'Unknown'

  const previousPostsSection = previousPosts && previousPosts.length > 0
    ? `\nRecent posts for context (avoid repetition):\n${formatPreviousPosts(previousPosts)}`
    : ''

  const systemPrompt = `You are a local business content strategist for ${businessName}, a ${industry} located in ${city}, ${county}.

Brand voice: ${brandVoice}

You will generate a content calendar of Google Business Profile posts for ${monthName} ${year}.

Guidelines:
- Each post must be under 1,500 characters.
- Include a clear call to action in each post.
- Do NOT include phone numbers in any post (Google rejects these).
- Make posts locally relevant to ${city} and surrounding areas.
- Rotate content types: tips, promotions, engagement, seasonal, behind-the-scenes.
- Consider seasonality and local events for ${monthName} in the UK.
- Each post should feel fresh — avoid repeating themes or phrases.
${previousPostsSection}`

  const userPrompt = `Generate exactly ${postCount} Google Business Profile posts for ${businessName} for ${monthName} ${year}.

For each post, provide the following in this exact JSON format:
[
  {
    "day": 1,
    "content_type": "whats_new",
    "title": "Post title (optional, short)",
    "body": "The full post text under 1,500 characters",
    "cta_type": "LEARN_MORE",
    "suggested_time": "10:00"
  }
]

Valid content_type values: "whats_new", "event", "offer", "product"
Valid cta_type values: "BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"

Spread the ${postCount} posts evenly across the month. Return ONLY the JSON array, no other text.`

  return { systemPrompt, userPrompt }
}

// ---------------------------------------------------------------------------
// Review response prompt
// ---------------------------------------------------------------------------

export function reviewResponsePrompt(params: ReviewResponseParams): PromptPair {
  const {
    businessName,
    brandVoice,
    starRating,
    reviewerName,
    reviewComment,
  } = params

  const systemPrompt = `Respond to this Google review on behalf of ${businessName}.
Respond as the business owner in first person.
Brand voice: ${brandVoice}

Review: ${starRating} stars by ${reviewerName}
"${reviewComment}"

Guidelines:
- Thank reviewer by name
- Reference specific details they mentioned
- For 1-3 stars: acknowledge concern, apologise, offer resolution path (invite to contact directly)
- For 4-5 stars: express gratitude, reinforce what they enjoyed, subtle invite to return
- Keep under 500 characters
- Never be defensive or argumentative
- Never offer discounts or compensation in the response
- Never use the word "sorry" more than once`

  const userPrompt = `Write a response to this ${starRating}-star review from ${reviewerName}. Their comment was: "${reviewComment}". Return only the response text, nothing else.`

  return { systemPrompt, userPrompt }
}

// ---------------------------------------------------------------------------
// Report summary prompt
// ---------------------------------------------------------------------------

export function reportSummaryPrompt(params: ReportSummaryParams): PromptPair {
  const { businessName, period, performanceData } = params

  const systemPrompt = `You are a Google Business Profile performance analyst writing for a UK small business owner.

Write clear, jargon-free summaries that a non-technical person can understand.
Always reference specific numbers from the data.
Use British English throughout.`

  const userPrompt = `Summarise this GBP performance data for ${businessName} (${period}).
Write 3-5 sentences a small business owner would understand.
Highlight: biggest win, area needing attention, one actionable recommendation.
Compare to previous period where data is available.
Mention specific numbers (e.g., "calls up 23% to 47").

Data:
${performanceData}

Return only the summary text.`

  return { systemPrompt, userPrompt }
}

// ---------------------------------------------------------------------------
// Audit narrative prompt
// ---------------------------------------------------------------------------

export function auditNarrativePrompt(params: AuditNarrativeParams): PromptPair {
  const { businessName, overallScore, scoresJson } = params

  const systemPrompt = `You are a Google Business Profile optimisation expert writing for a UK small business owner.

Write clear, friendly assessments in British English.
Assume the reader is a non-technical small business owner.
Be encouraging about what is working well, and practical about what needs improving.
Prioritise recommendations by impact — what will make the biggest difference first.`

  const userPrompt = `Based on this GBP audit data for ${businessName}, write a brief assessment.
Score: ${overallScore}. Category scores: ${scoresJson}.

Write 2-3 paragraphs explaining:
1. What is working well
2. What needs fixing
3. Prioritised next steps

Return only the narrative text.`

  return { systemPrompt, userPrompt }
}
