import { NextResponse } from "next/server";
import { createArtworkResponse } from "@/services/artworkImage";

export const dynamic = "force-dynamic";

// Streams a trusted Cover Art Archive image through the backend so storefronts
// on networks that cannot reach coverartarchive.org still render cover art.
// Transport mapping lives in the service; this handler is thin Next glue.
export async function GET(request) {
  const target = new URL(request.url).searchParams.get("u");
  const result = await createArtworkResponse(target);
  if (result.ok) {
    return new NextResponse(result.body, { status: result.status, headers: result.headers });
  }
  return NextResponse.json({ error: { code: result.code, message: result.message } }, { status: result.status });
}
