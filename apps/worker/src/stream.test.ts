import { CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { describe, expect, test } from "vitest";
import { backoffMs, buildRequest, filterKey, withPing } from "./stream";

const watched = { transactionKeys: ["Ref1", "Ata1", "Ata1"], balanceAccounts: ["Ata1", "Treasury1", "FeePayer1"] };

describe("buildRequest", () => {
  test("one processed stream: txs touching references or vault ATAs, slot status, balance accounts", () => {
    const r = buildRequest(watched);
    expect(r.commitment).toBe(CommitmentLevel.PROCESSED);
    expect(r.transactions).toEqual({ kutip: { vote: false, failed: false, accountInclude: ["Ata1", "Ref1"], accountExclude: [], accountRequired: [] } });
    expect(r.slots).toEqual({ kutip: { filterByCommitment: false } });
    expect(r.accounts).toEqual({ kutip: { account: ["Ata1", "FeePayer1", "Treasury1"], owner: [], filters: [] } });
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
  expect(filterKey(watched)).toBe(filterKey({ transactionKeys: ["Ata1", "Ref1"], balanceAccounts: ["FeePayer1", "Treasury1", "Ata1"] }));
  expect(filterKey(watched)).not.toBe(filterKey({ ...watched, transactionKeys: ["Ref2", "Ata1"] }));
});

test("reconnect backoff doubles from 1 s and caps at 30 s", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
});
