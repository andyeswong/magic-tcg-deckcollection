// Game Engine Type Definitions

export type Zone =
  | "HAND"
  | "LIBRARY"
  | "BATTLEFIELD"
  | "GRAVEYARD"
  | "STACK"
  | "COMMAND"
  | "EXILE"

export type Phase =
  | "UNTAP"
  | "UPKEEP"
  | "DRAW"
  | "MAIN_1"
  | "COMBAT_BEGIN"
  | "DECLARE_ATTACKERS"
  | "DECLARE_BLOCKERS"
  | "COMBAT_DAMAGE"
  | "COMBAT_END"
  | "MAIN_2"
  | "END_STEP"
  | "CLEANUP"

export type CardType = "Creature" | "Instant" | "Sorcery" | "Enchantment" | "Artifact" | "Planeswalker" | "Land"

export type ManaColor = "W" | "U" | "B" | "R" | "G" | "C"

export interface ManaPool {
  W: number
  U: number
  B: number
  R: number
  G: number
  C: number
}

export interface Counters {
  p1p1: number
  loyalty: number
  charge: number
  poison: number
}

export interface TemporaryModifier {
  effect: string
  source: string
  expiresAt: "end_of_turn" | "end_of_game" | "end_of_combat"
  power?: number
  toughness?: number
}

// Card Instance - Runtime representation of a card in the game
export interface CardInstance {
  instanceId: string // Unique UUID for this specific card instance
  ownerId: string // Player who owns this card
  controllerId: string // Player who controls this card (can change)
  dbReferenceId: string // Links back to cards table

  // Static card data (copied from DB for quick access)
  name: string
  manaCost: string
  cmc: number
  types: string[]
  typeLine: string
  oracleText?: string
  power?: string
  toughness?: string
  colors: string[]
  colorIdentity: string[]
  keywords: string[]
  imageUrl?: string

  // Dynamic game state
  zone: Zone
  tapped: boolean
  faceDown: boolean
  summoningSick: boolean
  attachedTo?: string // For Equipment/Auras (references another instanceId)

  // Mutable stats
  counters: Counters
  temporaryModifiers: TemporaryModifier[]
}

export interface PlayerFlags {
  landsPlayedThisTurn: number
  maxLandsPerTurn: number
  canCastSorcery: boolean
}

export interface PlayerState {
  id: string
  name: string
  life: number
  poisonCounters: number
  energyCounters: number
  commanderDamageTaken: Record<string, number> // commanderInstanceId -> damage
  manaPool: ManaPool
  flags: PlayerFlags

  // Player-specific zones (IDs referencing CardInstances)
  hand: string[]
  library: string[]
  graveyard: string[]
  commandZone: string[]
}

export interface CombatState {
  attackers: {
    attackerId: string
    targetId: string // player ID or planeswalker instance ID
    blocked: boolean
    blockers: string[]
  }[]
}

export interface GameConfig {
  startingLife: number
  maxDeckSize: number
  commanderDamageThreshold: number
  mulliganType: "LONDON" | "VANCOUVER"
}

// The complete game state
export interface GameState {
  matchId: string
  deckId: string // The deck being played
  format: "COMMANDER"
  timestamp: number

  rulesConfig: GameConfig

  // Turn structure
  turnState: {
    activePlayerId: string
    priorityPlayerId: string
    turnNumber: number
    phase: Phase
    stack: StackItem[]
  }

  // Players
  players: Record<string, PlayerState>

  // All card instances in the game (keyed by instanceId)
  entities: Record<string, CardInstance>

  // Shared zones
  battlefield: string[] // instance IDs on the battlefield
  exile: string[] // instance IDs in exile

  // Combat
  combat?: CombatState

  // Game status
  status: "SETUP" | "PLAYING" | "ENDED"
  winner?: string
}

// Action types for the action system
export type ActionType =
  | "GAME_START"
  | "DRAW_CARD"
  | "PLAY_LAND"
  | "TAP_PERMANENT"
  | "UNTAP_PERMANENT"
  | "CAST_SPELL"
  | "ACTIVATE_ABILITY"
  | "PASS_PRIORITY"
  | "RESOLVE_STACK"
  | "DECLARE_ATTACKERS"
  | "DECLARE_BLOCKERS"
  | "ASSIGN_DAMAGE"
  | "STATE_BASED_ACTIONS"
  | "CHANGE_PHASE"
  | "ADD_MANA"
  | "SPEND_MANA"

export interface GameAction {
  type: ActionType
  payload: any
  timestamp: number
  playerId: string
}

export interface StackItem {
  id: string
  type: "SPELL" | "ABILITY"
  cardInstanceId?: string
  controllerId: string
  targets: string[]
  effect?: any
}

// Helper types for deck initialization
export interface DeckCardData {
  card_id: string
  card_name: string
  mana_cost: string
  type_line: string
  card_image_url: string
  quantity: number
  source: string
  cards?: {
    cmc: number
    colors: string[]
    type_line: string
    oracle_text: string
    power: string
    toughness: string
    keywords: string[]
    color_identity: string[]
  }
}

export interface DeckData {
  id: string
  name: string
  commander_name: string
  commander_image_url: string
  user_id: string
}
