"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CardPreview } from "@/components/card-preview"
import type { CardInstance } from "@/lib/game/types"
import { getCurrentStats, hasKeyword } from "@/lib/game/card-effects"
import { cn } from "@/lib/utils"

interface GameCardProps {
  card: CardInstance
  onClick?: () => void
  selectable?: boolean
  selected?: boolean
  showDetails?: boolean
  size?: "small" | "medium" | "large"
  playable?: boolean // Card can be played with current mana
  isLand?: boolean // Card is a land and can be played this turn
  isAttacking?: boolean // Card is currently attacking
  previewAbove?: boolean // Show preview above the card (for hand cards at bottom)
}

export function GameCard({
  card,
  onClick,
  selectable,
  selected,
  showDetails = true,
  size = "medium",
  playable = false,
  isLand = false,
  isAttacking = false,
  previewAbove = false,
}: GameCardProps) {
  const sizeClasses = {
    small: "w-16 h-24",
    medium: "w-32 h-48",
    large: "w-48 h-72",
  }

  // Get current power/toughness including counters
  const isCreature = card.typeLine.toLowerCase().includes("creature")
  const stats = isCreature ? getCurrentStats(card) : null

  return (
    <CardPreview card={card} showAbove={previewAbove}>
      <Card
        className={cn(
          "relative overflow-hidden transition-all",
          sizeClasses[size],
          card.tapped && "rotate-90",
          selectable && "cursor-pointer hover:ring-2 hover:ring-primary",
          selected && "ring-2 ring-primary",
          card.summoningSick && "opacity-70",
          playable && !selected && "ring-2 ring-green-500 shadow-lg shadow-green-500/50",
          isLand && !selected && "ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse",
          isAttacking && "ring-4 ring-red-500 shadow-lg shadow-red-500/50 animate-pulse",
        )}
        onClick={onClick}
      >
      {/* Card Image */}
      {card.imageUrl ? (
        <img src={card.imageUrl} alt={card.name} className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center p-2">
          <p className="text-white text-xs font-bold text-center">{card.name}</p>
        </div>
      )}

      {/* Tapped Indicator */}
      {card.tapped && (
        <div className="absolute top-1 left-1 bg-red-500 text-white text-xs px-1 rounded">TAP</div>
      )}

      {/* Summoning Sick Indicator */}
      {card.summoningSick && (
        <div className="absolute top-1 right-1 bg-orange-500 text-white text-xs px-1 rounded">SICK</div>
      )}

      {/* Power/Toughness - show modified stats if creature has counters */}
      {showDetails && stats && (
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-sm px-2 py-1 rounded font-bold">
          {stats.power}/{stats.toughness}
          {card.counters.p1p1 > 0 && (
            <span className="text-green-400 ml-0.5 text-xs">+{card.counters.p1p1}</span>
          )}
        </div>
      )}

      {/* +1/+1 Counters Badge */}
      {card.counters.p1p1 > 0 && (
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
          <Badge variant="default" className="bg-green-600 text-xs px-1.5 py-0.5">
            +{card.counters.p1p1}/+{card.counters.p1p1}
          </Badge>
        </div>
      )}

      {/* Loyalty Counters (Planeswalkers) */}
      {card.counters.loyalty > 0 && (
        <div className="absolute bottom-1 right-1 bg-purple-600 text-white text-lg px-2 py-1 rounded font-bold">
          {card.counters.loyalty}
        </div>
      )}

      {/* Charge Counters */}
      {card.counters.charge > 0 && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
          <Badge variant="default" className="bg-blue-600 text-xs px-1.5 py-0.5">
            ⚡{card.counters.charge}
          </Badge>
        </div>
      )}

      {/* Shield Counters */}
      {card.counters.shield > 0 && (
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2">
          <Badge variant="default" className="bg-cyan-500 text-xs px-1.5 py-0.5">
            🛡️{card.counters.shield}
          </Badge>
        </div>
      )}

      {/* Vow Counters */}
      {card.counters.vow > 0 && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2">
          <Badge variant="default" className="bg-amber-600 text-xs px-1.5 py-0.5">
            🤝{card.counters.vow}
          </Badge>
        </div>
      )}

      {/* Flying Keyword */}
      {hasKeyword(card, "flying") && (
        <div className="absolute top-1 left-1">
          <Badge variant="default" className="bg-sky-500 text-white text-xs px-1.5 py-0.5 font-semibold">
            ✈
          </Badge>
        </div>
      )}

      {/* Other Combat Keywords - stacked vertically on left side */}
      <div className="absolute top-8 left-1 flex flex-col gap-0.5">
        {hasKeyword(card, "trample") && (
          <Badge variant="default" className="bg-green-700 text-white text-xs px-1.5 py-0.5 font-semibold">
            🦏
          </Badge>
        )}
        {hasKeyword(card, "first strike") && !hasKeyword(card, "double strike") && (
          <Badge variant="default" className="bg-red-600 text-white text-xs px-1.5 py-0.5 font-semibold">
            ⚡
          </Badge>
        )}
        {hasKeyword(card, "double strike") && (
          <Badge variant="default" className="bg-red-700 text-white text-xs px-1.5 py-0.5 font-semibold">
            ⚡⚡
          </Badge>
        )}
        {hasKeyword(card, "lifelink") && (
          <Badge variant="default" className="bg-pink-500 text-white text-xs px-1.5 py-0.5 font-semibold">
            ❤️
          </Badge>
        )}
        {hasKeyword(card, "deathtouch") && (
          <Badge variant="default" className="bg-purple-700 text-white text-xs px-1.5 py-0.5 font-semibold">
            💀
          </Badge>
        )}
        {hasKeyword(card, "menace") && (
          <Badge variant="default" className="bg-orange-600 text-white text-xs px-1.5 py-0.5 font-semibold">
            👹
          </Badge>
        )}
        {hasKeyword(card, "vigilance") && (
          <Badge variant="default" className="bg-yellow-600 text-white text-xs px-1.5 py-0.5 font-semibold">
            👁️
          </Badge>
        )}
        {hasKeyword(card, "reach") && (
          <Badge variant="default" className="bg-teal-600 text-white text-xs px-1.5 py-0.5 font-semibold">
            🕷️
          </Badge>
        )}
        {hasKeyword(card, "haste") && (
          <Badge variant="default" className="bg-red-500 text-white text-xs px-1.5 py-0.5 font-semibold">
            💨
          </Badge>
        )}
      </div>
      </Card>
    </CardPreview>
  )
}
