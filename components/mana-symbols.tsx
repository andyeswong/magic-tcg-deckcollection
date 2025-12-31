interface ManaSymbolsProps {
  manaCost: string
  size?: "sm" | "md" | "lg"
}

export function ManaSymbols({ manaCost, size = "md" }: ManaSymbolsProps) {
  if (!manaCost) return null

  const sizeClasses = {
    sm: "w-4 h-4 text-xs",
    md: "w-6 h-6 text-sm",
    lg: "w-8 h-8 text-base",
  }

  const getSymbolStyle = (symbol: string) => {
    const baseClasses = `${sizeClasses[size]} rounded-full inline-flex items-center justify-center font-bold border-2 shadow-sm`

    // Color mapping for mana symbols
    const colorMap: Record<string, string> = {
      W: "bg-yellow-50 border-yellow-400 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100",
      U: "bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
      B: "bg-gray-900 border-gray-700 text-white",
      R: "bg-red-50 border-red-400 text-red-900 dark:bg-red-900 dark:text-red-100",
      G: "bg-green-50 border-green-400 text-green-900 dark:bg-green-900 dark:text-green-100",
      C: "bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    }

    // Hybrid mana (e.g., W/U)
    if (symbol.includes("/")) {
      return `${baseClasses} bg-gradient-to-br from-yellow-200 to-blue-200 border-gray-400 text-gray-900`
    }

    // Phyrexian mana
    if (symbol.includes("P")) {
      return `${baseClasses} bg-black border-red-500 text-red-500`
    }

    // Snow mana
    if (symbol === "S") {
      return `${baseClasses} bg-cyan-50 border-cyan-400 text-cyan-900`
    }

    // X cost
    if (symbol === "X") {
      return `${baseClasses} bg-orange-100 border-orange-400 text-orange-900`
    }

    // Colored mana
    if (colorMap[symbol]) {
      return `${baseClasses} ${colorMap[symbol]}`
    }

    // Generic/colorless mana (numbers)
    return `${baseClasses} bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-700 dark:text-gray-200`
  }

  // Parse mana cost string like "{2}{G}{U}" into ["2", "G", "U"]
  const symbols = manaCost.match(/\{([^}]+)\}/g)?.map((s) => s.slice(1, -1)) || []

  if (symbols.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {symbols.map((symbol, index) => (
        <span key={index} className={getSymbolStyle(symbol)}>
          {symbol}
        </span>
      ))}
    </div>
  )
}

// Helper component to show converted mana cost (total)
export function ConvertedManaCost({ cmc }: { cmc?: number }) {
  if (cmc === undefined || cmc === null) return null

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-sm text-muted-foreground">CMC:</span>
      <span className="font-bold">{cmc}</span>
    </div>
  )
}
