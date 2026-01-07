import type { GameState, GameLogEntry, Phase } from "./types"
import { v4 as uuidv4 } from "uuid"

/**
 * Add an entry to the game log
 */
export function addGameLog(
  gameState: GameState,
  action: string,
  type: GameLogEntry["type"],
  playerId: string,
  options?: {
    cardName?: string
    cardText?: string
    targetName?: string
    details?: string
  }
): void {
  const player = gameState.players[playerId]
  const entry: GameLogEntry = {
    id: uuidv4(),
    timestamp: Date.now(),
    turnNumber: gameState.turnState.turnNumber,
    phase: gameState.turnState.phase,
    playerId,
    playerName: player?.name || "Unknown",
    action,
    type,
    ...options,
  }

  gameState.gameLog.push(entry)
  console.log(`[LOG] ${entry.playerName}: ${action}${entry.cardName ? ` - ${entry.cardName}` : ""}`)
}

/**
 * Format log entry for display
 */
export function formatLogEntry(entry: GameLogEntry): string {
  let text = `Turn ${entry.turnNumber} - ${entry.phase.replace(/_/g, " ")}: `
  text += `${entry.playerName} ${entry.action}`
  
  if (entry.cardName) {
    text += ` ${entry.cardName}`
  }
  
  if (entry.targetName) {
    text += ` targeting ${entry.targetName}`
  }
  
  if (entry.details) {
    text += ` (${entry.details})`
  }
  
  return text
}

/**
 * Get log entries filtered by type
 */
export function getLogEntriesByType(
  gameState: GameState,
  type: GameLogEntry["type"]
): GameLogEntry[] {
  return gameState.gameLog.filter((entry) => entry.type === type)
}

/**
 * Get log entries for a specific turn
 */
export function getLogEntriesByTurn(
  gameState: GameState,
  turnNumber: number
): GameLogEntry[] {
  return gameState.gameLog.filter((entry) => entry.turnNumber === turnNumber)
}

/**
 * Export log as text
 */
export function exportLogAsText(gameState: GameState): string {
  return gameState.gameLog.map(formatLogEntry).join("\n")
}
