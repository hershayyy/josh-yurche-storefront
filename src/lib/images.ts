import "server-only";
import convert from "heic-convert";
import sharp from "sharp";
import { AdminError } from "@/lib/admin-error";

const MAX_EDGE = 2400;

function looksLikeHeic(buffer: Buffer) {
  if (buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buffer.toString("ascii", 8, 16).toLowerCase();
  return /heic|heix|heif|mif1|msf1|hevc/.test(brand);
}

async function renderJpeg(source: Buffer) {
  const oriented = sharp(source, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  }).rotate();
  const before = await oriented.metadata();

  if (!before.width || !before.height) {
    throw new AdminError("Could not read that photo.");
  }

  const buffer = await sharp(source, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const after = await sharp(buffer).metadata();
  const width = after.width ?? before.width;
  const height = after.height ?? before.height;

  if (!width || !height) {
    throw new AdminError("Could not read that photo.");
  }

  return { buffer, width, height };
}

/** Resize to a web JPEG without cropping. HEIC is converted first. */
export async function createWebImage(input: Buffer, hint?: string) {
  const heic = looksLikeHeic(input) || hint === "heic";

  try {
    const source = heic ? Buffer.from(await convertHeic(input)) : input;
    return await renderJpeg(source);
  } catch (error) {
    if (error instanceof AdminError) throw error;

    if (!heic) {
      try {
        return await renderJpeg(Buffer.from(await convertHeic(input)));
      } catch {
        throw new AdminError("Could not read that photo.");
      }
    }

    throw new AdminError("Could not read that photo.");
  }
}

function convertHeic(input: Buffer) {
  return convert({
    buffer: input,
    format: "JPEG",
    quality: 1,
  });
}
