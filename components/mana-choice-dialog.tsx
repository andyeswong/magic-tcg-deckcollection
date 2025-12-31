"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { ManaColor } from "@/lib/game/types"

interface ManaChoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: ManaColor[]
  landName: string
  onChoose: (color: ManaColor) => void
}

export function ManaChoiceDialog({ open, onOpenChange, options, landName, onChoose }: ManaChoiceDialogProps) {
  const colorNames: Record<ManaColor, string> = {
    W: "White",
    U: "Blue",
    B: "Black",
    R: "Red",
    G: "Green",
    C: "Colorless",
  }

  const colorClasses: Record<ManaColor, string> = {
    W: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border-yellow-400",
    U: "bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-400",
    B: "bg-gray-900 hover:bg-gray-800 text-white border-gray-700",
    R: "bg-red-100 hover:bg-red-200 text-red-900 border-red-400",
    G: "bg-green-100 hover:bg-green-200 text-green-900 border-green-400",
    C: "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-400",
  }

  const handleChoice = (color: ManaColor) => {
    onChoose(color)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Mana Color</DialogTitle>
          <DialogDescription>
            {landName} can produce multiple colors of mana. Choose which color to add to your mana pool.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {options.map((color) => (
            <Button
              key={color}
              onClick={() => handleChoice(color)}
              variant="outline"
              className={`h-20 text-lg font-bold border-2 ${colorClasses[color]}`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="text-3xl">{color}</div>
                <div className="text-sm font-normal">{colorNames[color]}</div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
