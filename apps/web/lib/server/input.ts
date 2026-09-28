/** Input checks for onboarding and the company profile. Pure, so they are testable; the server files apply them. */
import { UserError } from "../data/result";

export const LOGO_MAX_BYTES = 512 * 1024;
/** Raster types only: an SVG in a public bucket can carry scripts and render on the storage origin. */
export const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const LOGO_ACCEPT = Object.keys(LOGO_TYPES).join(",");

/** File type from the bytes (magic numbers), never from the client's declared type. */
export function sniffImage(bytes: Uint8Array): { ext: string; contentType: string } | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { ext: "png", contentType: "image/png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP") return { ext: "webp", contentType: "image/webp" };
  return null;
}

export function checkLogo(bytes: Uint8Array): { ext: string; contentType: string } {
  if (bytes.length === 0) throw new UserError("That file is empty");
  if (bytes.length > LOGO_MAX_BYTES) throw new UserError("Keep the logo under 512 KB");
  const kind = sniffImage(bytes);
  if (!kind) throw new UserError("Use a PNG, JPEG or WebP file");
  return kind;
}

/** Where a sign-up's logo lands before its exporter exists: public URL prefix for that Privy user only. */
export function signupLogoPrefix(supabaseUrl: string, privyUserId: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/logos/${signupFolder(privyUserId)}/`;
}

export function signupFolder(privyUserId: string): string {
  return `signup-${privyUserId.replace(/[^a-z0-9]/gi, "").slice(-24)}`;
}

export type CompanyInput = { name: string; registrationNo: string; city: string; address: string; contactEmail: string; ownerName: string; logoUrl?: string };

export function validateCompany(input: CompanyInput, opts: { logoPrefix?: string } = {}): CompanyInput {
  const trim = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);
  const logoUrl = opts.logoPrefix && input.logoUrl?.startsWith(opts.logoPrefix) && /^[a-f0-9]+\.(png|jpg|webp)$/.test(input.logoUrl.slice(opts.logoPrefix.length)) ? input.logoUrl : undefined;
  const c = { name: trim(input.name, 120), registrationNo: trim(input.registrationNo, 40), city: trim(input.city, 80), address: trim(input.address, 240), contactEmail: trim(input.contactEmail, 120), ownerName: trim(input.ownerName, 80), logoUrl };
  if (!c.name) throw new UserError("Enter your company name");
  if (!c.ownerName) throw new UserError("Enter your name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contactEmail)) throw new UserError("Enter a valid email for receipts");
  return c;
}
