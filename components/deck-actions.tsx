"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Upload } from "lucide-react"
import { DeckImportDialog } from "@/components/deck-import-dialog"

interface DeckActionsProps {
  deckId: string
  deckName: string
}

export function DeckActions({ deckId, deckName }: DeckActionsProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const handleExport = () => {
    // Trigger download by navigating to export endpoint
    window.location.href = `/api/decks/${deckId}/export`
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <DeckImportDialog deckId={deckId} open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </>
  )
}
