import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const result = spawnSync("lsof", ["-nP", "-iTCP:4173", "-sTCP:LISTEN", "-t"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

assert.ok(result.status === 0 || result.status === 1, `unexpected lsof status: ${result.status}\n${result.stderr}`);
assert.equal(result.stderr, "");

