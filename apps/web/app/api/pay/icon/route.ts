/** Kutip mark for wallets (Solana Pay GET `icon`). Public, cacheable, no auth. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="14" fill="#0F766E"/><path d="M20 14v36M20 32l24-18M20 32l24 18" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function GET() {
  return new Response(SVG, { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" } });
}
