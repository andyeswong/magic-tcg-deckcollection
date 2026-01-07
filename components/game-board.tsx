"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GameCard } from "@/components/game-card"
import { ManaPoolDisplay } from "@/components/mana-pool-display"
import { ManaChoiceDialog } from "@/components/mana-choice-dialog"
import { DiscardDialog } from "@/components/discard-dialog"
import { TriggerTargetDialog } from "@/components/trigger-target-dialog"
import { ProliferateDialog } from "@/components/proliferate-dialog"
import { SupportTargetDialog } from "@/components/support-target-dialog"
import { XValueDialog } from "@/components/x-value-dialog"
import { ModalSpellDialog } from "@/components/modal-spell-dialog"
import { SpellTargetDialog } from "@/components/spell-target-dialog"
import { LibrarySearchDialog } from "@/components/library-search-dialog"
import { GameLogViewer } from "@/components/game-log-viewer"
import { MulliganDialog } from "@/components/mulligan-dialog"
import { MulliganScryDialog } from "@/components/mulligan-scry-dialog"
import { ScryDialog } from "@/components/scry-dialog"
import { useGameStore } from "@/lib/game/store"
import { executeBotTurn } from "@/lib/game/bot"
import { parseLandManaOptions, isDualLand } from "@/lib/game/land-parser"
import { parseActivatedAbilities } from "@/lib/game/card-effects"
import { isCardPlayable, isLandPlayable } from "@/lib/game/helpers"
import { parseSpellEffect } from "@/lib/game/spell-parser"
import type { SpellEffect } from "@/lib/game/spell-parser"
import { Play, SkipForward, Swords } from "lucide-react"
import { toast } from "sonner"
import type { ManaColor } from "@/lib/game/types"
import { cn } from "@/lib/utils"

export function GameBoard() {
  const {
    gameState,
    humanPlayerId,
    botPlayerId,
    playLand,
    castSpell,
    castCommander,
    addManaFromLand,
    declareAttackers,
    declareBlockers,
    activateAbility,
    discardCard,
    passPriority,
    advancePhase,
    advanceToNextInteractivePhase,
    endTurn,
    resolveTriggerWithTarget,
    resolveProliferate,
    resolveSupport,
    takeMulligan,
    keepHand,
    putCardsOnBottom,
    resolveScry,
  } = useGameStore()

  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [attackers, setAttackers] = useState<string[]>([])
  const [blockerMap, setBlockerMap] = useState<Record<string, string>>({})
  const [attackingCards, setAttackingCards] = useState<string[]>([])
  const [manaChoiceOpen, setManaChoiceOpen] = useState(false)
  const [manaChoiceCard, setManaChoiceCard] = useState<string | null>(null)
  const [xValueDialogOpen, setXValueDialogOpen] = useState(false)
  const [xValueCard, setXValueCard] = useState<string | null>(null)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [backgroundImage, setBackgroundImage] = useState<string>("")

  // New spell casting dialogs
  const [modalSpellOpen, setModalSpellOpen] = useState(false)
  const [modalSpellData, setModalSpellData] = useState<{ card: string; modal: NonNullable<SpellEffect["modal"]> } | null>(null)
  const [spellTargetOpen, setSpellTargetOpen] = useState(false)
  const [spellTargetData, setSpellTargetData] = useState<{ card: string; effect: SpellEffect } | null>(null)
  const [librarySearchOpen, setLibrarySearchOpen] = useState(false)
  const [librarySearchData, setLibrarySearchData] = useState<{ card: string; effect: SpellEffect } | null>(null)

  // Select random background on mount
  useEffect(() => {
    const bgNumber = Math.floor(Math.random() * 13) + 1
    setBackgroundImage(`/bg/bg-${bgNumber}.jpeg`)
  }, [])

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl text-muted-foreground">No game in progress</p>
      </div>
    )
  }

  const humanPlayer = gameState.players[humanPlayerId]
  const botPlayer = gameState.players[botPlayerId]
  const isHumanTurn = gameState.turnState.activePlayerId === humanPlayerId
  const phase = gameState.turnState.phase

  // Track attacking cards for animation
  useEffect(() => {
    if (gameState.combat && gameState.combat.attackers.length > 0) {
      setAttackingCards(gameState.combat.attackers.map(a => a.attackerId))
    } else {
      setAttackingCards([])
    }
  }, [gameState.combat])

  // Auto-play bot turn
  useEffect(() => {
    if (!isHumanTurn && gameState.status === "PLAYING") {
      // Don't auto-execute during DECLARE_BLOCKERS if bot has attackers - let player block
      if (phase === "DECLARE_BLOCKERS" && gameState.combat && gameState.combat.attackers.length > 0) {
        console.log("[UI] Waiting for player to declare blockers")
        return
      }

      // Delay to make it visible
      const timer = setTimeout(() => {
        executeBotTurn(gameState, botPlayerId)
        // Force re-render
        useGameStore.setState({ gameState: { ...gameState } })
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [isHumanTurn, gameState.turnState.turnNumber, phase])

  // Auto-handle bot priority (for responding to spells)
  useEffect(() => {
    if (
      gameState.status === "PLAYING" &&
      gameState.turnState.waitingForPriority &&
      gameState.turnState.priorityPlayerId === botPlayerId
    ) {
      console.log("[UI] Bot has priority, auto-passing")
      // Small delay to show the stack state before bot responds
      const timer = setTimeout(() => {
        executeBotTurn(gameState, botPlayerId)
        // Force re-render
        useGameStore.setState({ gameState: { ...gameState } })
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [gameState.turnState.waitingForPriority, gameState.turnState.priorityPlayerId])

  // Auto-open discard dialog when player needs to discard
  useEffect(() => {
    if (humanPlayer.pendingDiscards > 0) {
      setDiscardDialogOpen(true)
    }
  }, [humanPlayer.pendingDiscards])

  const handleCardClick = (cardId: string) => {
    const card = gameState.entities[cardId]

    console.log(`[CLICK] Card: ${card.name}, Phase: ${phase}, IsHumanTurn: ${isHumanTurn}, HasCombat: ${!!gameState.combat}`)

    // In DECLARE_ATTACKERS phase, select attackers
    if (phase === "DECLARE_ATTACKERS" && isHumanTurn && card.controllerId === humanPlayerId) {
      if (attackers.includes(cardId)) {
        setAttackers(attackers.filter((id) => id !== cardId))
      } else {
        setAttackers([...attackers, cardId])
      }
      return
    }

    // In DECLARE_BLOCKERS phase, select blockers and assign to attackers
    // Note: During DECLARE_BLOCKERS, it's the ATTACKER's turn, so if bot is attacking, it's NOT isHumanTurn
    if (phase === "DECLARE_BLOCKERS" && !isHumanTurn && gameState.combat) {
      console.log(`[BLOCKING] Entering block selection mode. Attackers: ${gameState.combat.attackers.length}`);
      console.log(`[BLOCKING] Card controller: ${card.controllerId}, humanPlayerId: ${humanPlayerId}, isCreature: ${card.typeLine.toLowerCase().includes("creature")}, tapped: ${card.tapped}`);

      if (card.controllerId === humanPlayerId && card.typeLine.toLowerCase().includes("creature") && !card.tapped) {
        console.log(`[BLOCKING] Valid blocker clicked! SelectedCard: ${selectedCard}`);

        // Clicking a potential blocker
        if (selectedCard) {
          const selectedIsAttacker = gameState.combat.attackers.find((a) => a.attackerId === selectedCard)
          const selectedIsBlocker = selectedCard && gameState.entities[selectedCard]?.controllerId === humanPlayerId

          if (selectedIsAttacker) {
            // We previously selected an attacker, now assign this blocker to it
            console.log(`[BLOCKING] Assigning blocker ${card.name} to attacker ${gameState.entities[selectedCard].name}`);
            setBlockerMap({ ...blockerMap, [cardId]: selectedCard })
            setSelectedCard(null)
            toast.success(`${card.name} will block ${gameState.entities[selectedCard].name}!`)
          } else if (selectedIsBlocker) {
            // We previously selected a blocker, switch to this blocker instead
            console.log(`[BLOCKING] Switching from blocker to blocker ${card.name}`);
            setSelectedCard(cardId)
            toast.info(`Selected ${card.name} - click an attacker to block`)
          } else {
            // Unknown selection, just select this blocker
            setSelectedCard(cardId)
            toast.info(`Selected ${card.name} - click an attacker to block`)
          }
        } else {
          // No previous selection, just select the blocker
          console.log(`[BLOCKING] Selecting blocker ${card.name}`);
          setSelectedCard(cardId)
          toast.info(`Selected ${card.name} - click an attacker to block`)
        }
      } else if (gameState.combat.attackers.find((a) => a.attackerId === cardId)) {
        // Clicking an attacker
        console.log(`[BLOCKING] Attacker clicked: ${card.name}`);

        if (selectedCard) {
          const selectedIsBlocker = gameState.entities[selectedCard]?.controllerId === humanPlayerId &&
                                    gameState.entities[selectedCard]?.typeLine.toLowerCase().includes("creature")

          if (selectedIsBlocker) {
            // We previously selected a blocker, now assign it to this attacker
            console.log(`[BLOCKING] Assigning blocker ${gameState.entities[selectedCard].name} to attacker ${card.name}`);
            setBlockerMap({ ...blockerMap, [selectedCard]: cardId })
            setSelectedCard(null)
            toast.success(`${gameState.entities[selectedCard].name} will block ${card.name}!`)
          } else {
            // Switch attacker selection
            setSelectedCard(cardId)
            toast.info(`Selected attacker ${card.name} - click a blocker`)
          }
        } else {
          // No previous selection, select this attacker
          setSelectedCard(cardId)
          toast.info(`Selected attacker ${card.name} - click a blocker`)
        }
      } else {
        console.log(`[BLOCKING] Clicked card cannot block: controller=${card.controllerId}, isCreature=${card.typeLine.toLowerCase().includes("creature")}, tapped=${card.tapped}`);
      }
      return
    }

    if (!isHumanTurn) return

    // Otherwise, select card for action
    setSelectedCard(cardId === selectedCard ? null : cardId)
  }

  const handlePlayLand = () => {
    if (!selectedCard) return
    const success = playLand(humanPlayerId, selectedCard)
    if (success) {
      toast.success("Land played successfully")
      setSelectedCard(null)
    } else {
      toast.error("Cannot play land (already played one this turn or not in hand)")
    }
  }

  const handleTapForMana = () => {
    if (!selectedCard) return
    const card = gameState.entities[selectedCard]

    // Check if it's a dual land
    if (isDualLand(card.oracleText || "", card.name)) {
      setManaChoiceCard(selectedCard)
      setManaChoiceOpen(true)
    } else {
      const success = addManaFromLand(humanPlayerId, selectedCard)
      if (success) {
        toast.success("Mana added to pool")
        setSelectedCard(null)
      } else {
        toast.error("Cannot tap land (already tapped or not on battlefield)")
      }
    }
  }

  const handleManaChoice = (color: ManaColor) => {
    if (!manaChoiceCard) return

    const success = addManaFromLand(humanPlayerId, manaChoiceCard, color)
    if (success) {
      toast.success(`Added ${color} mana to pool`)
      setSelectedCard(null)
      setManaChoiceCard(null)
    } else {
      toast.error("Failed to add mana")
    }
  }

  const handleCastSpell = () => {
    if (!selectedCard) return
    const card = gameState.entities[selectedCard]

    // Parse spell effects to check if we need dialogs
    const effects = parseSpellEffect(card.oracleText || "", card.name)
    const primaryEffect = effects[0]

    // Check for modal spells first
    if (primaryEffect?.type === "modal" && primaryEffect.modal) {
      setModalSpellData({ card: selectedCard, modal: primaryEffect.modal })
      setModalSpellOpen(true)
      return
    }

    // Check for library search
    if (primaryEffect?.type === "search_library") {
      setLibrarySearchData({ card: selectedCard, effect: primaryEffect })
      setLibrarySearchOpen(true)
      return
    }

    // Check for targeted spells
    if (primaryEffect?.targets) {
      setSpellTargetData({ card: selectedCard, effect: primaryEffect })
      setSpellTargetOpen(true)
      return
    }

    // Check if spell has X in mana cost
    if (card.manaCost.includes("{X}")) {
      setXValueCard(selectedCard)
      setXValueDialogOpen(true)
    } else {
      // Simple spell - cast directly
      const success = castSpell(humanPlayerId, selectedCard)
      if (success) {
        toast.success(`${card.name} cast successfully`)
        setSelectedCard(null)
      } else {
        toast.error("Cannot cast spell (not enough mana or not in hand)")
      }
    }
  }

  const handleXValueChoice = (xValue: number) => {
    if (!xValueCard) return
    const card = gameState.entities[xValueCard]
    const success = castSpell(humanPlayerId, xValueCard, xValue)
    if (success) {
      toast.success(`${card.name} cast with X=${xValue}`)
      setSelectedCard(null)
      setXValueCard(null)
    } else {
      toast.error("Cannot cast spell")
    }
  }

  const handleCastCommander = () => {
    // Get commander name before casting (as it will be removed from command zone)
    const commanderId = humanPlayer.commandZone[0]
    const commanderName = commanderId ? gameState.entities[commanderId]?.name : "Commander"
    
    const success = castCommander(humanPlayerId)
    if (success) {
      toast.success(`${commanderName} cast from command zone`)
    } else {
      toast.error("Cannot cast commander (not enough mana or not in command zone)")
    }
  }

  const handleDeclareAttackers = () => {
    if (attackers.length === 0) return

    const attackersData = attackers.map((attackerId) => ({
      attackerId,
      targetId: botPlayerId,
    }))

    const success = declareAttackers(humanPlayerId, attackersData)
    if (success) {
      setAttackers([])
      advancePhase()
    }
  }

  const handleDeclareBlockers = () => {
    const blocks = Object.entries(blockerMap).map(([blockerId, attackerId]) => ({
      blockerId,
      attackerId,
    }))

    const success = declareBlockers(humanPlayerId, blocks)
    if (success) {
      setBlockerMap({})
      setSelectedCard(null)
      advancePhase()
      toast.success(`Declared ${blocks.length} blocker(s)`)
      
      // If it's bot's turn (bot is attacking), continue bot turn execution after blocking
      if (!isHumanTurn) {
        setTimeout(() => {
          executeBotTurn(gameState, botPlayerId)
          useGameStore.setState({ gameState: { ...gameState } })
        }, 500)
      }
    } else {
      toast.error("Failed to declare blockers")
    }
  }

  const handleDiscard = (cardIds: string[]) => {
    // Discard each selected card
    cardIds.forEach((cardId) => {
      discardCard(humanPlayerId, cardId)
    })

    // Clear the pending discards flag
    if (gameState) {
      gameState.players[humanPlayerId].pendingDiscards = 0
      useGameStore.setState({ gameState: { ...gameState } })

      // Continue advancing to the next turn after discards are complete
      advanceToNextInteractivePhase()
    }

    toast.success(`Discarded ${cardIds.length} card${cardIds.length > 1 ? "s" : ""}`)
  }

  const handleModalSpellConfirm = (selectedModes: number[]) => {
    if (!modalSpellData) return
    const card = gameState.entities[modalSpellData.card]

    // TODO: Cast spell with selected modes
    // For now, just cast the spell (backend will need to be updated)
    const success = castSpell(humanPlayerId, modalSpellData.card)
    if (success) {
      toast.success(`${card.name} cast (${selectedModes.length} mode${selectedModes.length > 1 ? "s" : ""})`)
      setSelectedCard(null)
      setModalSpellData(null)
    } else {
      toast.error("Cannot cast spell")
    }
  }

  const handleLibrarySearchSelect = (cardId: string) => {
    if (!librarySearchData) return
    const spell = gameState.entities[librarySearchData.card]

    // TODO: Cast spell with selected card from library
    // For now, just cast the spell (backend will need to be updated)
    const success = castSpell(humanPlayerId, librarySearchData.card)
    if (success) {
      toast.success(`${spell.name} cast - selected ${gameState.entities[cardId].name}`)
      setSelectedCard(null)
      setLibrarySearchData(null)
    } else {
      toast.error("Cannot cast spell")
    }
  }

  const handleLibrarySearchDecline = () => {
    if (!librarySearchData) return
    const spell = gameState.entities[librarySearchData.card]

    // Cast spell without selecting a card (fail to find)
    const success = castSpell(humanPlayerId, librarySearchData.card)
    if (success) {
      toast.info(`${spell.name} - No card selected`)
      setSelectedCard(null)
      setLibrarySearchData(null)
    }
  }

  const handleSpellTargetsConfirm = (targetIds: string[]) => {
    if (!spellTargetData) return
    const spell = gameState.entities[spellTargetData.card]

    // TODO: Cast spell with selected targets
    // For now, just cast the spell (backend will need to be updated)
    const success = castSpell(humanPlayerId, spellTargetData.card)
    if (success) {
      toast.success(`${spell.name} cast - ${targetIds.length} target${targetIds.length > 1 ? "s" : ""}`)
      setSelectedCard(null)
      setSpellTargetData(null)
    } else {
      toast.error("Cannot cast spell")
    }
  }

  const selectedCardData = selectedCard ? gameState.entities[selectedCard] : null

  // Get battlefield cards by controller
  const humanBattlefield = gameState.battlefield.filter(
    (id) => gameState.entities[id].controllerId === humanPlayerId,
  )
  const botBattlefield = gameState.battlefield.filter((id) => gameState.entities[id].controllerId === botPlayerId)

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined }}
    >
      {/* Turn/Phase Badge - Centered on Division */}
      <div className="absolute top-[30%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
        <Badge variant="outline" className="text-white px-4 py-2 text-sm bg-gray-900/80 backdrop-blur-md border-2 border-gray-600 shadow-xl">
          Turn {gameState.turnState.turnNumber} - {phase.replace(/_/g, " ")} - {isHumanTurn ? "Your Turn" : "Bot's Turn"}
        </Badge>
      </div>

      {/* Blocking Prompt */}
      {phase === "DECLARE_BLOCKERS" && !isHumanTurn && gameState.combat && gameState.combat.attackers.length > 0 && (
        <div className="absolute top-[35%] left-1/2 transform -translate-x-1/2 z-50">
          <Badge className="text-white px-6 py-3 text-lg bg-red-600/90 backdrop-blur-md border-2 border-red-400 shadow-xl animate-pulse">
            ⚔️ DECLARE BLOCKERS! Click your creatures to block!
          </Badge>
        </div>
      )}

      {/* Top Section - Bot Player Area (30%) */}
      <div className={cn(
        "h-[30%] border-b flex gap-4 p-4 transition-all duration-300",
        !isHumanTurn
          ? "bg-red-950/30 border-red-500 shadow-lg shadow-red-500/30"
          : "bg-red-950/10 border-gray-700"
      )}>
        {/* Left: Bot Stats Panel (256px) */}
        <div className="w-[256px] flex flex-col gap-2">
          <div className="mt-auto flex flex-col gap-2">
            {/* Bot Library */}
            <div className="flex items-center gap-2">
              <span className="text-white text-sm">📚</span>
              <span className="text-white text-xs font-bold">Library</span>
              <Badge variant="secondary">{botPlayer.library.length}</Badge>
            </div>

            {/* Bot Exile */}
            <div className="flex items-center gap-2">
              <span className="text-white text-sm">⚡</span>
              <span className="text-white text-xs font-bold">Exile</span>
              <Badge variant="secondary">{gameState.exile.filter((id) => gameState.entities[id].controllerId === botPlayerId).length}</Badge>
            </div>

            {/* Bot Graveyard */}
            <div className="flex items-center gap-2">
              <span className="text-white text-sm">💀</span>
              <span className="text-white text-xs font-bold">Graveyard</span>
              <Badge variant="secondary">{botPlayer.graveyard.length}</Badge>
            </div>

            {/* Bot Commander Zone */}
            {botPlayer.commandZone.length > 0 && (
              <div className="bg-purple-900/30 backdrop-blur-md p-2 rounded border border-purple-500">
                <div className="flex gap-2">
                  {/* Left: Card */}
                  <div className="w-16 flex-shrink-0">
                    <GameCard card={gameState.entities[botPlayer.commandZone[0]]} size="small" showDetails={false} />
                  </div>
                  {/* Right: Details */}
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <p className="text-[8px] text-purple-300 font-bold mb-0.5">👑 COMMANDER</p>
                    <p className="text-[9px] text-white font-semibold truncate leading-tight">
                      {gameState.entities[botPlayer.commandZone[0]].name}
                    </p>
                    <p className="text-[8px] text-purple-200 truncate leading-tight">
                      {gameState.entities[botPlayer.commandZone[0]].manaCost}
                    </p>
                    {botPlayer.commanderTax > 0 && (
                      <p className="text-[8px] text-yellow-400 font-bold mt-0.5">
                        Tax: +{botPlayer.commanderTax * 2}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bot Name */}
            <div className="bg-gray-900/50 backdrop-blur-md p-2 rounded-lg border border-gray-700">
              <p className="text-white font-bold text-sm">{botPlayer.name}</p>
            </div>
          </div>
        </div>

        {/* Center: Bot Battlefield (flex-1) */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            {/* Bot Hand - Overlapping Cards */}
            <div className="flex items-center gap-2">
              <div className="relative h-12 flex items-center" style={{ width: `${Math.min(botPlayer.hand.length * 8 + 32, 120)}px` }}>
                {botPlayer.hand.length > 0 ? (
                  <>
                    {Array.from({ length: Math.min(botPlayer.hand.length, 10) }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-8 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded border border-gray-600 shadow-md"
                        style={{ left: `${i * 8}px`, zIndex: i }}
                      />
                    ))}
                    {botPlayer.hand.length > 10 && (
                      <span className="absolute right-0 text-white text-xs font-bold bg-black/70 backdrop-blur-sm px-1 rounded" style={{ zIndex: 11 }}>
                        +{botPlayer.hand.length - 10}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-white/50 text-xs">No cards</span>
                )}
              </div>
              <Badge variant="secondary" className="text-xs">{botPlayer.hand.length}</Badge>
            </div>
          </div>

          {/* Bot Battlefield Grid (8 columns) */}
          <div className="flex-1 grid grid-cols-8 gap-1 overflow-y-auto">
            {botBattlefield.map((cardId) => {
              const card = gameState.entities[cardId]
              const isAttacker = attackingCards.includes(cardId)
              const canBeBlocked = phase === "DECLARE_BLOCKERS" && !isHumanTurn && gameState.combat && isAttacker

              return (
                <div
                  key={cardId}
                  className={cn(
                    "aspect-[2.5/3.5]",
                    canBeBlocked && "ring-2 ring-red-500 rounded animate-pulse cursor-pointer"
                  )}
                >
                  <GameCard
                    card={card}
                    size="small"
                    isAttacking={isAttacker}
                    onClick={canBeBlocked ? () => handleCardClick(cardId) : undefined}
                    selectable={canBeBlocked}
                    selected={selectedCard === cardId}
                  />
                </div>
              )
            })}
          </div>

          <div className="text-xs text-white/60">
            {botBattlefield.filter((id) => gameState.entities[id].typeLine.toLowerCase().includes("land")).length} lands,{" "}
            {botBattlefield.filter((id) => gameState.entities[id].typeLine.toLowerCase().includes("creature")).length} creatures
          </div>
        </div>

        {/* Right: Bot Stats (288px) */}
        <div className="w-[288px] flex flex-col gap-2">
          <div className="mt-auto flex flex-col gap-2">
            {/* Bot Mana Pool */}
            <div className="bg-gray-900/50 backdrop-blur-md p-3 rounded-lg border border-gray-700">
              <p className="text-sm text-white font-bold mb-2">Mana Pool</p>
              <ManaPoolDisplay manaPool={botPlayer.manaPool} size="sm" />
            </div>

            {/* Bot Life Total */}
            <div className={cn(
              "p-3 rounded-lg border-2 text-center transition-all",
              botPlayer.life > 25 && "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/50",
              botPlayer.life <= 25 && botPlayer.life > 10 && "bg-yellow-500/20 border-yellow-500 shadow-lg shadow-yellow-500/50",
              botPlayer.life <= 10 && "bg-red-500/30 border-red-500 shadow-lg shadow-red-500/50 animate-pulse"
            )}>
              <p className="text-xs text-white mb-1">Life Total</p>
              <div className={cn(
                "text-2xl font-bold",
                botPlayer.life > 25 && "text-green-400",
                botPlayer.life <= 25 && botPlayer.life > 10 && "text-yellow-400",
                botPlayer.life <= 10 && "text-red-400"
              )}>
                {botPlayer.life}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section - Main Play Area (70%) */}
      <div className={cn(
        "h-[70%] flex gap-4 p-4 overflow-hidden transition-all duration-300",
        isHumanTurn
          ? "bg-blue-950/20 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20"
          : "bg-transparent"
      )}>
        {/* Left Sidebar (256px) */}
        <div className="w-[256px] flex flex-col gap-4">
          {/* Player Name - Top */}
          <div className="bg-gray-900/50 backdrop-blur-md p-2 rounded-lg border border-gray-700">
            <p className="text-white font-bold text-sm">{humanPlayer.name}</p>
            {humanPlayer.flags.landsPlayedThisTurn > 0 && (
              <Badge variant="outline" className="mt-1 text-xs">⛰️ Land played</Badge>
            )}
          </div>

          {/* Commander Zone */}
          {humanPlayer.commandZone.length > 0 && (
            <div className="bg-purple-900/30 backdrop-blur-md p-2 rounded border border-purple-500">
              <div className="flex gap-2">
                {/* Left: Card */}
                <div className="w-20 flex-shrink-0">
                  <GameCard card={gameState.entities[humanPlayer.commandZone[0]]} size="small" showDetails={false} />
                </div>
                {/* Right: Details */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <p className="text-[9px] text-purple-300 font-bold mb-0.5">👑 COMMANDER</p>
                    <p className="text-[10px] text-white font-semibold truncate leading-tight">
                      {gameState.entities[humanPlayer.commandZone[0]].name}
                    </p>
                    <p className="text-[9px] text-purple-200 truncate leading-tight mb-1">
                      {gameState.entities[humanPlayer.commandZone[0]].manaCost}
                    </p>
                    {humanPlayer.commanderTax > 0 && (
                      <p className="text-[9px] text-yellow-400 font-bold">
                        Tax: +{humanPlayer.commanderTax * 2}
                      </p>
                    )}
                  </div>
                  {isHumanTurn && (phase === "MAIN_1" || phase === "MAIN_2") && (
                    <Button
                      onClick={handleCastCommander}
                      size="sm"
                      variant="secondary"
                      className="text-[9px] px-2 py-1 h-auto w-full mt-1"
                    >
                      Cast
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Graveyard */}
          <div className="bg-gray-900/50 backdrop-blur-md p-3 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white text-lg">💀</span>
              <p className="text-sm text-white font-bold">Graveyard</p>
              <Badge variant="secondary">{humanPlayer.graveyard.length}</Badge>
            </div>
            {humanPlayer.graveyard.length > 0 && (
              <div className="w-full aspect-[2.5/3.5]">
                <GameCard card={gameState.entities[humanPlayer.graveyard[humanPlayer.graveyard.length - 1]]} size="small" />
              </div>
            )}
          </div>

          {/* Exile */}
          <div className="bg-gray-900/50 backdrop-blur-md p-3 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-white text-lg">⚡</span>
              <p className="text-sm text-white font-bold">Exile</p>
              <Badge variant="secondary">{gameState.exile.filter((id) => gameState.entities[id].controllerId === humanPlayerId).length}</Badge>
            </div>
          </div>

          {/* Library */}
          <div className="bg-gray-900/50 backdrop-blur-md p-3 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-white text-lg">📚</span>
              <p className="text-sm text-white font-bold">Library</p>
              <Badge variant="secondary">{humanPlayer.library.length}</Badge>
            </div>
          </div>
        </div>

        {/* Center Area (flex-1) */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Battlefield - Split into Non-Lands (top) and Lands (bottom) */}
          <div className="flex-1 flex flex-col gap-2 bg-blue-950/20 backdrop-blur-md p-4 rounded-lg border border-blue-900/50 overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white font-bold">Battlefield</p>
              <div className="text-xs text-white/60">
                {humanBattlefield.filter((id) => gameState.entities[id].typeLine.toLowerCase().includes("land")).length} lands,{" "}
                {humanBattlefield.filter((id) => gameState.entities[id].typeLine.toLowerCase().includes("creature")).length} creatures,{" "}
                {humanBattlefield.filter((id) => !gameState.entities[id].typeLine.toLowerCase().includes("land") && !gameState.entities[id].typeLine.toLowerCase().includes("creature")).length} other
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              {/* Creatures & Other Permanents */}
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                <p className="text-xs text-white/60">Creatures & Other Permanents</p>
                <div className="flex-1 grid grid-cols-8 gap-2 overflow-y-auto">
                  {humanBattlefield
                    .filter((id) => {
                      const typeLine = gameState.entities[id].typeLine.toLowerCase()
                      return !typeLine.includes("land") && !typeLine.includes("enchantment")
                    })
                    .map((cardId) => {
                      const card = gameState.entities[cardId]
                      const canBlock = phase === "DECLARE_BLOCKERS" && !isHumanTurn && gameState.combat && gameState.combat.attackers.length > 0
                      const isValidBlocker = canBlock && card.typeLine.toLowerCase().includes("creature") && !card.tapped
                      return (
                        <div key={cardId} className={cn(
                          "aspect-[2.5/3.5]",
                          isValidBlocker && "ring-2 ring-green-500 rounded animate-pulse"
                        )}>
                          <GameCard
                            card={card}
                            size="small"
                            onClick={() => handleCardClick(cardId)}
                            selectable={isHumanTurn || canBlock}
                            selected={selectedCard === cardId || attackers.includes(cardId)}
                            isAttacking={attackingCards.includes(cardId)}
                          />
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Enchantments */}
              <div className="flex-[0.4] flex flex-col gap-1 overflow-hidden border-t border-blue-900/50 pt-2">
                <p className="text-xs text-white/60">Enchantments</p>
                <div className="flex-1 grid grid-cols-8 gap-2 overflow-y-auto">
                  {humanBattlefield
                    .filter((id) => gameState.entities[id].typeLine.toLowerCase().includes("enchantment"))
                    .map((cardId) => {
                      const canBlock = phase === "DECLARE_BLOCKERS" && !isHumanTurn && gameState.combat && gameState.combat.attackers.length > 0
                      return (
                        <div key={cardId} className="aspect-[2.5/3.5]">
                          <GameCard
                            card={gameState.entities[cardId]}
                            size="small"
                            onClick={() => handleCardClick(cardId)}
                            selectable={isHumanTurn || canBlock}
                            selected={selectedCard === cardId || attackers.includes(cardId)}
                            isAttacking={attackingCards.includes(cardId)}
                          />
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Lands */}
              <div className="flex-[0.25] flex flex-col gap-1 border-t border-blue-900/50 pt-2">
                <p className="text-xs text-white/60">Lands</p>
                <div className="flex-1 grid grid-cols-12 gap-1 overflow-y-auto">
                  {humanBattlefield
                    .filter((id) => gameState.entities[id].typeLine.toLowerCase().includes("land"))
                    .map((cardId) => {
                      const canBlock = phase === "DECLARE_BLOCKERS" && !isHumanTurn && gameState.combat && gameState.combat.attackers.length > 0
                      return (
                        <div key={cardId} className="aspect-square">
                          <GameCard
                            card={gameState.entities[cardId]}
                            size="small"
                            onClick={() => handleCardClick(cardId)}
                            selectable={isHumanTurn || canBlock}
                            selected={selectedCard === cardId || attackers.includes(cardId)}
                            isAttacking={attackingCards.includes(cardId)}
                            previewAbove={true}
                          />
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* Hand (256px height) */}
          <div className="h-[256px] bg-gray-900/50 backdrop-blur-md p-3 rounded-lg border border-gray-700">
            <p className="text-sm text-white mb-2">Hand ({humanPlayer.hand.length})</p>
            <div className="flex gap-2 overflow-x-auto h-full">
              {humanPlayer.hand.map((cardId) => {
                const card = gameState.entities[cardId]
                const playable = isCardPlayable(card, gameState, humanPlayerId, phase)
                const isLand = isLandPlayable(card, humanPlayer)

                return (
                  <div key={cardId} className="h-full aspect-[2.5/3.5] flex-shrink-0">
                    <GameCard
                      card={card}
                      size="medium"
                      onClick={() => handleCardClick(cardId)}
                      selectable={isHumanTurn}
                      selected={selectedCard === cardId}
                      playable={playable && isHumanTurn && !isLand}
                      isLand={isLand && isHumanTurn}
                      previewAbove={true}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected Card Actions */}
          {selectedCardData && isHumanTurn && (
            <div className="bg-black/80 backdrop-blur-md p-3 rounded-lg border border-primary">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-white font-semibold">{selectedCardData.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCardData.typeLine}</p>
                  <p className="text-sm text-muted-foreground">Mana Cost: {selectedCardData.manaCost || "None"}</p>
                </div>
                <div className="flex gap-2">
                  {selectedCardData.zone === "HAND" && selectedCardData.typeLine.toLowerCase().includes("land") && (
                    <Button onClick={handlePlayLand} variant="default" size="sm">
                      <Play className="mr-2 h-4 w-4" />
                      Play Land
                    </Button>
                  )}
                  {selectedCardData.zone === "HAND" && !selectedCardData.typeLine.toLowerCase().includes("land") && (
                    <Button onClick={handleCastSpell} variant="default" size="sm">
                      <Play className="mr-2 h-4 w-4" />
                      Cast Spell
                    </Button>
                  )}
                  {selectedCardData.zone === "BATTLEFIELD" &&
                    selectedCardData.typeLine.toLowerCase().includes("land") &&
                    !selectedCardData.tapped && (
                      <Button onClick={handleTapForMana} variant="default" size="sm">
                        Tap for Mana
                      </Button>
                    )}
                  {/* Activated Abilities */}
                  {selectedCardData.zone === "BATTLEFIELD" &&
                    parseActivatedAbilities(selectedCardData.oracleText || "", selectedCardData.name).map((ability, idx) => {
                      const costParts = []
                      if (ability.cost.tap) costParts.push("{T}")
                      if (ability.cost.mana) costParts.push(ability.cost.mana)
                      if (ability.cost.sacrifice) costParts.push("Sacrifice")
                      if (ability.cost.discardCount) costParts.push(`Discard ${ability.cost.discardCount}`)
                      
                      const costText = costParts.join(", ")
                      const effectText = ability.effect.replace(/_/g, " ")
                      
                      return (
                        <Button
                          key={idx}
                          onClick={() => {
                            const success = activateAbility(humanPlayerId, selectedCard!, idx)
                            if (success) {
                              toast.success(`Activated ${effectText}`)
                            } else {
                              toast.error(`Cannot activate ability`)
                            }
                          }}
                          variant="secondary"
                          size="sm"
                          disabled={selectedCardData.tapped && ability.cost.tap}
                          title={`${costText}: ${effectText}${ability.amount ? ` (${ability.amount})` : ""}`}
                        >
                          ⚡ {costText}
                        </Button>
                      )
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar (288px) */}
        <div className="w-[288px] flex flex-col gap-4">
          {/* Life Total */}
          <div className={cn(
            "p-3 rounded-lg border-2 text-center transition-all",
            humanPlayer.life > 25 && "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/50",
            humanPlayer.life <= 25 && humanPlayer.life > 10 && "bg-yellow-500/20 border-yellow-500 shadow-lg shadow-yellow-500/50",
            humanPlayer.life <= 10 && "bg-red-500/30 border-red-500 shadow-lg shadow-red-500/50 animate-pulse"
          )}>
            <p className="text-xs text-white mb-1">Life Total</p>
            <div className={cn(
              "text-2xl font-bold",
              humanPlayer.life > 25 && "text-green-400",
              humanPlayer.life <= 25 && humanPlayer.life > 10 && "text-yellow-400",
              humanPlayer.life <= 10 && "text-red-400"
            )}>
              {humanPlayer.life}
            </div>
          </div>

          {/* Commander Damage */}
          <div className="bg-gray-900/50 backdrop-blur-md p-3 rounded-lg border border-gray-700">
            <p className="text-sm text-white font-bold mb-2">⚔️ Commander Damage</p>
            <div className="space-y-2">
              {Object.entries(humanPlayer.commanderDamageTaken).map(([commanderId, damage]) => (
                <div key={commanderId} className="flex items-center justify-between text-sm">
                  <span className="text-white/80">{gameState.entities[commanderId]?.name || "Commander"}</span>
                  <Badge variant="destructive">{damage}</Badge>
                </div>
              ))}
              {Object.keys(humanPlayer.commanderDamageTaken).length === 0 && (
                <p className="text-xs text-white/40">No damage taken</p>
              )}
            </div>
          </div>

          {/* The Stack */}
          {gameState.turnState.stack.length > 0 && (
            <div className="bg-purple-900/30 backdrop-blur-md p-3 rounded-lg border border-purple-500">
              <p className="text-sm text-white font-bold mb-2">🔮 The Stack ({gameState.turnState.stack.length})</p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {[...gameState.turnState.stack].reverse().map((item, index) => (
                  <div key={item.id} className="bg-purple-800/40 p-2 rounded border border-purple-400 text-xs">
                    <p className="text-white font-semibold">{item.cardName}</p>
                    <p className="text-purple-200 text-[10px]">
                      by {gameState.players[item.controllerId].name}
                    </p>
                    {index === 0 && (
                      <Badge variant="default" className="bg-yellow-500 text-black text-[8px] mt-1">
                        RESOLVES NEXT
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Priority Indicator & Pass Button */}
          {gameState.turnState.waitingForPriority && gameState.turnState.priorityPlayerId === humanPlayerId && (
            <div className="bg-yellow-900/30 backdrop-blur-md p-3 rounded-lg border border-yellow-500">
              <p className="text-sm text-yellow-300 font-bold mb-2">⚡ You have priority</p>
              <Button
                onClick={() => {
                  passPriority()
                  toast.info("Priority passed")
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Pass Priority
              </Button>
              <p className="text-[10px] text-yellow-200 mt-2">
                Cast instants or pass to let the stack resolve
              </p>
            </div>
          )}

          {/* Mana Pool */}
          <div className="bg-gray-900/50 backdrop-blur-md p-3 rounded-lg border border-gray-700">
            <p className="text-sm text-white font-bold mb-2">Mana Pool</p>
            <ManaPoolDisplay manaPool={humanPlayer.manaPool} size="md" />
          </div>

          {/* Separator */}
          <div className="border-t border-gray-600 my-2"></div>

          {/* Combat action buttons */}
          {/* Attack button only on player's turn during DECLARE_ATTACKERS */}
          {isHumanTurn && phase === "DECLARE_ATTACKERS" && (
            <Button onClick={handleDeclareAttackers} disabled={attackers.length === 0} size="default" className="w-full">
              <Swords className="mr-2 h-4 w-4" />
              Attack ({attackers.length})
            </Button>
          )}

          {/* Block button on opponent's turn during DECLARE_BLOCKERS */}
          {!isHumanTurn && phase === "DECLARE_BLOCKERS" && gameState.combat && (
            <Button onClick={handleDeclareBlockers} size="default" className="w-full">
              <Swords className="mr-2 h-4 w-4" />
              Block ({Object.keys(blockerMap).length})
            </Button>
          )}

          {/* Phase Control Buttons */}
          {isHumanTurn && (
            <div className="flex flex-col gap-2 mt-auto">
              <Button onClick={advancePhase} variant="outline" size="sm" className="w-full">
                <SkipForward className="mr-2 h-4 w-4" />
                Next Phase
              </Button>
              <Button onClick={endTurn} variant="default" size="sm" className="w-full">
                End Turn
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Game Over Overlay */}
      {gameState.status === "ENDED" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="bg-black/90 backdrop-blur-md border-yellow-500">
            <CardContent className="pt-6 text-center">
              <h2 className="text-3xl font-bold text-yellow-500 mb-2">Game Over!</h2>
              <p className="text-white text-xl">
                {gameState.winner === humanPlayerId ? "You Win!" : "Bot Wins!"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mana Choice Dialog */}
      {manaChoiceCard && (
        <ManaChoiceDialog
          open={manaChoiceOpen}
          onOpenChange={setManaChoiceOpen}
          options={parseLandManaOptions(
            gameState.entities[manaChoiceCard].oracleText || "",
            gameState.entities[manaChoiceCard].name,
            gameState,
            humanPlayerId,
          )}
          landName={gameState.entities[manaChoiceCard].name}
          onChoose={handleManaChoice}
        />
      )}

      {/* X Value Dialog */}
      {xValueCard && (
        <XValueDialog
          open={xValueDialogOpen}
          onOpenChange={setXValueDialogOpen}
          cardName={gameState.entities[xValueCard].name}
          manaCost={gameState.entities[xValueCard].manaCost}
          availableMana={humanPlayer.manaPool}
          onChoose={handleXValueChoice}
        />
      )}

      {/* Discard Dialog */}
      <DiscardDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        hand={humanPlayer.hand.map((cardId) => gameState.entities[cardId])}
        discardCount={humanPlayer.pendingDiscards}
        onDiscard={handleDiscard}
      />

      {/* Phase 2: Trigger Target Selection Dialog */}
      {gameState.triggerQueue.length > 0 &&
        gameState.triggerQueue.some((t) => t.requiresTarget && !t.resolved && t.effect !== "proliferate" && t.effect !== "support") && (
          <TriggerTargetDialog
            trigger={
              gameState.triggerQueue.find((t) => t.requiresTarget && !t.resolved && t.effect !== "proliferate" && t.effect !== "support") || null
            }
            sourceCard={
              gameState.triggerQueue.find((t) => t.requiresTarget && !t.resolved && t.effect !== "proliferate" && t.effect !== "support")
                ? gameState.entities[
                    gameState.triggerQueue.find((t) => t.requiresTarget && !t.resolved && t.effect !== "proliferate" && t.effect !== "support")!
                      .sourceCardId
                  ]
                : null
            }
            validTargets={
              gameState.triggerQueue
                .find((t) => t.requiresTarget && !t.resolved && t.effect !== "proliferate" && t.effect !== "support")
                ?.validTargets?.map((id) => gameState.entities[id]) || []
            }
            onSelectTarget={(triggerId, targetCardId) => {
              resolveTriggerWithTarget(triggerId, targetCardId)
              toast.success("Trigger resolved")
            }}
            onClose={() => {
              // Can't close without selecting target (for now)
              toast.error("You must select a target")
            }}
          />
        )}

      {/* Phase 3: Proliferate Dialog */}
      {gameState.triggerQueue.length > 0 &&
        gameState.triggerQueue.some((t) => t.effect === "proliferate" && !t.resolved) && (
          <ProliferateDialog
            trigger={gameState.triggerQueue.find((t) => t.effect === "proliferate" && !t.resolved) || null}
            sourceCard={
              gameState.triggerQueue.find((t) => t.effect === "proliferate" && !t.resolved)
                ? gameState.entities[
                    gameState.triggerQueue.find((t) => t.effect === "proliferate" && !t.resolved)!.sourceCardId
                  ]
                : null
            }
            gameState={gameState}
            onConfirm={(triggerId, selectedTargets) => {
              resolveProliferate(triggerId, selectedTargets)
              toast.success(`Proliferated ${selectedTargets.length} target(s)`)
            }}
            onClose={() => {
              // Can close without proliferating (choosing 0 targets is valid)
              const trigger = gameState.triggerQueue.find((t) => t.effect === "proliferate" && !t.resolved)
              if (trigger) {
                resolveProliferate(trigger.id, [])
                toast.info("Proliferate skipped")
              }
            }}
          />
        )}

      {/* Support Dialog - multiple target selection */}
      {gameState.triggerQueue.length > 0 &&
        gameState.triggerQueue.some((t) => t.effect === "support" && !t.resolved) && (
          <SupportTargetDialog
            trigger={gameState.triggerQueue.find((t) => t.effect === "support" && !t.resolved) || null}
            sourceCard={
              gameState.triggerQueue.find((t) => t.effect === "support" && !t.resolved)
                ? gameState.entities[
                    gameState.triggerQueue.find((t) => t.effect === "support" && !t.resolved)!.sourceCardId
                  ]
                : null
            }
            validTargets={
              gameState.triggerQueue
                .find((t) => t.effect === "support" && !t.resolved)
                ?.validTargets?.map((id) => gameState.entities[id]) || []
            }
            onConfirm={(triggerId, selectedTargets) => {
              resolveSupport(triggerId, selectedTargets)
              toast.success(`Added counters to ${selectedTargets.length} target(s)`)
            }}
            onClose={() => {
              // Can close without selecting (choosing 0 targets is valid for support)
              const trigger = gameState.triggerQueue.find((t) => t.effect === "support" && !t.resolved)
              if (trigger) {
                resolveSupport(trigger.id, [])
                toast.info("Support skipped (0 targets)")
              }
            }}
          />
        )}

      {/* Mulligan Dialog - shown at game start in SETUP status */}
      <MulliganDialog
        open={gameState.status === "SETUP" && humanPlayer.mulliganCount === 0}
        hand={humanPlayer.hand.map((id) => gameState.entities[id])}
        mulliganCount={humanPlayer.mulliganCount}
        onMulligan={() => takeMulligan(humanPlayerId)}
        onKeep={keepHand}
      />

      {/* Mulligan Scry Dialog - shown after keeping with mulligans to put cards on bottom */}
      <MulliganScryDialog
        open={gameState.status === "SETUP" && humanPlayer.mulliganCount > 0}
        hand={humanPlayer.hand.map((id) => gameState.entities[id])}
        cardsToBottom={humanPlayer.mulliganCount}
        onConfirm={(cardIds) => putCardsOnBottom(humanPlayerId, cardIds)}
      />

      {/* Scry Dialog - shown when player has scry trigger */}
      {gameState.triggerQueue.length > 0 &&
        gameState.triggerQueue.some((t) => t.effect === "scry" && !t.resolved && t.controllerId === humanPlayerId) && (
          <ScryDialog
            open={true}
            cards={(() => {
              const trigger = gameState.triggerQueue.find((t) => t.effect === "scry" && !t.resolved && t.controllerId === humanPlayerId)
              if (!trigger) return []
              const scryAmount = trigger.amount || 1
              // Get top N cards from library
              return humanPlayer.library
                .slice(-scryAmount)
                .map((id) => gameState.entities[id])
            })()}
            scryAmount={
              gameState.triggerQueue.find((t) => t.effect === "scry" && !t.resolved && t.controllerId === humanPlayerId)
                ?.amount || 1
            }
            onConfirm={(topCards, bottomCards) => {
              const trigger = gameState.triggerQueue.find((t) => t.effect === "scry" && !t.resolved && t.controllerId === humanPlayerId)
              if (trigger) {
                resolveScry(trigger.id, topCards, bottomCards)
                toast.success(`Scry ${trigger.amount || 1} completed`)
              }
            }}
          />
        )}

      {/* Modal Spell Dialog */}
      {modalSpellData && (
        <ModalSpellDialog
          open={modalSpellOpen}
          onOpenChange={setModalSpellOpen}
          spellName={gameState.entities[modalSpellData.card].name}
          manaCost={gameState.entities[modalSpellData.card].manaCost}
          modalData={modalSpellData.modal}
          onConfirm={handleModalSpellConfirm}
        />
      )}

      {/* Library Search Dialog */}
      {librarySearchData && (
        <LibrarySearchDialog
          open={librarySearchOpen}
          onOpenChange={setLibrarySearchOpen}
          spellName={gameState.entities[librarySearchData.card].name}
          searchableCards={(() => {
            const effect = librarySearchData.effect
            const player = gameState.players[humanPlayerId]

            // Filter library based on search criteria
            return player.library
              .map(id => gameState.entities[id])
              .filter(card => {
                const types = effect.search?.cardType || []
                const typeLine = card.typeLine.toLowerCase()

                return types.some(type => {
                  const t = type.toLowerCase()
                  return typeLine.includes(t) || (t === "land" && typeLine.includes("land"))
                })
              })
          })()}
          searchPrompt={`Search your library for a ${librarySearchData.effect.search?.cardType?.join(" or ")} card`}
          onSelectCard={handleLibrarySearchSelect}
          onDecline={handleLibrarySearchDecline}
        />
      )}

      {/* Spell Target Dialog */}
      {spellTargetData && (
        <SpellTargetDialog
          open={spellTargetOpen}
          onOpenChange={setSpellTargetOpen}
          spellName={gameState.entities[spellTargetData.card].name}
          targetPrompt={`Choose ${spellTargetData.effect.targets?.count ? `up to ${spellTargetData.effect.targets.count}` : ""} target ${spellTargetData.effect.targets?.type?.join(" or ")}`}
          validTargets={(() => {
            const effect = spellTargetData.effect
            const targetTypes = effect.targets?.type || []

            return gameState.battlefield
              .map(id => gameState.entities[id])
              .filter(card => {
                // Check if matches target type
                if (targetTypes.length > 0) {
                  const typeLine = card.typeLine.toLowerCase()
                  if (!targetTypes.some(t => typeLine.includes(t.toLowerCase()))) {
                    return false
                  }
                }

                // Check restriction
                if (effect.counters?.type === "shield") {
                  // Shield counters on creatures
                  return card.controllerId === humanPlayerId && card.typeLine.toLowerCase().includes("creature")
                }

                return true
              })
          })()}
          minTargets={spellTargetData.effect.targets?.count ? 0 : 1}
          maxTargets={spellTargetData.effect.targets?.count || 1}
          onConfirm={handleSpellTargetsConfirm}
        />
      )}

      {/* Game Log Viewer FAB */}
      <GameLogViewer gameLog={gameState.gameLog} gameState={gameState} />
    </div>
  )
}
