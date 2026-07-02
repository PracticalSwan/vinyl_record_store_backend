import { NextResponse } from "next/server";
import { ServiceError } from "./errors.js";

export function success(data, meta) {
  return NextResponse.json(meta ? { data, meta } : { data });
}

export function failure(error) {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The backend could not complete the request.",
      },
    },
    { status: 500 },
  );
}
