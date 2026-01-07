"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import type { ManaPool } from "@/lib/game/types"

interface XValueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cardName: string
  manaCost: string
  availableMana: ManaPool
  onChoose: (xValue: number) => void
}

export function XValueDialog({
  open,
  onOpenChange,
  cardName,
  manaCost,
  availableMana,
  onChoose,
}: XValueDialogProps) {
  const [selectedX, setSelectedX] = useState(0)

  // Calculate total available mana
  const totalMana =
    availableMana.W +
    availableMana.U +
    availableMana.B +
    availableMana.R +
    availableMana.G +
    availableMana.C

  // Count how many {X} symbols in the mana cost
  const xCount = (manaCost.match(/{X}/gi) || []).length

  // Calculate max X based on available mana and number of X symbols
  // For {X}{X}, if you want X=3, you need to pay 6 mana total
  const maxX = Math.floor(totalMana / xCount)

  // Generate X value options (0 to maxX)
  const xOptions = Array.from({ length: maxX + 1 }, (_, i) => i)

  const handleConfirm = () => {
    onChoose(selectedX)
    onOpenChange(false)
    setSelectedX(0)
  }

  const handleCancel = () => {
    onOpenChange(false)
    setSelectedX(0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose X Value</DialogTitle>
          <DialogDescription>
            Choose how much mana to spend on X for {cardName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Card Info */}
          <div className="bg-secondary/20 p-3 rounded-lg">
            <p className="text-sm font-semibold">{cardName}</p>
            <p className="text-xs text-muted-foreground">Mana Cost: {manaCost}</p>
            {xCount > 1 && (
              <p className="text-xs text-yellow-500 mt-1">
                ⚠️ This spell has {xCount} X symbols. Total cost for X={selectedX} is {selectedX * xCount} mana.
              </p>
            )}
          </div>

          {/* Available Mana */}
          <div className="bg-secondary/20 p-3 rounded-lg">
            <p className="text-sm font-semibold mb-2">Available Mana</p>
            <div className="flex gap-2 flex-wrap">
              {availableMana.W > 0 && <Badge variant="outline">⚪ {availableMana.W}</Badge>}
              {availableMana.U > 0 && <Badge variant="outline">🔵 {availableMana.U}</Badge>}
              {availableMana.B > 0 && <Badge variant="outline">⚫ {availableMana.B}</Badge>}
              {availableMana.R > 0 && <Badge variant="outline">🔴 {availableMana.R}</Badge>}
              {availableMana.G > 0 && <Badge variant="outline">🟢 {availableMana.G}</Badge>}
              {availableMana.C > 0 && <Badge variant="outline">◇ {availableMana.C}</Badge>}
              <Badge variant="default">Total: {totalMana}</Badge>
            </div>
          </div>

          {/* X Value Selection */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Select X Value (Max: {maxX})</p>
            <div className="grid grid-cols-5 gap-2">
              {xOptions.map((x) => (
                <Button
                  key={x}
                  variant={selectedX === x ? "default" : "outline"}
                  onClick={() => setSelectedX(x)}
                  className="h-12"
                >
                  {x}
                  {xCount > 1 && (
                    <span className="text-xs ml-1">({x * xCount})</span>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Confirm/Cancel */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              Cast with X={selectedX}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
