import { describe, expect, test } from "bun:test";
import { add } from "@cmd/main";

describe("add", () => {
  test("sums two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });
});
