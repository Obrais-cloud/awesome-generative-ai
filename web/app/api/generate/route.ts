import { NextResponse } from "next/server";
import { researchTrends } from "@/lib/trends";
import { analyzeContent } from "@/lib/analyze";
import { generateContent } from "@/lib/generate";
import { getSampleCreatorPosts } from "@/lib/sample-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for AI generation

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const niche = body.niche || process.env.CONTENT_NICHE || "marketing";
    const anthropicKey = body.anthropicKey || process.env.ANTHROPIC_API_KEY || "";

    // Run the pipeline
    const [trends, posts] = await Promise.all([
      researchTrends(niche),
      Promise.resolve(getSampleCreatorPosts(niche)),
    ]);

    const analysis = analyzeContent(trends, posts, niche);
    const generatedPosts = await generateContent(niche, trends, analysis, anthropicKey || undefined);

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      niche,
      generation_mode: anthropicKey ? "AI-powered (Claude)" : "Template-based",
      topics_used: Math.min(trends.length, 5),
      total_posts: generatedPosts.length,
      posts: generatedPosts,
      trends,
      analysis,
    });
  } catch (error) {
    console.error("[api/generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
