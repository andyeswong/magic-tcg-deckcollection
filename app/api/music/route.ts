import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    const musicDir = path.join(process.cwd(), "public", "music")
    const files = fs.readdirSync(musicDir)
    
    // Filter for audio files and remove extensions
    const musicFiles = files
      .filter(file => file.endsWith(".mp3") || file.endsWith(".wav") || file.endsWith(".ogg"))
      .map(file => file.replace(/\.(mp3|wav|ogg)$/, ""))
    
    return NextResponse.json({ tracks: musicFiles })
  } catch (error) {
    console.error("Error reading music directory:", error)
    return NextResponse.json({ tracks: [] }, { status: 500 })
  }
}
