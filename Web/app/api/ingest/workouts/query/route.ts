/**
 * POST /api/ingest/workouts/query
 * Stub endpoint for the iOS app to query existing workouts for deduplication.
 * Returns an empty set. Add real pagination if needed later.
 */

import { NextResponse } from "next/server"

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  return response
}

export async function POST() {
  const response = NextResponse.json({ workouts: [], cursor: null }, { status: 200 })
  return withCors(response)
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 })
  return withCors(response)
}
