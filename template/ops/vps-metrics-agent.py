#!/usr/bin/env python3
"""Small, dependency-free host metrics endpoint for the admin dashboard."""

import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


TOKEN = os.environ["METRICS_TOKEN"]
HOST = os.environ.get("METRICS_HOST", "172.16.1.1")
PORT = int(os.environ.get("METRICS_PORT", "9101"))


def cpu_snapshot():
    fields = open("/proc/stat", encoding="utf-8").readline().split()[1:]
    values = [int(value) for value in fields]
    user, nice, system, idle, iowait, irq, softirq, steal = (values + [0] * 8)[:8]
    return {
        "total": sum(values),
        "idle": idle + iowait,
        "steal": steal,
    }


def metrics():
    before = cpu_snapshot()
    time.sleep(0.15)
    after = cpu_snapshot()
    total = after["total"] - before["total"]
    idle = after["idle"] - before["idle"]
    steal = after["steal"] - before["steal"]
    usage = max(0.0, min(100.0, ((total - idle - steal) / total) * 100)) if total else None
    steal_percent = max(0.0, min(100.0, (steal / total) * 100)) if total else None

    meminfo = {}
    for line in open("/proc/meminfo", encoding="utf-8"):
        key, value, *_ = line.split()
        meminfo[key.rstrip(":")] = int(value) * 1024
    total_memory = meminfo.get("MemTotal", 0)
    available_memory = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
    used_memory = max(0, total_memory - available_memory)
    stat = os.statvfs("/")
    total_disk = stat.f_blocks * stat.f_frsize
    free_disk = stat.f_bavail * stat.f_frsize
    load = os.getloadavg()

    def status(value, warning, critical):
        if value is None:
            return "unavailable"
        return "critical" if value >= critical else "warning" if value >= warning else "ok"

    cpu_status = status(max(value for value in (usage or 0, steal_percent or 0)), 75, 90)
    memory_percent = (used_memory / total_memory * 100) if total_memory else None
    disk_percent = ((total_disk - free_disk) / total_disk * 100) if total_disk else None
    overall = status(max(value for value in (usage or 0, steal_percent or 0, memory_percent or 0, disk_percent or 0)), 75, 90)
    return {
        "source": "agent",
        "scope": "host",
        "hostname": os.uname().nodename,
        "collectedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "uptimeSeconds": int(float(open("/proc/uptime", encoding="utf-8").read().split()[0])),
        "cpu": {"usagePercent": usage, "stealPercent": steal_percent, "cores": os.cpu_count() or 1, "load1": load[0], "load5": load[1], "load15": load[2], "status": cpu_status},
        "memory": {"usedBytes": used_memory, "totalBytes": total_memory, "usedPercent": memory_percent, "status": status(memory_percent, 80, 90)},
        "disk": {"usedPercent": disk_percent, "status": status(disk_percent, 80, 90)},
        "serverStatus": overall,
    }


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/metrics":
            self.send_error(404)
            return
        if self.headers.get("Authorization") != f"Bearer {TOKEN}":
            self.send_error(401)
            return
        body = json.dumps(metrics(), separators=(",", ":")).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        return


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
