"""Run the API and Vite together on macOS/Linux; clean up both process groups."""

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def stop(processes: list[subprocess.Popen]) -> None:
    for process in processes:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    for process in processes:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()


def interrupt(_signal, _frame) -> None:
    raise KeyboardInterrupt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-port", type=int, default=8000)
    parser.add_argument("--frontend-port", type=int, default=5173)
    args = parser.parse_args()
    ports = (args.backend_port, args.frontend_port)
    if len(set(ports)) != 2 or any(not 1 <= port <= 65535 for port in ports):
        parser.error("Choose two different ports between 1 and 65535.")
    for port in ports:
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                print(
                    f"Port {port} is unavailable. Stop the existing server, or use "
                    "make dev BACKEND_PORT=8001 FRONTEND_PORT=5174.",
                    file=sys.stderr,
                )
                return 1

    environment = {
        **os.environ,
        "API_PROXY_TARGET": f"http://127.0.0.1:{args.backend_port}",
    }
    commands = [
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--app-dir",
            "backend",
            "--host",
            "127.0.0.1",
            "--port",
            str(args.backend_port),
            "--reload",
            "--reload-dir",
            "backend",
        ],
        [
            "npm",
            "--prefix",
            "frontend",
            "run",
            "dev",
            "--",
            "--port",
            str(args.frontend_port),
            "--strictPort",
        ],
    ]
    signal.signal(signal.SIGINT, interrupt)
    signal.signal(signal.SIGTERM, interrupt)
    processes: list[subprocess.Popen] = []
    try:
        for command in commands:
            processes.append(
                subprocess.Popen(
                    command, cwd=ROOT, env=environment, start_new_session=True
                )
            )
        print(
            f"\nOpen http://127.0.0.1:{args.frontend_port}. Ctrl+C stops both servers.\n",
            flush=True,
        )
        while True:
            for process in processes:
                if process.poll() is not None:
                    print(
                        "A development server exited; stopping the other server.",
                        file=sys.stderr,
                    )
                    return process.returncode or 1
            time.sleep(0.2)
    except KeyboardInterrupt:
        return 0
    finally:
        # Ignore repeated interrupts while draining the children.
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        stop(processes)


if __name__ == "__main__":
    raise SystemExit(main())
