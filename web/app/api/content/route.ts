import { NextResponse } from "next/server";
import { researchTrends } from "@/lib/trends";
import { analyzeContent } from "@/lib/analyze";
import { generateContent } from "@/lib/generate";
import { getSampleCreatorPosts } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get("niche") || process.env.CONTENT_NICHE || "marketing";

  try {
    const trends = await researchTrends(niche);
    const posts = getSampleCreatorPosts(niche);
    const analysis = analyzeContent(trends, posts, niche);

    // Template-only for GET (no API key in query params for security)
    const generatedPosts = await generateContent(niche, trends, analysis);

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      niche,
      generation_mode: "Template-based",
      topics_used: Math.min(trends.length, 5),
      total_posts: generatedPosts.length,
      posts: generatedPosts,
    });
  } catch (error) {
    console.error("[api/content] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
