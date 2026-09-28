/** Input checks for onboarding and the company profile. Pure, so they are testable; the server files apply them. */
import { UserError } from "../data/result";

export const LOGO_MAX_BYTES = 512 * 1024;
export const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export function checkLogo(file: { type: string; size: number }): { ext: string } {
  const ext = LOGO_TYPES[file.type];
  if (!ext) throw new UserError("Use a PNG, JPEG, WebP or SVG file");
  if (file.size === 0) throw new UserError("That file is empty");
  if (file.size > LOGO_MAX_BYTES) throw new UserError("Keep the logo under 512 KB");
  return { ext };
}

export type CompanyInput = { name: string; registrationNo: string; city: string; address: string; contactEmail: string; ownerName: string; logoUrl?: string };

export function validateCompany(input: CompanyInput): CompanyInput {
  const trim = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);
  const c = { name: trim(input.name, 120), registrationNo: trim(input.registrationNo, 40), city: trim(input.city, 80), address: trim(input.address, 240), contactEmail: trim(input.contactEmail, 120), ownerName: trim(input.ownerName, 80), logoUrl: input.logoUrl };
  if (!c.name) throw new UserError("Enter your company name");
  if (!c.ownerName) throw new UserError("Enter your name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contactEmail)) throw new UserError("Enter a valid email for receipts");
  return c;
}
