import { NextResponse } from "next/server";
import { getCachedData, getCategories } from "@/lib/crt-api";

export async function GET() {
  try {
    const data = await getCachedData();
    const categories = getCategories(data);
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
