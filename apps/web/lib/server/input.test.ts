import { describe, expect, it } from "vitest";
import { checkLogo, signupLogoPrefix, sniffImage, validateCompany } from "./input";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

describe("sniffImage", () => {
  it("recognises png, jpeg and webp from the bytes, not the declared type", () => {
    expect(sniffImage(PNG)).toEqual({ ext: "png", contentType: "image/png" });
    expect(sniffImage(JPEG)).toEqual({ ext: "jpg", contentType: "image/jpeg" });
    expect(sniffImage(WEBP)).toEqual({ ext: "webp", contentType: "image/webp" });
  });
  it("returns null for SVG, HTML and anything else", () => {
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>"))).toBeNull();
    expect(sniffImage(Buffer.from("<!doctype html>"))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

describe("checkLogo", () => {
  it("accepts png, jpeg and webp bytes under 512 KB", () => {
    expect(checkLogo(PNG)).toEqual({ ext: "png", contentType: "image/png" });
    expect(checkLogo(Buffer.concat([JPEG, Buffer.alloc(512 * 1024 - JPEG.length)]))).toEqual({ ext: "jpg", contentType: "image/jpeg" });
  });
  it("refuses SVG, empty files and anything over 512 KB, with a message for the user", () => {
    expect(() => checkLogo(Buffer.from("<svg/>"))).toThrow(/PNG, JPEG or WebP/);
    expect(() => checkLogo(Buffer.alloc(0))).toThrow(/empty/);
    expect(() => checkLogo(Buffer.concat([PNG, Buffer.alloc(512 * 1024)]))).toThrow(/512 KB/);
  });
});

describe("validateCompany", () => {
  const ok = { name: " Teratai Woodworks ", registrationNo: "202001034567", city: "Muar", address: "Lot 2188", contactEmail: "ap@teratai.example", ownerName: "Farid" };
  it("trims and keeps the fields", () => {
    expect(validateCompany(ok)).toMatchObject({ name: "Teratai Woodworks", contactEmail: "ap@teratai.example", ownerName: "Farid" });
  });
  it("needs a company name, the owner's name and a real email", () => {
    expect(() => validateCompany({ ...ok, name: " " })).toThrow(/company name/);
    expect(() => validateCompany({ ...ok, ownerName: "" })).toThrow(/your name/);
    expect(() => validateCompany({ ...ok, contactEmail: "nope" })).toThrow(/email/);
  });
  it("caps field lengths", () => {
    expect(validateCompany({ ...ok, name: "x".repeat(500) }).name).toHaveLength(120);
  });
  it("only keeps a logo URL that points at this sign-up's own upload path", () => {
    const prefix = signupLogoPrefix("https://abc.supabase.co", "did:privy:xyz123");
    expect(prefix).toBe("https://abc.supabase.co/storage/v1/object/public/logos/signup-didprivyxyz123/");
    expect(validateCompany({ ...ok, logoUrl: `${prefix}deadbeef.png` }, { logoPrefix: prefix }).logoUrl).toBe(`${prefix}deadbeef.png`);
    expect(validateCompany({ ...ok, logoUrl: "https://evil.example/x.png" }, { logoPrefix: prefix }).logoUrl).toBeUndefined();
    expect(validateCompany({ ...ok, logoUrl: `${prefix}deadbeef.png` }).logoUrl).toBeUndefined();
  });
});
