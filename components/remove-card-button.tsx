"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function RemoveCardButton({
  deckId,
  cardId,
  onRemove,
}: {
  deckId: string
  cardId: string
  onRemove?: () => void
}) {
  const [isRemoving, setIsRemoving] = useState(false)
  const router = useRouter()

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setIsRemoving(true)
    try {
      const response = await fetch(`/api/deck-cards/${cardId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to remove card")

      onRemove?.()
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to remove card")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Button size="icon" variant="destructive" onClick={handleRemove} disabled={isRemoving} className="h-8 w-8">
      {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
    </Button>
  )
}
