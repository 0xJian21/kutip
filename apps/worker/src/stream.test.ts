import { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { describe, expect, test } from "vitest";
import { backoffMs, buildRequest, filterKey, isPubkey, withPing } from "./stream";

const [Ref1, Ata1, Treasury1, FeePayer1] = ["F8JhQa4Tvta6ptnR77nyUva7aQ9uq1whdWp2oH8ngwX", "FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS", "6b85KZmzapHBE2pQtEnMywor9yXedsLp2yJH7T16vmdB", "BGs4mRFbyXRhfAwNa94cTdeaRASmg9mGSXWWiJaQyr7L"];
const watched = { transactionKeys: [Ref1, Ata1, Ata1], balanceAccounts: [Ata1, Treasury1, FeePayer1] };

describe("buildRequest", () => {
  test("one processed stream: txs touching references or vault ATAs, slot status, balance accounts", () => {
    const r = buildRequest(watched);
    expect(r.commitment).toBe(CommitmentLevel.PROCESSED);
    expect(r.transactions).toEqual({ kutip: { vote: false, failed: false, accountInclude: [Ata1, Ref1].sort(), accountExclude: [], accountRequired: [] } });
    expect(r.slots).toEqual({ kutip: { filterByCommitment: false } });
    expect(r.accounts).toEqual({ kutip: { account: [Ata1, Treasury1, FeePayer1].sort(), owner: [], filters: [] } });
  });

  test("drops strings that aren't 32-byte pubkeys (seeded demo rows): one bad key fails the whole subscription", () => {
    const real = "FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS";
    const r = buildRequest({ transactionKeys: [real, "ref_1xxxxxxxxxxxxxxxxxxxxxxxxxxx", "0OIl"], balanceAccounts: ["Harbourline-ata_3xxxxxxxxxxxxxxx", real] });
    expect(r.transactions.kutip!.accountInclude).toEqual([real]);
    expect(r.accounts.kutip!.account).toEqual([real]);
  });

  test("never sends an empty account filter (Yellowstone reads empty as 'everything')", () => {
    const r = buildRequest({ transactionKeys: [], balanceAccounts: [] });
    expect(r.transactions).toEqual({});
    expect(r.accounts).toEqual({});
    expect(r.slots).toEqual({ kutip: { filterByCommitment: false } });
  });
});

test("every keepalive ping carries the full filters (Spike C: a bare ping wiped them on Solami)", () => {
  const r = buildRequest(watched);
  expect(withPing(r, 7)).toEqual({ ...r, ping: { id: 7 } });
});

test("filterKey changes only when the watched set changes", () => {
  expect(filterKey(watched)).toBe(filterKey({ transactionKeys: [Ata1, Ref1], balanceAccounts: [FeePayer1, Treasury1, Ata1] }));
  expect(filterKey(watched)).not.toBe(filterKey({ ...watched, transactionKeys: [Treasury1, Ata1] }));
});

test("reconnect backoff doubles from 1 s and caps at 30 s", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
});

test("isPubkey accepts only base58 strings that decode to 32 bytes", () => {
  expect(isPubkey("FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS")).toBe(true);
  expect(isPubkey("11111111111111111111111111111111")).toBe(true);
  expect(isPubkey("ref_1xxxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe(false);
  expect(isPubkey("2XPvdm")).toBe(false);
});
