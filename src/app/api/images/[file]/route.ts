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
  if (!allowedExtensions.has(extension)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }
  const imagesRoot = path.resolve(process.cwd(), "images");
  const hasFolder = decoded.includes("/") || decoded.includes("\\");
  const candidates = hasFolder ? [decoded] : [path.join("bingo", decoded), decoded];

  for (const candidate of candidates) {
    const normalizedPath = path.normalize(candidate);
    const imagePath = path.resolve(imagesRoot, normalizedPath);
    const relativeToRoot = path.relative(imagesRoot, imagePath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      continue;
    }
    try {
      const bytes = await readFile(imagePath);
      return new NextResponse(bytes, {
        headers: {
          "content-type": contentTypeForExtension(extension),
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Try next candidate path.
    }
  }
  return NextResponse.json({ error: "Image not found" }, { status: 404 });
}
