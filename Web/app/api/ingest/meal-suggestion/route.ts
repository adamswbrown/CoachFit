import { NextRequest, NextResponse } from "next/server"
import { validateIngestAuth, createIngestErrorResponse, createIngestSuccessResponse, handleIngestPreflight } from "@/lib/security/ingest-auth"
import { z } from "zod"

const mealSuggestionSchema = z.object({
  client_id: z.string().uuid(),
  restaurant: z.string().min(1).max(200),
  item: z.string().min(1).max(200),
  calories_kcal: z.number().nonnegative().max(5000),
  protein_g: z.number().nonnegative().max(500).optional(),
  carbs_g: z.number().nonnegative().max(500).optional(),
  fat_g: z.number().nonnegative().max(500).optional(),
  fibre_g: z.number().nonnegative().max(100).optional(),
  salt_g: z.number().nonnegative().max(50).optional(),
  category: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const body = await req.json()
    const validated = mealSuggestionSchema.parse(body)

    const authResult = await validateIngestAuth(req, validated.client_id)
    if (!authResult.success) {
      return createIngestErrorResponse(authResult, origin)
    }

    const githubToken = process.env.UKFOODFACTS_GITHUB_TOKEN
    if (!githubToken) {
      return createIngestSuccessResponse(
        { success: true, action: "skipped", message: "Meal suggestion feature not configured" },
        origin, 200
      )
    }

    const owner = "adamswbrown"
    const repo = "ukfoodfacts"
    const branch = `meal/${Date.now()}-${validated.restaurant.toLowerCase().replace(/[^a-z0-9]/g, "-")}`

    // 1. Get main branch SHA
    const mainRef = await githubAPI(`/repos/${owner}/${repo}/git/ref/heads/main`, githubToken)
    const baseSha = mainRef.object.sha

    // 2. Get current nutrition_db.json
    const fileData = await githubAPI(`/repos/${owner}/${repo}/contents/output/nutrition_db.json?ref=main`, githubToken)
    const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8")
    const db = JSON.parse(currentContent) as any[]

    // 3. Check for duplicates
    const isDuplicate = db.some(
      (item: any) =>
        item.restaurant?.toLowerCase() === validated.restaurant.toLowerCase() &&
        item.item?.toLowerCase() === validated.item.toLowerCase()
    )

    if (isDuplicate) {
      return createIngestSuccessResponse(
        { success: true, action: "skipped", message: "This meal already exists in the database" },
        origin, 200
      )
    }

    // 4. Add new item
    const newItem = {
      restaurant: validated.restaurant,
      category: validated.category || "Main",
      item: validated.item,
      description: "",
      location: "National",
      calories_kcal: validated.calories_kcal,
      protein_g: validated.protein_g || 0,
      carbs_g: validated.carbs_g || 0,
      fat_g: validated.fat_g || 0,
      fibre_g: validated.fibre_g || 0,
      salt_g: validated.salt_g || 0,
      allergens: [],
      dietary_flags: [],
      source_url: "User submitted via CoachFit app",
      scraped_at: new Date().toISOString().split("T")[0],
    }

    db.push(newItem)
    const updatedContent = Buffer.from(JSON.stringify(db, null, 2)).toString("base64")

    // 5. Create branch
    await githubAPI(`/repos/${owner}/${repo}/git/refs`, githubToken, "POST", {
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    })

    // 6. Update file on new branch
    await githubAPI(`/repos/${owner}/${repo}/contents/output/nutrition_db.json`, githubToken, "PUT", {
      message: `Add ${validated.item} (${validated.restaurant})`,
      content: updatedContent,
      sha: fileData.sha,
      branch,
    })

    // 7. Create PR
    const pr = await githubAPI(`/repos/${owner}/${repo}/pulls`, githubToken, "POST", {
      title: `New meal: ${validated.restaurant} — ${validated.item} (${validated.calories_kcal} kcal)`,
      head: branch,
      base: "main",
      body: `## Meal Suggestion from CoachFit App\n\n` +
        `| Field | Value |\n|-------|-------|\n` +
        `| Restaurant | ${validated.restaurant} |\n` +
        `| Item | ${validated.item} |\n` +
        `| Calories | ${validated.calories_kcal} kcal |\n` +
        `| Protein | ${validated.protein_g || 0}g |\n` +
        `| Carbs | ${validated.carbs_g || 0}g |\n` +
        `| Fat | ${validated.fat_g || 0}g |\n` +
        `| Fibre | ${validated.fibre_g || 0}g |\n` +
        `| Salt | ${validated.salt_g || 0}g |\n\n` +
        `Submitted by a CoachFit user. Review and merge to add to the database.`,
    })

    return createIngestSuccessResponse(
      { success: true, action: "created", message: "Meal suggestion submitted for review", pr_url: pr.html_url },
      origin, 201
    )
  } catch (error: any) {
    if (error.name === "ZodError") {
      const response = NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
      if (origin) {
        response.headers.set("Access-Control-Allow-Origin", origin)
        response.headers.set("Access-Control-Allow-Credentials", "true")
      }
      return response
    }

    console.error("[meal-suggestion] Error:", error)
    const response = NextResponse.json(
      { error: "Failed to submit meal suggestion" },
      { status: 500 }
    )
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin)
      response.headers.set("Access-Control-Allow-Credentials", "true")
    }
    return response
  }
}

export async function OPTIONS(req: NextRequest) {
  return handleIngestPreflight(req.headers.get("origin"))
}

async function githubAPI(path: string, token: string, method = "GET", body?: any) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`GitHub API error (${res.status}): ${error}`)
  }

  return res.json()
}
