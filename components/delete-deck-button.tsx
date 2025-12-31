"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function DeleteDeckButton({ deckId }: { deckId: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm("Are you sure you want to delete this deck?")) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/decks/${deckId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete deck")

      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to delete deck")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-destructive hover:text-destructive"
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  )
}
