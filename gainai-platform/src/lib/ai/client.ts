import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIGenerationOptions {
  maxTokens?: number
  temperature?: number
}

export interface AIGenerationResult {
  content: string
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create an Anthropic client instance.
 * Reads `ANTHROPIC_API_KEY` from the environment.
 */
export function createAIClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your environment variables.'
    )
  }
  return new Anthropic({ apiKey })
}

// ---------------------------------------------------------------------------
// Content generation helper
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.7

/**
 * Generate content using Claude.
 *
 * @param systemPrompt - The system-level instruction for Claude.
 * @param userPrompt   - The user-level prompt / request.
 * @param options      - Optional overrides for maxTokens and temperature.
 * @returns The generated content, the model used, and token usage stats.
 */
export async function generateContent(
  systemPrompt: string,
  userPrompt: string,
  options: AIGenerationOptions = {}
): Promise<AIGenerationResult> {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
  } = options

  const client = createAIClient()

  try {
    const message = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    // Extract text from the response content blocks
    const textBlocks = message.content.filter(
      (block) => block.type === 'text'
    )
    const content = textBlocks.map((block) => block.text).join('\n')

    return {
      content,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new Error(
        `Claude API error (${error.status}): ${error.message}`
      )
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new Error(
        'Failed to connect to Claude API. Check your network connection.'
      )
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error(
        'Claude API rate limit exceeded. Please try again shortly.'
      )
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error(
        'Claude API authentication failed. Check your ANTHROPIC_API_KEY.'
      )
    }
    throw error
  }
}
