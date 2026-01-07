"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { SpellEffect } from "@/lib/game/spell-parser"

interface ModalSpellDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spellName: string
  manaCost: string
  modalData: NonNullable<SpellEffect["modal"]>
  onConfirm: (selectedModes: number[]) => void
}

export function ModalSpellDialog({
  open,
  onOpenChange,
  spellName,
  manaCost,
  modalData,
  onConfirm,
}: ModalSpellDialogProps) {
  const [selectedModes, setSelectedModes] = useState<number[]>([])

  const handleToggleMode = (index: number) => {
    if (modalData.chooseCount === "one") {
      // Can only choose one
      setSelectedModes([index])
    } else {
      // Can choose multiple
      if (selectedModes.includes(index)) {
        setSelectedModes(selectedModes.filter(i => i !== index))
      } else {
        setSelectedModes([...selectedModes, index])
      }
    }
  }

  const handleConfirm = () => {
    if (selectedModes.length === 0) return
    onConfirm(selectedModes)
    onOpenChange(false)
    setSelectedModes([])
  }

  const canConfirm = selectedModes.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{spellName}</DialogTitle>
          <DialogDescription>
            <span className="text-base font-mono">{manaCost}</span>
            {modalData.escalate && (
              <Badge variant="outline" className="ml-2">
                Escalate: {modalData.escalate}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {modalData.chooseCount === "one" && "Choose one:"}
            {modalData.chooseCount === "one or more" && "Choose one or more:"}
            {modalData.chooseCount === "all" && "All modes are chosen:"}
          </p>

          <div className="space-y-3">
            {modalData.modes.map((mode, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedModes.includes(index)
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border hover:border-primary/50"
                }`}
                onClick={() => handleToggleMode(index)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedModes.includes(index)}
                    onCheckedChange={() => handleToggleMode(index)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-relaxed">{mode.description}</p>
                    {modalData.escalate && index > 0 && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        Additional cost: {modalData.escalate}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {modalData.escalate && selectedModes.length > 1 && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3">
              <p className="text-sm text-yellow-300">
                ⚠️ Escalate cost: You must pay <strong>{modalData.escalate}</strong> for each additional mode beyond the first.
                <br />
                Total additional modes: <strong>{selectedModes.length - 1}</strong>
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setSelectedModes([])
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              Confirm {selectedModes.length > 0 && `(${selectedModes.length} mode${selectedModes.length > 1 ? "s" : ""})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
