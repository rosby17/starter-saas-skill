import os from "node:os";
import { readFile, statfs } from "node:fs/promises";

type CpuSnapshot = { total: number; idle: number; steal: number };
type MetricStatus = "ok" | "warning" | "critical" | "unavailable";

function statusFor(value: number | null, warning: number, critical: number): MetricStatus {
  if (value === null || !Number.isFinite(value)) return "unavailable";
  if (value >= critical) return "critical";
  if (value >= warning) return "warning";
  return "ok";
}

async function readCpuSnapshot(): Promise<CpuSnapshot | null> {
  try {
    const content = await readFile("/proc/stat", "utf8");
    const line = content.split("\n").find((entry) => /^cpu\s/.test(entry));
    if (!line) return null;
    const values = line.trim().split(/\s+/).slice(1).map(Number);
    const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = values;
    const total = user + nice + system + idle + iowait + irq + softirq + steal;
    return { total, idle: idle + iowait, steal };
  } catch {
    return null;
  }
}

export async function collectLocalMetrics() {
  const before = await readCpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const after = await readCpuSnapshot();
  const totalDelta = before && after ? after.total - before.total : 0;
  const idleDelta = before && after ? after.idle - before.idle : 0;
  const stealDelta = before && after ? after.steal - before.steal : 0;
  const cpuUsage = totalDelta > 0 ? Math.max(0, Math.min(100, ((totalDelta - idleDelta - stealDelta) / totalDelta) * 100)) : null;
  const cpuSteal = totalDelta > 0 ? Math.max(0, Math.min(100, (stealDelta / totalDelta) * 100)) : null;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  let diskUsed: number | null = null;
  try {
    const disk = await statfs("/");
    const totalBytes = Number(disk.blocks) * Number(disk.bsize);
    const freeBytes = Number(disk.bavail) * Number(disk.bsize);
    diskUsed = totalBytes > 0 ? ((totalBytes - freeBytes) / totalBytes) * 100 : null;
  } catch {
    diskUsed = null;
  }

  const load = os.loadavg();
  const cores = Math.max(1, os.cpus().length);
  return {
    source: "runtime" as const,
    scope: "runtime" as const,
    hostname: os.hostname(),
    collectedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(os.uptime()),
    cpu: {
      usagePercent: cpuUsage,
      stealPercent: cpuSteal,
      cores,
      load1: load[0] ?? null,
      load5: load[1] ?? null,
      load15: load[2] ?? null,
      status: statusFor(Math.max(cpuUsage ?? 0, cpuSteal ?? 0), 75, 90),
    },
    memory: {
      usedBytes: totalMemory - freeMemory,
      totalBytes: totalMemory,
      usedPercent: totalMemory > 0 ? ((totalMemory - freeMemory) / totalMemory) * 100 : null,
      status: statusFor(totalMemory > 0 ? ((totalMemory - freeMemory) / totalMemory) * 100 : null, 80, 90),
    },
    disk: {
      usedPercent: diskUsed,
      status: statusFor(diskUsed, 80, 90),
    },
    serverStatus: statusFor(Math.max(cpuUsage ?? 0, cpuSteal ?? 0, (totalMemory > 0 ? ((totalMemory - freeMemory) / totalMemory) * 100 : 0), diskUsed ?? 0), 75, 90),
  };
}

export async function collectRemoteMetrics(url: string) {
  const headers: HeadersInit = { accept: "application/json" };
  if (process.env.SERVER_METRICS_TOKEN) headers.authorization = `Bearer ${process.env.SERVER_METRICS_TOKEN}`;
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(1800) });
  if (!response.ok) throw new Error(`metrics agent returned ${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== "object" || !data.cpu || !data.memory || !data.disk) throw new Error("invalid metrics payload");
  return { ...data, source: "agent", scope: "host" };
}

