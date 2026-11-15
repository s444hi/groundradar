import { describe, expect, it } from "vitest";
import demoField from "../../fixtures/demo-field.json";
import { getFrostWeek, getFrostWeeks, weekToMonthDay } from "../frost";
import type { FrostDates } from "../types";

const frostDates = demoField.climate_data.frost_dates as unknown as FrostDates;

describe("getFrostWeek", () => {
  it("maps the demo field's last spring frost to week 11", () => {
    expect(getFrostWeek(frostDates.last_spring_frost)).toBe(11);
  });

  it("maps the demo field's first fall frost to week 46", () => {
    expect(getFrostWeek(frostDates.first_fall_frost)).toBe(46);
  });

  it("maps January 1st to week 1", () => {
    expect(getFrostWeek("01-01")).toBe(1);
  });

  it("clamps December 31st to week 52", () => {
    expect(getFrostWeek("12-31")).toBe(52);
  });

  it("rounds up (ceil) rather than to nearest week", () => {
    // day-of-year 15 -> 15/7 = 2.14 -> ceil = 3, round would give 2
    expect(getFrostWeek("01-15")).toBe(3);
  });

  it("maps a mid-year date correctly", () => {
    // day-of-year 166 -> ceil(166/7) = 24
    expect(getFrostWeek("06-15")).toBe(24);
  });
});

describe("getFrostWeeks", () => {
  it("converts both frost dates from the demo field", () => {
    expect(getFrostWeeks(frostDates)).toEqual({
      last_spring_frost: 11,
      first_fall_frost: 46,
    });
  });
});

describe("weekToMonthDay", () => {
  it("includes an approximate day-of-month, not just the month", () => {
    expect(weekToMonthDay(1)).toBe("Jan 4");
    expect(weekToMonthDay(13)).toBe("Mar 29");
  });
});
