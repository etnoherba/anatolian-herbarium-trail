import { describe, it, expect } from "vitest";
import { judge, pickQuestions } from "./quiz";
const items = Array.from({ length: 126 }, (_, i) => i);
describe("quiz rules", () => {
  it("first try correct is green", () => expect(judge(true, 0)).toBe("green"));
  it("correct on 2nd or 3rd try is yellow", () => { expect(judge(true, 1)).toBe("yellow"); expect(judge(true, 2)).toBe("yellow"); });
  it("third miss turns red", () => { expect(judge(false, 1)).toBeNull(); expect(judge(false, 2)).toBe("red"); });
  it("round sizes 15/30/50/all without repeats", () => {
    for (const n of [15, 30, 50] as const) { const q = pickQuestions(items, n); expect(q).toHaveLength(n); expect(new Set(q).size).toBe(n); }
    expect(new Set(pickQuestions(items, "all")).size).toBe(126);
  });
});
