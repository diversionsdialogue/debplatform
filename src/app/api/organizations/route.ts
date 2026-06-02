import { NextRequest, NextResponse } from "next/server";
import { getCachedData, filterByCategory } from "@/lib/crt-api";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  try {
    const data = await getCachedData();

    const results = category ? filterByCategory(data, category) : data;

    return NextResponse.json({
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}
