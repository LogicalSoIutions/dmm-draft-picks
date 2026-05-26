import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const contentTypeForExtension = (extension: string): string => {
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return "image/jpeg";
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ file: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  const decoded = decodeURIComponent(params.file);
  const extension = path.extname(decoded).toLowerCase();
  if (!allowedExtensions.has(extension) || decoded.includes("/") || decoded.includes("\\")) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }
  const imagePath = path.resolve(process.cwd(), "images", decoded);
  try {
    const bytes = await readFile(imagePath);
    return new NextResponse(bytes, {
      headers: {
        "content-type": contentTypeForExtension(extension),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
