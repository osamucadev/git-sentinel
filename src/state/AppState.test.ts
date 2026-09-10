import { describe, expect, it } from "vitest";
import { planRepositoryAdditions } from "./AppState";

describe("planRepositoryAdditions", () => {
  it("groups a multi-folder selection and does not re-register existing paths", () => {
    expect(planRepositoryAdditions(
      ["/repos/one", "/repos/two", "/repos/one", "/repos/already"],
      ["/repos/already"],
    )).toEqual({ additions: ["/repos/one", "/repos/two"], duplicates: 2 });
  });
});
