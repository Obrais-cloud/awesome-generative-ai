import { NextResponse } from "next/server";
import { researchTrends } from "@/lib/trends";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get("niche") || process.env.CONTENT_NICHE || "marketing";

  try {
    const trends = await researchTrends(niche);
    return NextResponse.json(trends);
  } catch (error) {
    console.error("[api/trends] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}
