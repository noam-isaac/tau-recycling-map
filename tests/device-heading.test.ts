import { describe, expect, it } from "vitest";
import { headingFromOrientation } from "../src/lib/device-heading";

describe("headingFromOrientation", () => {
  it("uses Safari's real-world heading when it is calibrated", () => {
    expect(
      headingFromOrientation({
        absolute: false,
        alpha: null,
        beta: null,
        gamma: null,
        webkitCompassAccuracy: 8,
        webkitCompassHeading: 370,
      }),
    ).toBe(10);
  });

  it("rejects Safari headings reported as uncalibrated", () => {
    expect(
      headingFromOrientation({
        absolute: false,
        alpha: null,
        beta: null,
        gamma: null,
        webkitCompassAccuracy: -1,
        webkitCompassHeading: 90,
      }),
    ).toBeNull();
  });

  it("tilt-compensates absolute orientation readings", () => {
    expect(
      headingFromOrientation({
        absolute: true,
        alpha: 195,
        beta: 0,
        gamma: 90,
      }),
    ).toBeCloseTo(75);
  });

  it("does not treat relative alpha as a compass heading", () => {
    expect(
      headingFromOrientation({
        absolute: false,
        alpha: 270,
        beta: 90,
        gamma: 0,
      }),
    ).toBeNull();
  });
});
