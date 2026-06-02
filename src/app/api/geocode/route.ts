import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(query)}&rows=5&fq=type:(adres OR postcode OR woonplaats)`;

  const response = await fetch(url);
  if (!response.ok) {
    return NextResponse.json(
      { error: "Geocoding failed" },
      { status: 502 }
    );
  }

  const data = await response.json();

  const results = data.response.docs.map(
    (doc: { weergavenaam: string; centroide_ll: string }) => {
      const match = doc.centroide_ll.match(
        /POINT\(([^ ]+) ([^)]+)\)/
      );
      return {
        label: doc.weergavenaam,
        lat: match ? parseFloat(match[2]) : 0,
        lng: match ? parseFloat(match[1]) : 0,
      };
    }
  );

  return NextResponse.json(results);
}
