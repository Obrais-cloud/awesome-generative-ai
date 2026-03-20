import { NextResponse } from "next/server";
import { researchTrends } from "@/lib/trends";
import { analyzeContent } from "@/lib/analyze";
import { getSampleCreatorPosts } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get("niche") || process.env.CONTENT_NICHE || "marketing";

  try {
    const [trends, posts] = await Promise.all([
      researchTrends(niche),
      Promise.resolve(getSampleCreatorPosts(niche)),
    ]);

    const analysis = analyzeContent(trends, posts, niche);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[api/analysis] Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze content" },
      { status: 500 }
    );
  }
}
