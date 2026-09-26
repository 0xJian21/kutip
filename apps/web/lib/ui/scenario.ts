import type { MockScenario } from "./types";

/** Dev-only: ?mock=empty|error|slow previews a data view's states. */
export function scenarioFrom(searchParams: Record<string, string | string[] | undefined>): MockScenario | undefined {
  const v = searchParams.mock;
  return v === "empty" || v === "error" || v === "slow" ? v : undefined;
}
