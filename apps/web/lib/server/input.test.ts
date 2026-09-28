import { describe, expect, it } from "vitest";
import { checkLogo, validateCompany } from "./input";

describe("checkLogo", () => {
  it("accepts png, jpeg, webp and svg under 512 KB", () => {
    expect(checkLogo({ type: "image/png", size: 10 })).toEqual({ ext: "png" });
    expect(checkLogo({ type: "image/jpeg", size: 512 * 1024 })).toEqual({ ext: "jpg" });
    expect(checkLogo({ type: "image/webp", size: 10 })).toEqual({ ext: "webp" });
    expect(checkLogo({ type: "image/svg+xml", size: 10 })).toEqual({ ext: "svg" });
  });
  it("refuses other types, empty files and anything over 512 KB, with a message for the user", () => {
    expect(() => checkLogo({ type: "application/pdf", size: 10 })).toThrow(/PNG, JPEG, WebP or SVG/);
    expect(() => checkLogo({ type: "image/png", size: 0 })).toThrow(/empty/);
    expect(() => checkLogo({ type: "image/png", size: 512 * 1024 + 1 })).toThrow(/512 KB/);
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
});
