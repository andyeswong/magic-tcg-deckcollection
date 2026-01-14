// Game Engine Type Definitions

import type { RuntimeAbilityState } from './runtime-ability-state'

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
  "-1-1": number        // -1/-1 counters (v1.1)
  loyalty: number
  charge: number
  poison: number
  stun: number          // Stun counters prevent untapping (v1.1)
  shield: number        // Shield counters prevent next damage/destroy
  vow: number           // Vow counters prevent attacking the controller who put them
  lore: number          // Lore counters for Sagas (v1.1)
  indestructible: number // Indestructible counters grant indestructible (v1.1)
  flying: number        // Flying counters grant flying (v1.1)
  first_strike: number  // First strike counters grant first strike (v1.1)
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
  isToken: boolean // If true, this is a token (exiles when leaving battlefield)
  attachedTo?: string // For Equipment/Auras (references another instanceId)

  // Mutable stats
  counters: Counters
  temporaryModifiers: TemporaryModifier[]

  // Runtime ability state (v1.1 - tracks active abilities, granted effects, etc.)
  runtimeAbilityState?: RuntimeAbilityState
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
  commanderTax: number // How many times commander has been cast (adds {2} per cast)
  pendingDiscards: number // Number of cards player needs to discard (for hand size limit)
  mulliganCount: number // Number of mulligans taken (affects starting hand size)

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

// Phase 2: Triggered Abilities
export interface PendingTrigger {
  id: string // unique trigger ID
  sourceCardId: string // card that triggered the ability
  controllerId: string // player who controls the trigger
  trigger: "etb" | "attack" | "damage" | "cast" | "dies" | "counter_added"
  effect: string // effect identifier (e.g., "add_counter_target", "draw_card", "proliferate")
  requiresTarget: boolean
  validTargets?: string[] // card instance IDs that can be targeted
  amount?: number // for effects that add counters
  resolved: boolean
  // Phase 3: Proliferate-specific fields
  proliferateTargets?: string[] // selected card/player IDs to proliferate
}

// Game Log Entry
export interface GameLogEntry {
  id: string
  timestamp: number
  turnNumber: number
  phase: Phase
  playerId: string
  playerName: string
  action: string
  cardName?: string
  cardText?: string
  targetName?: string
  details?: string
  type: "action" | "trigger" | "combat" | "phase" | "effect"
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

  // Game options (for debugging/testing)
  seed?: string
  devMode?: boolean

  // Turn structure
  turnState: {
    activePlayerId: string
    priorityPlayerId: string // Player who currently has priority
    turnNumber: number
    phase: Phase
    stack: StackItem[]
    waitingForPriority: boolean // True when waiting for player to pass priority or respond
    priorityPasses: number // Track consecutive passes (when all players pass, stack resolves)
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

  // Phase 2: Triggered Abilities
  triggerQueue: PendingTrigger[]

  // Game Log
  gameLog: GameLogEntry[]

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
  cardInstanceId?: string // Reference to the card being cast (for spells)
  cardName: string // Name of the card/ability
  controllerId: string
  targets: string[] // Target card/player IDs
  effect?: any // Specific effect data (for abilities)
  xValue?: number // For X spells
  manaCost?: string // Mana cost paid
  selectedModes?: number[] // For modal spells (indices of selected modes)
  selectedCard?: string // For library search spells
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
  commander_card_id: string
  commander_mana_cost?: string
  commander_type_line?: string
  commander_cmc?: number
  commander_power?: string
  commander_toughness?: string
  commander_colors?: string[]
  commander_color_identity?: string[]
  commander_keywords?: string[]
  commander_oracle_text?: string
  user_id: string
}
