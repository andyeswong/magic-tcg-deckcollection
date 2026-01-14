import { v4 as uuidv4 } from "uuid"
import type {
  GameState,
  CardInstance,
  PlayerState,
  DeckCardData,
  DeckData,
  ManaPool,
  Counters,
} from "./types"

// Initialize empty mana pool
function createEmptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
}

// Initialize empty counters (v1.1 - all 12 counter types)
function createEmptyCounters(): Counters {
  return {
    p1p1: 0,
    "-1-1": 0,
    loyalty: 0,
    charge: 0,
    poison: 0,
    stun: 0,
    shield: 0,
    vow: 0,
    lore: 0,
    indestructible: 0,
    flying: 0,
    first_strike: 0
  }
}

// Create a card instance from deck card data
function createCardInstance(
  deckCard: DeckCardData,
  ownerId: string,
  isCommander: boolean = false,
): CardInstance {
  const cardData = deckCard.cards || {}

  // Ensure mana_cost is set - log warning if missing (except for lands, which have no mana cost)
  const manaCost = deckCard.mana_cost || ""
  const isLand = deckCard.type_line?.toLowerCase().includes("land")
  if (!manaCost && deckCard.card_name && !isLand) {
    console.warn(`[INIT] Card "${deckCard.card_name}" has no mana_cost in database. Please re-add this card to your deck.`)
  }

  return {
    instanceId: uuidv4(),
    ownerId,
    controllerId: ownerId,
    dbReferenceId: deckCard.card_id,

    // Static data
    name: deckCard.card_name,
    manaCost: manaCost,
    cmc: cardData.cmc || 0,
    types: deckCard.type_line?.split("—")[0]?.trim().split(" ") || [],
    typeLine: deckCard.type_line || "",
    oracleText: cardData.oracle_text || "",
    power: cardData.power || "",
    toughness: cardData.toughness || "",
    colors: cardData.colors || [],
    colorIdentity: cardData.color_identity || [],
    keywords: cardData.keywords || [],
    imageUrl: deckCard.card_image_url || "",

    // Dynamic state
    zone: isCommander ? "COMMAND" : "LIBRARY",
    tapped: false,
    faceDown: false,
    summoningSick: false,    isToken: false,
    // Mutable stats
    counters: createEmptyCounters(),
    temporaryModifiers: [],
  }
}

// Seeded random number generator (for reproducible shuffles)
function seededRandom(seed: string): () => number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Simple LCG (Linear Congruential Generator)
  let state = Math.abs(hash)
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

// Shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[], seed?: string): T[] {
  const shuffled = [...array]
  const rng = seed ? seededRandom(seed) : Math.random
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Create initial player state
function createPlayerState(playerId: string, playerName: string): PlayerState {
  return {
    id: playerId,
    name: playerName,
    life: 40, // Commander starting life
    poisonCounters: 0,
    energyCounters: 0,
    commanderDamageTaken: {},
    manaPool: createEmptyManaPool(),
    flags: {
      landsPlayedThisTurn: 0,
      maxLandsPerTurn: 1,
      canCastSorcery: false,
    },
    commanderTax: 0,
    pendingDiscards: 0,
    mulliganCount: 0,
    hand: [],
    library: [],
    graveyard: [],
    commandZone: [],
  }
}

// Initialize game state from deck data
export function initializeGame(
  deckData: DeckData,
  deckCards: DeckCardData[],
  humanPlayerId: string,
  humanPlayerName: string,
  botPlayerId: string = "bot-player",
  botPlayerName: string = "Bot",
  options?: { seed?: string; devMode?: boolean }
): GameState {
  const matchId = uuidv4()
  const entities: Record<string, CardInstance> = {}

  // Create card instances for human player
  const humanLibraryIds: string[] = []
  const humanCommanderIds: string[] = []

  // Create commander instance
  const commanderInstance = createCardInstance(
    {
      card_id: deckData.commander_card_id || deckData.id + "-commander",
      card_name: deckData.commander_name,
      mana_cost: deckData.commander_mana_cost || "",
      type_line: deckData.commander_type_line || "Legendary Creature",
      card_image_url: deckData.commander_image_url,
      quantity: 1,
      source: "deck",
      cards: {
        cmc: deckData.commander_cmc || 0,
        colors: deckData.commander_colors || [],
        color_identity: deckData.commander_color_identity || [],
        oracle_text: deckData.commander_oracle_text || "",
        power: deckData.commander_power || "",
        toughness: deckData.commander_toughness || "",
        keywords: deckData.commander_keywords || [],
      },
    },
    humanPlayerId,
    true,
  )
  entities[commanderInstance.instanceId] = commanderInstance
  humanCommanderIds.push(commanderInstance.instanceId)

  // Create instances for each card in the deck
  deckCards.forEach((deckCard) => {
    const quantity = deckCard.quantity || 1
    for (let i = 0; i < quantity; i++) {
      const instance = createCardInstance(deckCard, humanPlayerId)
      entities[instance.instanceId] = instance
      humanLibraryIds.push(instance.instanceId)
    }
  })

  // Shuffle human library with optional seed
  const shuffledHumanLibrary = shuffleArray(humanLibraryIds, options?.seed ? `${options.seed}-human` : undefined)

  // Create identical deck for bot player
  const botLibraryIds: string[] = []
  const botCommanderIds: string[] = []

  // Bot commander
  const botCommanderInstance = createCardInstance(
    {
      card_id: deckData.commander_card_id || deckData.id + "-commander",
      card_name: deckData.commander_name,
      mana_cost: deckData.commander_mana_cost || "",
      type_line: deckData.commander_type_line || "Legendary Creature",
      card_image_url: deckData.commander_image_url,
      quantity: 1,
      source: "deck",
      cards: {
        cmc: deckData.commander_cmc || 0,
        colors: deckData.commander_colors || [],
        color_identity: deckData.commander_color_identity || [],
        oracle_text: deckData.commander_oracle_text || "",
        power: deckData.commander_power || "",
        toughness: deckData.commander_toughness || "",
        keywords: deckData.commander_keywords || [],
      },
    },
    botPlayerId,
    true,
  )
  entities[botCommanderInstance.instanceId] = botCommanderInstance
  botCommanderIds.push(botCommanderInstance.instanceId)

  // Bot deck cards
  deckCards.forEach((deckCard) => {
    const quantity = deckCard.quantity || 1
    for (let i = 0; i < quantity; i++) {
      const instance = createCardInstance(deckCard, botPlayerId)
      entities[instance.instanceId] = instance
      botLibraryIds.push(instance.instanceId)
    }
  })

  // Shuffle bot library with optional seed
  const shuffledBotLibrary = shuffleArray(botLibraryIds, options?.seed ? `${options.seed}-bot` : undefined)

  // Create player states
  const humanPlayer = createPlayerState(humanPlayerId, humanPlayerName)
  humanPlayer.library = shuffledHumanLibrary
  humanPlayer.commandZone = humanCommanderIds
  
  // Apply dev mode: 999 of each mana
  if (options?.devMode) {
    humanPlayer.manaPool = { W: 999, U: 999, B: 999, R: 999, G: 999, C: 999 }
    console.log("[DEV MODE] Human player starting with 999 of each mana")
  }

  const botPlayer = createPlayerState(botPlayerId, botPlayerName)
  botPlayer.library = shuffledBotLibrary
  botPlayer.commandZone = botCommanderIds
  
  // Bot doesn't get dev mode mana (for fair testing)

  // Randomly decide who goes first (unless seed is provided)
  const firstPlayerId = options?.seed 
    ? (seededRandom(options.seed)() < 0.5 ? humanPlayerId : botPlayerId)
    : (Math.random() < 0.5 ? humanPlayerId : botPlayerId)
  
  if (options?.seed) {
    console.log(`[SEEDED GAME] Using seed: "${options.seed}", first player: ${firstPlayerId === humanPlayerId ? 'Human' : 'Bot'}`)
  }

  // Create initial game state
  const gameState: GameState = {
    matchId,
    deckId: deckData.id,
    format: "COMMANDER",
    timestamp: Date.now(),

    rulesConfig: {
      startingLife: 40,
      maxDeckSize: 100,
      commanderDamageThreshold: 21,
      mulliganType: "LONDON",
    },

    // Store game options
    seed: options?.seed,
    devMode: options?.devMode,

    turnState: {
      activePlayerId: firstPlayerId,
      priorityPlayerId: firstPlayerId,
      turnNumber: 1,
      phase: "UNTAP",
      stack: [],
      waitingForPriority: false,
      priorityPasses: 0,
    },

    players: {
      [humanPlayerId]: humanPlayer,
      [botPlayerId]: botPlayer,
    },

    entities,
    battlefield: [],
    exile: [],

    // Phase 2: Initialize trigger queue
    triggerQueue: [],

    // Game Log
    gameLog: [],

    status: "SETUP",
  }

  return gameState
}

// Draw initial hand (7 cards, or less if mulligans taken)
export function drawInitialHand(gameState: GameState, playerId: string): void {
  const player = gameState.players[playerId]
  // First mulligan is free (still draw 7), subsequent mulligans draw 1 less card each
  const handSize = Math.max(1, 7 - Math.max(0, player.mulliganCount - 1))

  for (let i = 0; i < handSize && player.library.length > 0; i++) {
    const cardId = player.library.pop()!
    player.hand.push(cardId)
    gameState.entities[cardId].zone = "HAND"
  }
  
  console.log(`[MULLIGAN] ${player.name} drew ${handSize} cards (mulligan count: ${player.mulliganCount})`)
}

// Start the game (advance to first interactive phase without drawing cards)
export function startGame(gameState: GameState): void {
  console.log(`[GAME] Starting game, initial phase: ${gameState.turnState.phase}`)

  gameState.status = "PLAYING"

  // Advance to the first interactive phase (MAIN_1)
  // Import at top of file would cause circular dependency, so using inline logic
  let iterations = 0
  const maxIterations = 20
  const interactivePhases = ["MAIN_1", "DECLARE_ATTACKERS", "MAIN_2"]

  console.log(`[GAME] Auto-advancing to first interactive phase...`)
  while (!interactivePhases.includes(gameState.turnState.phase) && iterations < maxIterations) {
    // Simple phase advance logic here
    const phaseOrder = [
      "UNTAP",
      "UPKEEP",
      "DRAW",
      "MAIN_1",
      "COMBAT_BEGIN",
      "DECLARE_ATTACKERS",
      "DECLARE_BLOCKERS",
      "COMBAT_DAMAGE",
      "COMBAT_END",
      "MAIN_2",
      "END_STEP",
      "CLEANUP",
    ]
    const currentIndex = phaseOrder.indexOf(gameState.turnState.phase)
    const nextPhase = phaseOrder[(currentIndex + 1) % phaseOrder.length]
    console.log(`[GAME] Iteration ${iterations}: ${gameState.turnState.phase} -> ${nextPhase}`)
    gameState.turnState.phase = nextPhase
    iterations++
  }
  console.log(`[GAME] Game started in phase: ${gameState.turnState.phase}`)
  console.log(`[GAME-DEBUG] gameState.devMode = ${gameState.devMode}`)
  
  // Apply dev mode mana after phase advancement (to avoid it being cleared)
  if (gameState.devMode) {
    console.log(`[DEV MODE] Applying dev mode mana...`)
    Object.values(gameState.players).forEach((player) => {
      player.manaPool = { W: 999, U: 999, B: 999, R: 999, G: 999, C: 999 }
      console.log(`[DEV MODE] Applied 999 mana to player ${player.name}: W=${player.manaPool.W}, U=${player.manaPool.U}, B=${player.manaPool.B}, R=${player.manaPool.R}, G=${player.manaPool.G}, C=${player.manaPool.C}`)
    })
    console.log("[DEV MODE] Applied 999 of each mana to all players after game start")
  } else {
    console.log(`[DEV MODE] Not applying dev mode mana (devMode is ${gameState.devMode})`)
  }
}