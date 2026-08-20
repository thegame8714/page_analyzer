import { NextRequest, NextResponse } from "next/server";
import { AnalysisError, analyzeLandingPage } from "@/lib/analyze";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const url = body.url;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing 'url' field." }, { status: 400 });
  }

  try {
    const report = await analyzeLandingPage(url);
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof AnalysisError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong while analyzing the page." },
      { status: 500 }
    );
  }
}
