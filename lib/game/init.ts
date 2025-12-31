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

// Initialize empty counters
function createEmptyCounters(): Counters {
  return { p1p1: 0, loyalty: 0, charge: 0, poison: 0 }
}

// Create a card instance from deck card data
function createCardInstance(
  deckCard: DeckCardData,
  ownerId: string,
  isCommander: boolean = false,
): CardInstance {
  const cardData = deckCard.cards || {}

  return {
    instanceId: uuidv4(),
    ownerId,
    controllerId: ownerId,
    dbReferenceId: deckCard.card_id,

    // Static data
    name: deckCard.card_name,
    manaCost: deckCard.mana_cost || "",
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
    summoningSick: false,

    // Mutable stats
    counters: createEmptyCounters(),
    temporaryModifiers: [],
  }
}

// Shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
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
): GameState {
  const matchId = uuidv4()
  const entities: Record<string, CardInstance> = {}

  // Create card instances for human player
  const humanLibraryIds: string[] = []
  const humanCommanderIds: string[] = []

  // Create commander instance
  const commanderInstance = createCardInstance(
    {
      card_id: deckData.id + "-commander",
      card_name: deckData.commander_name,
      mana_cost: "",
      type_line: "Legendary Creature",
      card_image_url: deckData.commander_image_url,
      quantity: 1,
      source: "deck",
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

  // Shuffle human library
  const shuffledHumanLibrary = shuffleArray(humanLibraryIds)

  // Create identical deck for bot player
  const botLibraryIds: string[] = []
  const botCommanderIds: string[] = []

  // Bot commander
  const botCommanderInstance = createCardInstance(
    {
      card_id: deckData.id + "-commander",
      card_name: deckData.commander_name,
      mana_cost: "",
      type_line: "Legendary Creature",
      card_image_url: deckData.commander_image_url,
      quantity: 1,
      source: "deck",
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

  // Shuffle bot library
  const shuffledBotLibrary = shuffleArray(botLibraryIds)

  // Create player states
  const humanPlayer = createPlayerState(humanPlayerId, humanPlayerName)
  humanPlayer.library = shuffledHumanLibrary
  humanPlayer.commandZone = humanCommanderIds

  const botPlayer = createPlayerState(botPlayerId, botPlayerName)
  botPlayer.library = shuffledBotLibrary
  botPlayer.commandZone = botCommanderIds

  // Randomly decide who goes first
  const firstPlayerId = Math.random() < 0.5 ? humanPlayerId : botPlayerId

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

    turnState: {
      activePlayerId: firstPlayerId,
      priorityPlayerId: firstPlayerId,
      turnNumber: 1,
      phase: "UNTAP",
      stack: [],
    },

    players: {
      [humanPlayerId]: humanPlayer,
      [botPlayerId]: botPlayer,
    },

    entities,
    battlefield: [],
    exile: [],

    status: "SETUP",
  }

  return gameState
}

// Draw initial hand (7 cards)
export function drawInitialHand(gameState: GameState, playerId: string): void {
  const player = gameState.players[playerId]
  const handSize = 7

  for (let i = 0; i < handSize && player.library.length > 0; i++) {
    const cardId = player.library.pop()!
    player.hand.push(cardId)
    gameState.entities[cardId].zone = "HAND"
  }
}

// Start the game (draw initial hands and advance to first interactive phase)
export function startGame(gameState: GameState): void {
  console.log(`[GAME] Starting game, initial phase: ${gameState.turnState.phase}`)

  Object.keys(gameState.players).forEach((playerId) => {
    drawInitialHand(gameState, playerId)
  })
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
}
