import { NextResponse } from "next/server";
import { createLocalArtworkRedirect } from "@/services/localArtwork";

export async function GET(request, { params }) {
  const { publicId } = await params;
  const result = createLocalArtworkRedirect(publicId);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: result.status },
    );
  }

  return new NextResponse(null, {
    status: result.status,
    headers: {
      ...result.headers,
      Location: new URL(result.location, request.url).toString(),
    },
  });
}
