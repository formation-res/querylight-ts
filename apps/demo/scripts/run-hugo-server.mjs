import { spawn, spawnSync } from "node:child_process";

function readPort() {
  const rawPort = process.argv[2];
  const port = Number.parseInt(rawPort ?? "", 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Expected a positive port number, received: ${rawPort ?? "<missing>"}`);
  }
  return port;
}

function listPidsOnPort(port) {
  const result = spawnSync("lsof", ["-nP", "-iTCP:" + String(port), "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr.trim() || `Failed to inspect port ${port}`);
  }

  return (result.stdout ?? "")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function readPidCommand(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Failed to inspect process ${pid}`);
  }

  return result.stdout.trim();
}

function isDevServerCommand(command) {
  return /\b(vite|hugo)\b/.test(command);
}

function killPids(pids) {
  if (pids.length === 0) {
    return;
  }

  const killablePids = [];

  for (const pid of pids) {
    const command = readPidCommand(pid);
    if (!isDevServerCommand(command)) {
      throw new Error(`Port is already in use by a non-dev-server process: ${command}`);
    }
    killablePids.push(pid);
  }

  const result = spawnSync("kill", killablePids, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Failed to kill processes: ${killablePids.join(", ")}`);
  }
}

const port = readPort();
const stalePids = listPidsOnPort(port);
killPids(stalePids);

const child = spawn("hugo", ["server", "--source", ".", "--disableFastRender", "--port", String(port)], {
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
