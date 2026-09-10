import { describe, expect, it } from "vitest";

import {
  compareSemver,
  matchTag,
  parseRemoteTags,
  pickLatestTag,
  resolveRefFrom,
} from "./version.js";

describe("parseRemoteTags", () => {
  it("extracts tag names from git ls-remote output", () => {
    const stdout = [
      "a40b149d5c13f4af2065db246adf5d0d4130f5bc\trefs/tags/v0.1.0",
      "b51c250e6d24e5bf3176ec357bef6e1e5241f6cd\trefs/tags/v0.2.0",
    ].join("\n");

    expect(parseRemoteTags(stdout)).toEqual(["v0.1.0", "v0.2.0"]);
  });

  it("ignores peeled annotated-tag refs ending in ^{}", () => {
    const stdout = [
      "a40b149\trefs/tags/v0.2.0",
      "c62d361\trefs/tags/v0.2.0^{}",
    ].join("\n");

    expect(parseRemoteTags(stdout)).toEqual(["v0.2.0"]);
  });

  it("ignores blank and malformed lines", () => {
    const stdout = "\na40b149\trefs/tags/v0.2.0\ngarbage line\n\n";

    expect(parseRemoteTags(stdout)).toEqual(["v0.2.0"]);
  });

  it("returns an empty list for empty output", () => {
    expect(parseRemoteTags("")).toEqual([]);
  });
});

describe("compareSemver", () => {
  it("orders by major version", () => {
    expect(compareSemver("v1.0.0", "v2.0.0")).toBeLessThan(0);
  });

  it("compares numerically, not lexicographically", () => {
    expect(compareSemver("v1.10.0", "v1.9.0")).toBeGreaterThan(0);
    expect(compareSemver("v0.2.0", "v0.10.0")).toBeLessThan(0);
  });

  it("orders by patch when major and minor match", () => {
    expect(compareSemver("v1.2.3", "v1.2.10")).toBeLessThan(0);
  });

  it("treats a missing v prefix as equivalent", () => {
    expect(compareSemver("1.2.3", "v1.2.3")).toBe(0);
  });

  it("ranks a prerelease below its stable release", () => {
    expect(compareSemver("v1.0.0-rc.1", "v1.0.0")).toBeLessThan(0);
  });

  it("orders prereleases of the same version against each other", () => {
    expect(compareSemver("v1.0.0-rc.1", "v1.0.0-rc.2")).toBeLessThan(0);
  });
});

describe("pickLatestTag", () => {
  it("returns the highest stable tag", () => {
    expect(pickLatestTag(["v0.1.0", "v0.10.0", "v0.9.0"])).toBe("v0.10.0");
  });

  it("preserves the original tag string", () => {
    expect(pickLatestTag(["1.0.0", "0.9.0"])).toBe("1.0.0");
  });

  it("ignores prereleases when a stable release exists", () => {
    expect(pickLatestTag(["v1.0.0", "v1.1.0-rc.1"])).toBe("v1.0.0");
  });

  it("returns null when every tag is a prerelease", () => {
    expect(pickLatestTag(["v1.0.0-rc.1", "v1.0.0-beta"])).toBeNull();
  });

  it("ignores tags that are not semver", () => {
    expect(pickLatestTag(["nightly", "latest", "v0.2.0"])).toBe("v0.2.0");
  });

  it("returns null when there are no tags", () => {
    expect(pickLatestTag([])).toBeNull();
  });
});

describe("matchTag", () => {
  it("finds a tag requested with its v prefix", () => {
    expect(matchTag("v0.2.0", ["v0.1.0", "v0.2.0"])).toBe("v0.2.0");
  });

  it("finds a v-prefixed tag requested without the prefix", () => {
    expect(matchTag("0.2.0", ["v0.1.0", "v0.2.0"])).toBe("v0.2.0");
  });

  it("finds an unprefixed tag requested with a v prefix", () => {
    expect(matchTag("v0.2.0", ["0.2.0"])).toBe("0.2.0");
  });

  it("returns null when the tag does not exist", () => {
    expect(matchTag("v9.9.9", ["v0.2.0"])).toBeNull();
  });
});

describe("resolveRefFrom", () => {
  const tags = ["v0.1.0", "v0.2.0"];

  it("defaults to the latest tag", () => {
    expect(resolveRefFrom(tags, {})).toEqual({
      ref: "v0.2.0",
      isTag: true,
      source: "latest",
    });
  });

  it("pins an explicitly requested tag", () => {
    expect(resolveRefFrom(tags, { tag: "0.1.0" })).toEqual({
      ref: "v0.1.0",
      isTag: true,
      source: "pinned",
    });
  });

  it("prefers an explicit tag over an explicit branch", () => {
    expect(resolveRefFrom(tags, { tag: "v0.1.0", branch: "master" })).toEqual({
      ref: "v0.1.0",
      isTag: true,
      source: "pinned",
    });
  });

  it("uses an explicit branch when no tag is requested", () => {
    expect(resolveRefFrom(tags, { branch: "feature/x" })).toEqual({
      ref: "feature/x",
      isTag: false,
      source: "branch",
    });
  });

  it("falls back to the default branch when the repo has no stable tags", () => {
    expect(resolveRefFrom([], {})).toEqual({
      ref: "master",
      isTag: false,
      source: "fallback",
    });
  });

  it("throws listing the available tags when the requested tag is unknown", () => {
    expect(() => resolveRefFrom(tags, { tag: "v9.9.9" })).toThrow(
      /v9\.9\.9.*v0\.1\.0.*v0\.2\.0/s,
    );
  });

  it("throws a clear error when a tag is requested but none exist", () => {
    expect(() => resolveRefFrom([], { tag: "v1.0.0" })).toThrow(
      /no tags/i,
    );
  });
});
