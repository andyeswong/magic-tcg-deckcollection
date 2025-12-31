import type { ManaPool } from "@/lib/game/types"

interface ManaPoolDisplayProps {
  manaPool: ManaPool
  size?: "sm" | "md" | "lg"
}

export function ManaPoolDisplay({ manaPool, size = "md" }: ManaPoolDisplayProps) {
  const sizeClasses = {
    sm: "w-5 h-5 text-xs",
    md: "w-6 h-6 text-sm",
    lg: "w-8 h-8 text-base",
  }

  const getSymbolStyle = (color: string) => {
    const baseClasses = `${sizeClasses[size]} rounded-full inline-flex items-center justify-center font-bold border-2 shadow-sm`

    const colorMap: Record<string, string> = {
      W: "bg-yellow-50 border-yellow-400 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100",
      U: "bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
      B: "bg-gray-900 border-gray-700 text-white",
      R: "bg-red-50 border-red-400 text-red-900 dark:bg-red-900 dark:text-red-100",
      G: "bg-green-50 border-green-400 text-green-900 dark:bg-green-900 dark:text-green-100",
      C: "bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    }

    return `${baseClasses} ${colorMap[color] || colorMap.C}`
  }

  const manaEntries = Object.entries(manaPool).filter(([_, amount]) => amount > 0)

  if (manaEntries.length === 0) {
    return <span className="text-muted-foreground text-sm">No mana</span>
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {manaEntries.map(([color, amount]) => (
        <div key={color} className="flex items-center gap-0.5">
          <span className={getSymbolStyle(color)}>{color}</span>
          <span className="text-sm font-semibold">×{amount}</span>
        </div>
      ))}
    </div>
  )
}
