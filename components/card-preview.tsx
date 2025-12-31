"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CardInstance } from "@/lib/game/types"
import { ManaSymbols } from "@/components/mana-symbols"

interface CardPreviewProps {
  card: CardInstance
  children: React.ReactNode
}

export function CardPreview({ card, children }: CardPreviewProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouseEnter = (e: React.MouseEvent) => {
    setShowPreview(true)
    updatePosition(e)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    updatePosition(e)
  }

  const handleMouseLeave = () => {
    setShowPreview(false)
  }

  const updatePosition = (e: React.MouseEvent) => {
    const offset = 20
    setPosition({
      x: e.clientX + offset,
      y: e.clientY + offset,
    })
  }

  return (
    <>
      <div onMouseEnter={handleMouseEnter} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        {children}
      </div>

      {showPreview && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <Card className="w-80 bg-black/95 border-primary/50 shadow-2xl">
            <CardContent className="p-4 space-y-3">
              {/* Card Image */}
              {card.imageUrl && (
                <img src={card.imageUrl} alt={card.name} className="w-full rounded-lg shadow-lg" />
              )}

              {/* Card Name */}
              <div>
                <h3 className="text-lg font-bold text-white">{card.name}</h3>
                <p className="text-sm text-muted-foreground">{card.typeLine}</p>
              </div>

              {/* Mana Cost */}
              {card.manaCost && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mana Cost:</p>
                  <ManaSymbols manaCost={card.manaCost} size="sm" />
                </div>
              )}

              {/* Oracle Text */}
              {card.oracleText && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Card Text:</p>
                  <p className="text-sm text-white bg-muted/20 p-2 rounded whitespace-pre-wrap">{card.oracleText}</p>
                </div>
              )}

              {/* Power/Toughness */}
              {card.power && card.toughness && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Power / Toughness:</p>
                  <p className="text-lg font-bold text-white">
                    {card.power} / {card.toughness}
                  </p>
                </div>
              )}

              {/* Keywords */}
              {card.keywords && card.keywords.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Keywords:</p>
                  <div className="flex flex-wrap gap-1">
                    {card.keywords.map((keyword, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Indicators */}
              <div className="flex gap-2">
                {card.tapped && <Badge variant="destructive">Tapped</Badge>}
                {card.summoningSick && <Badge variant="outline">Summoning Sick</Badge>}
                {card.counters.p1p1 > 0 && <Badge className="bg-green-600">+{card.counters.p1p1}/+{card.counters.p1p1}</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
