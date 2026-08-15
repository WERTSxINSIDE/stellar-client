import { NextRequest, NextResponse } from "next/server"

const CURRENT_VERSION = "1.21.10"
const DOWNLOAD_URL = "https://drive.google.com/uc?export=download&id=1aTDsNJiaJVAYsJ7WYJUnR6PUQ0I7oMZV"

export async function GET(req: NextRequest) {
  return NextResponse.json({
    version: CURRENT_VERSION,
    url: DOWNLOAD_URL,
    size: 0
  })
}