export interface MTGCard {
  id: string
  name: string
  manaCost?: string
  cmc?: number
  colors?: string[]
  colorIdentity?: string[]
  type: string
  supertypes?: string[]
  types?: string[]
  subtypes?: string[]
  rarity?: string
  text?: string
  power?: string
  toughness?: string
  imageUrl?: string
  multiverseid?: string
  legalities?: Array<{
    format: string
    legality: string
  }>
  source?: "mtg" | "moxfield"
}

export interface Deck {
  id: string
  user_id: string
  name: string
  commander_card_id: string
  commander_name: string
  commander_image_url: string | null
  created_at: string
  updated_at: string
}

export interface DeckCard {
  id: string
  deck_id: string
  card_id: string
  card_name: string
  card_image_url: string | null
  mana_cost: string | null
  type_line: string | null
  source: string | null
  created_at: string
}
