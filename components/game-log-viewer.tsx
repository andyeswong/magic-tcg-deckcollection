"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { FileText, Download } from "lucide-react"
import type { GameLogEntry } from "@/lib/game/types"
import { exportLogAsText } from "@/lib/game/logger"
import { toast } from "sonner"

interface GameLogViewerProps {
  gameLog: GameLogEntry[]
  gameState: any
}

export function GameLogViewer({ gameLog, gameState }: GameLogViewerProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<GameLogEntry["type"] | "all">("all")

  const filteredLog = filter === "all" 
    ? gameLog 
    : gameLog.filter((entry) => entry.type === filter)

  const handleExport = () => {
    const text = exportLogAsText(gameState)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `game-log-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Game log exported")
  }

  const getTypeColor = (type: GameLogEntry["type"]) => {
    switch (type) {
      case "action":
        return "bg-blue-500"
      case "trigger":
        return "bg-purple-500"
      case "combat":
        return "bg-red-500"
      case "phase":
        return "bg-gray-500"
      case "effect":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getTypeIcon = (type: GameLogEntry["type"]) => {
    switch (type) {
      case "action":
        return "🎯"
      case "trigger":
        return "⚡"
      case "combat":
        return "⚔️"
      case "phase":
        return "🔄"
      case "effect":
        return "✨"
      default:
        return "📝"
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* Floating Action Button */}
        <Button
          size="lg"
          className="fixed bottom-32 right-0 h-14 w-14 rounded-l-full shadow-lg hover:shadow-xl z-50"
          title="View Game Log"
        >
          <FileText className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>Game Log</SheetTitle>
          <SheetDescription>
            Complete match history with all actions, triggers, and combat events
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All ({gameLog.length})
            </Button>
            <Button
              size="sm"
              variant={filter === "action" ? "default" : "outline"}
              onClick={() => setFilter("action")}
            >
              🎯 Actions
            </Button>
            <Button
              size="sm"
              variant={filter === "trigger" ? "default" : "outline"}
              onClick={() => setFilter("trigger")}
            >
              ⚡ Triggers
            </Button>
            <Button
              size="sm"
              variant={filter === "combat" ? "default" : "outline"}
              onClick={() => setFilter("combat")}
            >
              ⚔️ Combat
            </Button>
            <Button
              size="sm"
              variant={filter === "phase" ? "default" : "outline"}
              onClick={() => setFilter("phase")}
            >
              🔄 Phases
            </Button>
            <Button
              size="sm"
              variant={filter === "effect" ? "default" : "outline"}
              onClick={() => setFilter("effect")}
            >
              ✨ Effects
            </Button>
          </div>

          {/* Export Button */}
          <Button onClick={handleExport} variant="outline" className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Export Log
          </Button>

          <Separator />

          {/* Log Entries */}
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-3">
              {filteredLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No log entries yet
                </p>
              ) : (
                filteredLog.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="bg-secondary/20 p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{getTypeIcon(entry.type)}</span>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            Turn {entry.turnNumber}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {entry.phase.replace(/_/g, " ")}
                          </Badge>
                          <Badge className={`text-xs ${getTypeColor(entry.type)}`}>
                            {entry.type}
                          </Badge>
                        </div>
                        
                        <p className="text-sm font-semibold">
                          {entry.playerName} {entry.action}
                        </p>
                        
                        {entry.cardName && (
                          <p className="text-sm text-primary font-medium">
                            📜 {entry.cardName}
                          </p>
                        )}
                        
                        {entry.cardText && (
                          <p className="text-xs text-muted-foreground italic bg-black/20 p-2 rounded">
                            {entry.cardText}
                          </p>
                        )}
                        
                        {entry.targetName && (
                          <p className="text-sm text-yellow-500">
                            🎯 Target: {entry.targetName}
                          </p>
                        )}
                        
                        {entry.details && (
                          <p className="text-xs text-muted-foreground">
                            {entry.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
