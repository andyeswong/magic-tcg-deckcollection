"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CardInstance } from "@/lib/game/types"
import { cn } from "@/lib/utils"

interface GameCardProps {
  card: CardInstance
  onClick?: () => void
  selectable?: boolean
  selected?: boolean
  showDetails?: boolean
  size?: "small" | "medium" | "large"
}

export function GameCard({ card, onClick, selectable, selected, showDetails = true, size = "medium" }: GameCardProps) {
  const sizeClasses = {
    small: "w-16 h-24",
    medium: "w-32 h-48",
    large: "w-48 h-72",
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        sizeClasses[size],
        card.tapped && "rotate-90",
        selectable && "cursor-pointer hover:ring-2 hover:ring-primary",
        selected && "ring-2 ring-primary",
        card.summoningSick && "opacity-70",
      )}
      onClick={onClick}
    >
      {/* Card Image */}
      {card.imageUrl ? (
        <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
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

      {/* Power/Toughness */}
      {showDetails && card.power && card.toughness && (
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-sm px-2 py-1 rounded font-bold">
          {card.power}/{card.toughness}
        </div>
      )}

      {/* +1/+1 Counters */}
      {card.counters.p1p1 > 0 && (
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
          <Badge variant="default" className="bg-green-600">
            +{card.counters.p1p1}/+{card.counters.p1p1}
          </Badge>
        </div>
      )}
    </Card>
  )
}
