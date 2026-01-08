/**
 * Script to populate card_abilities table using AI parsing
 *
 * Usage:
 *   npx tsx scripts/populate-card-abilities.ts [--batch-size=10] [--limit=100] [--card-id=xxx]
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const DIFY_API_URL = 'https://dify.andres-wong.com/v1/chat-messages'
const DIFY_API_KEY = 'app-Lk4tKWfemXusS4rpbEG1pWAh'

// Parse command line arguments
const args = process.argv.slice(2)
const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '1')
const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0')
const specificCardId = args.find(arg => arg.startsWith('--card-id='))?.split('=')[1]

// Initialize Supabase client with service role for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface CardData {
  idx: number
  id: string
  name: string
  oracle_text: string | null
  flavor_text: string | null
  type_line: string
  mana_cost: string | null
  cmc: string
  colors: string
  color_identity: string
  keywords: string
  power: string | null
  toughness: string | null
  rarity: string
  source: string
  image_url: string | null
  set_code: string
  set_name: string
  rulings: string
  legalities: string
  created_at: string
  updated_at: string
}

interface DifyResponse {
  event: string
  task_id: string
  id: string
  message_id: string
  conversation_id: string
  mode: string
  answer: string
  metadata: {
    usage: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
      total_price: string
      latency: number
    }
  }
  created_at: number
}

interface ParsedAbility {
  version: string
  cardId: string
  cardName: string
  abilities: any
  parsing_confidence: number
  parsing_notes: string
}

/**
 * Extract JSON from markdown code block
 */
function extractJsonFromMarkdown(markdown: string): any {
  // Remove markdown code block markers
  const jsonMatch = markdown.match(/```json\n([\s\S]*?)\n```/)

  if (jsonMatch && jsonMatch[1]) {
    return JSON.parse(jsonMatch[1])
  }

  // Try parsing directly if no code block
  return JSON.parse(markdown)
}

/**
 * Send card to AI for parsing
 */
async function parseCardWithAI(card: CardData): Promise<ParsedAbility | null> {
  const payload = {
    inputs: {},
    query: JSON.stringify([{
      idx: card.idx || 0,
      id: card.id,
      name: card.name,
      oracle_text: card.oracle_text,
      flavor_text: card.flavor_text,
      type_line: card.type_line,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      colors: card.colors,
      color_identity: card.color_identity,
      keywords: card.keywords,
      power: card.power,
      toughness: card.toughness,
      rarity: card.rarity,
      source: card.source,
      image_url: card.image_url,
      set_code: card.set_code,
      set_name: card.set_name,
      rulings: card.rulings,
      legalities: card.legalities,
      created_at: card.created_at,
      updated_at: card.updated_at
    }]),
    response_mode: 'blocking',
    conversation_id: '',
    user: 'app'
  }

  try {
    const response = await fetch(DIFY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIFY_API_KEY}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      console.error(`[ERROR] AI API returned ${response.status} for card ${card.name}`)
      return null
    }

    const data: DifyResponse = await response.json()

    // Extract JSON from markdown code block
    const parsedAbility = extractJsonFromMarkdown(data.answer)

    return parsedAbility

  } catch (error) {
    console.error(`[ERROR] Failed to parse card ${card.name}:`, error)
    return null
  }
}

/**
 * Insert parsed ability into database
 */
async function insertAbility(parsedAbility: ParsedAbility): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('card_abilities')
      .upsert({
        card_id: parsedAbility.cardId,
        schema_version: parsedAbility.version || '1.1',
        abilities: parsedAbility.abilities,
        has_static_abilities: parsedAbility.abilities.static?.length > 0,
        has_triggered_abilities: parsedAbility.abilities.triggered?.length > 0,
        has_activated_abilities: parsedAbility.abilities.activated?.length > 0,
        has_replacement_effects: parsedAbility.abilities.replacement?.length > 0,
        has_keywords: parsedAbility.abilities.keywords?.length > 0,
        parsing_confidence: parsedAbility.parsing_confidence,
        parsing_notes: parsedAbility.parsing_notes,
        manually_verified: false,
        manually_edited: false
      }, {
        onConflict: 'card_id'
      })

    if (error) {
      console.error(`[ERROR] Failed to insert ability for card ${parsedAbility.cardName}:`, error)
      return false
    }

    return true

  } catch (error) {
    console.error(`[ERROR] Database error for card ${parsedAbility.cardName}:`, error)
    return false
  }
}

/**
 * Process a batch of cards
 */
async function processBatch(cards: CardData[]): Promise<void> {
  console.log(`\n[BATCH] Processing ${cards.length} cards...`)

  let successCount = 0
  let failureCount = 0

  for (const card of cards) {
    console.log(`\n[CARD] Processing: ${card.name} (${card.id})`)

    // Check if card has oracle text
    if (!card.oracle_text || card.oracle_text.trim() === '') {
      console.log(`[SKIP] No oracle text for ${card.name}`)
      continue
    }

    // Parse with AI
    const parsedAbility = await parseCardWithAI(card)

    if (!parsedAbility) {
      console.log(`[FAIL] Failed to parse ${card.name}`)
      failureCount++
      continue
    }

    console.log(`[PARSED] ${card.name} - Confidence: ${parsedAbility.parsing_confidence}`)
    console.log(`  Static: ${parsedAbility.abilities.static?.length || 0}`)
    console.log(`  Triggered: ${parsedAbility.abilities.triggered?.length || 0}`)
    console.log(`  Activated: ${parsedAbility.abilities.activated?.length || 0}`)
    console.log(`  Replacement: ${parsedAbility.abilities.replacement?.length || 0}`)
    console.log(`  Keywords: ${parsedAbility.abilities.keywords?.length || 0}`)
    console.log(`  Saga: ${parsedAbility.abilities.saga ? 'Yes' : 'No'}`)

    // Insert into database
    const success = await insertAbility(parsedAbility)

    if (success) {
      console.log(`[SUCCESS] Inserted ability for ${card.name}`)
      successCount++
    } else {
      console.log(`[FAIL] Failed to insert ability for ${card.name}`)
      failureCount++
    }

    // Rate limiting - wait 1 second between requests
    if (cards.indexOf(card) < cards.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`\n[BATCH COMPLETE] Success: ${successCount}, Failures: ${failureCount}`)
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(80))
  console.log('Card Abilities Population Script')
  console.log('='.repeat(80))
  console.log(`Batch size: ${batchSize}`)
  console.log(`Limit: ${limit || 'No limit'}`)
  console.log(`Specific card: ${specificCardId || 'None'}`)
  console.log('='.repeat(80))

  try {
    // Fetch cards that need parsing
    let query = supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)
      .neq('oracle_text', '')

    // Filter by specific card if provided
    if (specificCardId) {
      query = query.eq('id', specificCardId)
    } else {
      // Only fetch cards that don't have abilities yet
      const { data: existingAbilities } = await supabase
        .from('card_abilities')
        .select('card_id')

      const existingCardIds = (existingAbilities || []).map(a => a.card_id)

      if (existingCardIds.length > 0) {
        query = query.not('id', 'in', `(${existingCardIds.join(',')})`)
      }
    }

    // Apply limit if specified
    if (limit > 0) {
      query = query.limit(limit)
    }

    const { data: cards, error } = await query

    if (error) {
      console.error('[ERROR] Failed to fetch cards:', error)
      process.exit(1)
    }

    if (!cards || cards.length === 0) {
      console.log('[INFO] No cards to process')
      process.exit(0)
    }

    console.log(`\n[INFO] Found ${cards.length} cards to process`)

    // Process in batches
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize)
      console.log(`\n${'='.repeat(80)}`)
      console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cards.length / batchSize)}`)
      console.log(`${'='.repeat(80)}`)

      await processBatch(batch)

      // Wait between batches
      if (i + batchSize < cards.length) {
        console.log('\n[WAIT] Waiting 2 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('[COMPLETE] All cards processed')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('[FATAL ERROR]', error)
    process.exit(1)
  }
}

// Run script
main()
