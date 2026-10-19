import { describe, expect, it } from "vitest";
import { countryFromTimeZone } from "./timezone-country";
import { withTimeZoneCountry } from "./product-analytics";

describe("countryFromTimeZone", () => {
  it("maps canonical and legacy browser time zones to one country", () => {
    expect(countryFromTimeZone("Asia/Singapore")).toEqual({ code: "SG", name: "Singapore" });
    expect(countryFromTimeZone("Europe/London")?.code).toBe("GB");
    expect(countryFromTimeZone("America/New_York")?.code).toBe("US");
    expect(countryFromTimeZone("Asia/Saigon")?.code).toBe("VN");
    expect(countryFromTimeZone("Asia/Calcutta")?.code).toBe("IN");
  });

  it("returns null for zones that are not one country", () => {
    for (const zone of ["UTC", "Etc/GMT+3", "", "Not/AZone", undefined, 42]) expect(countryFromTimeZone(zone)).toBeNull();
  });
});

describe("withTimeZoneCountry", () => {
  it("fills the country from the time zone when GeoIP left it empty", () => {
    const event = withTimeZoneCountry({ properties: { $timezone: "Asia/Bangkok" } }, countryFromTimeZone);
    expect(event?.properties).toMatchObject({ $geoip_country_code: "TH", $geoip_country_name: "Thailand", country_source: "timezone" });
  });

  it("never overrides a real GeoIP country and leaves unknown zones alone", () => {
    expect(withTimeZoneCountry({ properties: { $timezone: "Asia/Bangkok", $geoip_country_code: "GR" } }, countryFromTimeZone)?.properties.$geoip_country_code).toBe("GR");
    expect(withTimeZoneCountry({ properties: { $timezone: "UTC" } }, countryFromTimeZone)?.properties).toEqual({ $timezone: "UTC" });
    expect(withTimeZoneCountry(null, countryFromTimeZone)).toBeNull();
  });
});
