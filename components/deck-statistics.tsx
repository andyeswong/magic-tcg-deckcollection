"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface CardWithData {
  card_id: string
  quantity: number
  card_name: string
  type_line?: string
  mana_cost?: string
  colors?: string[]
  cmc?: number
}

interface DeckStatisticsProps {
  cards: CardWithData[]
}

export function DeckStatistics({ cards }: DeckStatisticsProps) {
  const statistics = useMemo(() => {
    // Calculate mana curve
    const manaCurve: Record<string, number> = {}
    let totalCMC = 0
    let totalCards = 0

    // Color distribution
    const colorCounts: Record<string, number> = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
      C: 0, // Colorless
    }

    // Card type distribution
    const typeCounts: Record<string, number> = {
      Creature: 0,
      Instant: 0,
      Sorcery: 0,
      Enchantment: 0,
      Artifact: 0,
      Planeswalker: 0,
      Land: 0,
      Other: 0,
    }

    cards.forEach((card) => {
      const quantity = card.quantity || 1
      totalCards += quantity

      // Mana curve
      const cmc = card.cmc || 0
      totalCMC += cmc * quantity

      const cmcKey = cmc >= 7 ? "7+" : cmc.toString()
      manaCurve[cmcKey] = (manaCurve[cmcKey] || 0) + quantity

      // Colors
      if (card.colors && card.colors.length > 0) {
        card.colors.forEach((color) => {
          if (color in colorCounts) {
            colorCounts[color] += quantity
          }
        })
      } else {
        colorCounts.C += quantity
      }

      // Card types
      const typeLine = card.type_line?.toLowerCase() || ""
      let categorized = false

      Object.keys(typeCounts).forEach((type) => {
        if (typeLine.includes(type.toLowerCase())) {
          typeCounts[type] += quantity
          categorized = true
        }
      })

      if (!categorized) {
        typeCounts.Other += quantity
      }
    })

    // Format mana curve data for chart
    const manaCurveData = [0, 1, 2, 3, 4, 5, 6, "7+"].map((cmc) => ({
      cmc: cmc.toString(),
      count: manaCurve[cmc.toString()] || 0,
    }))

    // Average CMC
    const averageCMC = totalCards > 0 ? (totalCMC / totalCards).toFixed(2) : "0.00"

    // Filter out types with 0 cards
    const activeTypes = Object.entries(typeCounts)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a)

    return {
      manaCurveData,
      averageCMC,
      totalCards,
      colorCounts,
      typeCounts: activeTypes,
    }
  }, [cards])

  const getColorName = (color: string) => {
    const names: Record<string, string> = {
      W: "White",
      U: "Blue",
      B: "Black",
      R: "Red",
      G: "Green",
      C: "Colorless",
    }
    return names[color] || color
  }

  const getColorClass = (color: string) => {
    const classes: Record<string, string> = {
      W: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100",
      U: "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
      B: "bg-gray-800 text-white",
      R: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
      G: "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100",
      C: "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100",
    }
    return classes[color] || "bg-gray-100 text-gray-900"
  }

  const getBarColor = (cmc: string) => {
    const colors = ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#e9d5ff", "#f3e8ff", "#fae8ff", "#fdf4ff"]
    const index = cmc === "7+" ? 7 : parseInt(cmc)
    return colors[index] || colors[0]
  }

  return (
    <div className="space-y-6">
      {/* Mana Curve Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Mana Curve</CardTitle>
          <p className="text-sm text-muted-foreground">
            Average CMC: <span className="font-bold text-foreground">{statistics.averageCMC}</span>
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statistics.manaCurveData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="cmc"
                label={{ value: "Mana Cost", position: "insideBottom", offset: -5 }}
              />
              <YAxis label={{ value: "Cards", angle: -90, position: "insideLeft" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {statistics.manaCurveData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.cmc)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Color Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Color Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(statistics.colorCounts)
              .filter(([_, count]) => count > 0)
              .sort(([_, a], [__, b]) => b - a)
              .map(([color, count]) => (
                <div key={color} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${getColorClass(color)}`}>
                      {color}
                    </div>
                    <span className="font-medium">{getColorName(color)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[100px]">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${(count / statistics.totalCards) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold min-w-[3rem] text-right">
                      {count} ({Math.round((count / statistics.totalCards) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Card Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Card Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statistics.typeCounts.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="font-medium">{type}</span>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[100px]">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(count / statistics.totalCards) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold min-w-[3rem] text-right">
                    {count} ({Math.round((count / statistics.totalCards) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{statistics.totalCards}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Cards</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{statistics.averageCMC}</p>
            <p className="text-sm text-muted-foreground mt-1">Avg. CMC</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">
              {Object.values(statistics.colorCounts).filter((c) => c > 0).length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Colors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{cards.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Unique Cards</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
