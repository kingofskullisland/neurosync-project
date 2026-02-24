#!/usr/bin/env python3
"""
NeuroSync Session Manager
Manages SSH and RDP sessions for model-to-model communication.
The LLM can request SSH commands on remote hosts or launch RDP sessions.
"""
import asyncio
import json
import os
import subprocess
from datetime import datetime
from typing import Any, Dict, Optional

# ─── SSH Session ─────────────────────────────────────────────

class SSHSession:
    """Async SSH session wrapper using asyncssh."""

    def __init__(self, host: str, username: str, port: int = 22,
                 key_path: Optional[str] = None, password: Optional[str] = None):
        self.host = host
        self.username = username
        self.port = port
        self.key_path = key_path
        self.password = password
        self._conn = None

    async def connect(self):
        """Establish SSH connection."""
        try:
            import asyncssh

            connect_kwargs = {
                "host": self.host,
                "port": self.port,
                "username": self.username,
                "known_hosts": None,  # Accept all for LAN usage
            }

            if self.key_path:
                connect_kwargs["client_keys"] = [self.key_path]
            elif self.password:
                connect_kwargs["password"] = self.password

            self._conn = await asyncssh.connect(**connect_kwargs)
            return {"success": True, "message": f"Connected to {self.host}:{self.port}"}

        except ImportError:
            return {"success": False, "error": "asyncssh not installed. pip install asyncssh"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def run_command(self, command: str, timeout: int = 30) -> Dict[str, Any]:
        """Execute command on remote host."""
        if not self._conn:
            return {"success": False, "error": "Not connected"}

        try:
            result = await asyncio.wait_for(
                self._conn.run(command, check=False),
                timeout=timeout
            )
            return {
                "success": True,
                "stdout": result.stdout.strip() if result.stdout else "",
                "stderr": result.stderr.strip() if result.stderr else "",
                "exit_code": result.exit_status,
            }
        except asyncio.TimeoutError:
            return {"success": False, "error": f"Command timed out ({timeout}s)"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def disconnect(self):
        """Close SSH connection."""
        if self._conn:
            self._conn.close()
            self._conn = None


# ─── RDP Session ─────────────────────────────────────────────

def launch_rdp(host: str, username: Optional[str] = None,
               fullscreen: bool = False) -> Dict[str, Any]:
    """Launch an RDP session to a remote host using mstsc.exe."""
    try:
        cmd = ["mstsc.exe", f"/v:{host}"]

        if fullscreen:
            cmd.append("/f")
        else:
            cmd.extend(["/w:1280", "/h:720"])

        # Create an .rdp file for more control if username provided
        if username:
            rdp_dir = os.path.join(os.path.expanduser("~"), ".neurosync")
            os.makedirs(rdp_dir, exist_ok=True)
            rdp_file = os.path.join(rdp_dir, f"session_{host.replace('.', '_')}.rdp")

            with open(rdp_file, "w") as f:
                f.write(f"full address:s:{host}\n")
                f.write(f"username:s:{username}\n")
                f.write("prompt for credentials:i:1\n")
                f.write("screen mode id:i:{'2' if fullscreen else '1'}\n")
                f.write("desktopwidth:i:1280\n")
                f.write("desktopheight:i:720\n")
                f.write("use multimon:i:0\n")
                f.write("authentication level:i:2\n")

            cmd = ["mstsc.exe", rdp_file]

        subprocess.Popen(cmd, shell=False,
                         stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL)

        return {
            "success": True,
            "host": host,
            "action": "rdp_launched",
            "message": f"RDP session launched to {host}",
        }

    except FileNotFoundError:
        return {"success": False, "error": "mstsc.exe not found — Windows only"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Session Manager ─────────────────────────────────────────

class SessionManager:
    """
    Manages SSH/RDP sessions for model-to-model orchestration.
    Called by host-bridge.py when LLM emits {"target": "remote", ...}.
    """

    # Whitelist of allowed SSH hosts (configurable via env or config file)
    ALLOWED_HOSTS_ENV = os.getenv("NEUROSYNC_ALLOWED_HOSTS", "")

    def __init__(self):
        self.active_ssh: Dict[str, SSHSession] = {}
        self.allowed_hosts = self._load_allowed_hosts()

    def _load_allowed_hosts(self) -> set:
        """Load allowed hosts from env var (comma-separated) or allow all LAN."""
        if self.ALLOWED_HOSTS_ENV:
            return set(h.strip() for h in self.ALLOWED_HOSTS_ENV.split(",") if h.strip())
        # Default: allow common LAN ranges
        return set()  # Empty = will check _is_lan_host()

    def _is_allowed(self, host: str) -> bool:
        """Check if host is in the whitelist or on the LAN."""
        if self.allowed_hosts and host in self.allowed_hosts:
            return True
        return self._is_lan_host(host)

    @staticmethod
    def _is_lan_host(host: str) -> bool:
        """Check if host is a LAN address (basic check)."""
        return (
            host.startswith("192.168.") or
            host.startswith("10.") or
            host.startswith("172.") or
            host.startswith("100.") or  # Tailscale
            host == "localhost" or
            host == "127.0.0.1"
        )

    async def ssh_command(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a command on a remote host via SSH."""
        host = params.get("host")
        command = params.get("command")
        username = params.get("username", os.getenv("USER", "admin"))
        port = params.get("port", 22)
        key_path = params.get("key_path")
        password = params.get("password")

        if not host or not command:
            return {"success": False, "error": "Missing 'host' or 'command' parameter"}

        if not self._is_allowed(host):
            return {"success": False, "error": f"Host '{host}' not in allowed list. Set NEUROSYNC_ALLOWED_HOSTS env var."}

        # Reuse existing session or create new
        session_key = f"{username}@{host}:{port}"
        session = self.active_ssh.get(session_key)

        if not session:
            session = SSHSession(host, username, port, key_path, password)
            conn_result = await session.connect()
            if not conn_result["success"]:
                return conn_result
            self.active_ssh[session_key] = session

        result = await session.run_command(command)
        print(f"[SESSION] SSH {session_key} → {command[:60]}... → exit={result.get('exit_code')}")
        return result

    def rdp_launch(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Launch an RDP session to a remote host."""
        host = params.get("host")
        username = params.get("username")
        fullscreen = params.get("fullscreen", False)

        if not host:
            return {"success": False, "error": "Missing 'host' parameter"}

        if not self._is_allowed(host):
            return {"success": False, "error": f"Host '{host}' not in allowed list"}

        print(f"[SESSION] RDP → {host}")
        return launch_rdp(host, username, fullscreen)

    async def execute(self, action: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Dispatch a remote session action."""
        params = params or {}
        print(f"[SESSION] {datetime.now().strftime('%H:%M:%S')} → {action}({json.dumps(params)[:100]})")

        if action == "ssh_command":
            return await self.ssh_command(params)
        elif action == "rdp_launch":
            return self.rdp_launch(params)
        else:
            return {
                "success": False,
                "error": f"Unknown session action: {action}",
                "available_actions": ["ssh_command", "rdp_launch"],
            }

    async def cleanup(self):
        """Close all active sessions."""
        for key, session in self.active_ssh.items():
            await session.disconnect()
            print(f"[SESSION] Closed SSH: {key}")
        self.active_ssh.clear()


# ─── Self-Test ───────────────────────────────────────────────

if __name__ == "__main__":
    async def test():
        mgr = SessionManager()
        print("=== NeuroSync Session Manager Self-Test ===\n")

        # Test RDP launch (won't actually connect, just tests the flow)
        print("1. RDP Launch (dry run):")
        result = mgr.rdp_launch({"host": "192.168.1.100"})
        print(f"   {result}\n")

        # Test SSH (requires asyncssh + a real host)
        print("2. SSH Command (will fail without a real target):")
        result = await mgr.execute("ssh_command", {
            "host": "192.168.1.100",
            "command": "uptime",
            "username": "admin",
        })
        print(f"   {result}\n")

        await mgr.cleanup()

    asyncio.run(test())
