// app/api/link-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getLinkPreview } from "link-preview-js";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const preview = await getLinkPreview(url, {
      timeout: 5000,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      followRedirects: "follow",
    });

    // Add CORS headers
    const response = NextResponse.json(preview, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

    // Cache the response for 24 hours
    response.headers.set("Cache-Control", "public, max-age=86400");

    return response;
  } catch (error) {
    console.error("Failed to fetch link preview:", error);
    return NextResponse.json(
      { error: "Failed to fetch preview" },
      { status: 500 },
    );
  }
}
