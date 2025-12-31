"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface DeckImportDialogProps {
  deckId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeckImportDialog({ deckId, open, onOpenChange }: DeckImportDialogProps) {
  const [deckListText, setDeckListText] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [clearExisting, setClearExisting] = useState(false)
  const router = useRouter()

  const handleImport = async () => {
    if (!deckListText.trim()) {
      alert("Please paste a deck list")
      return
    }

    setIsImporting(true)
    try {
      const response = await fetch(`/api/decks/${deckId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckListText,
          clearExisting,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to import deck")
      }

      // Show results
      let message = data.message

      if (data.results.failed.length > 0) {
        message += `\n\nFailed to import:\n${data.results.failed.join("\n")}`
      }

      alert(message)
      setDeckListText("")
      setClearExisting(false)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Failed to import deck")
    } finally {
      setIsImporting(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setDeckListText(text)
    }
    reader.readAsText(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Deck List</DialogTitle>
          <DialogDescription>
            Paste your deck list or upload a text file. Format: &quot;4 Card Name&quot; or &quot;4x Card Name&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <Label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 border-2 border-dashed rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <FileText className="h-5 w-5" />
                <span className="text-sm">Click to upload a deck list file (.txt)</span>
                <input
                  id="file-upload"
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                />
              </div>
            </Label>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or paste deck list</span>
            </div>
          </div>

          {/* Deck List Text Area */}
          <Textarea
            placeholder={`Example format:\n\n4 Lightning Bolt\n2 Counterspell\n1x Sol Ring\n24 Mountain`}
            value={deckListText}
            onChange={(e) => setDeckListText(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            disabled={isImporting}
          />

          {/* Clear Existing Cards Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="clear-existing"
              checked={clearExisting}
              onCheckedChange={(checked) => setClearExisting(checked as boolean)}
              disabled={isImporting}
            />
            <Label
              htmlFor="clear-existing"
              className="text-sm font-normal cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Clear existing cards before importing
            </Label>
          </div>

          {/* Import Info */}
          <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
            <p className="font-semibold">Import Format:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Each line should be: quantity + card name</li>
              <li>Example: &quot;4 Lightning Bolt&quot; or &quot;4x Lightning Bolt&quot;</li>
              <li>Lines starting with # or // are treated as comments</li>
              <li>Empty lines are ignored</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting || !deckListText.trim()} className="flex-1">
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Deck
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
