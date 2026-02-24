#!/usr/bin/env python3
"""
NeuroSync PC Executor
Executes Windows-targeted actions on behalf of the LLM routing layer.
Called by host-bridge.py when the LLM emits {"target": "windows", ...}.
"""
import base64
import io
import json
import os
import subprocess
import sys
from datetime import datetime
from typing import Any, Dict

# ─── Audio Control (pycaw) ──────────────────────────────────

def mute_audio(params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Toggle or set system audio mute state."""
    try:
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))

        current_mute = volume.GetMute()

        # If explicit state requested
        if params and "state" in params:
            desired = params["state"]  # "mute" or "unmute"
            if desired == "mute":
                volume.SetMute(1, None)
                return {"success": True, "muted": True, "action": "muted"}
            else:
                volume.SetMute(0, None)
                return {"success": True, "muted": False, "action": "unmuted"}

        # Toggle
        volume.SetMute(0 if current_mute else 1, None)
        new_state = not current_mute
        return {
            "success": True,
            "muted": new_state,
            "action": "muted" if new_state else "unmuted",
        }

    except ImportError:
        return _fallback_mute_nircmd(params)
    except Exception as e:
        return {"success": False, "error": str(e)}


def _fallback_mute_nircmd(params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Fallback mute using nircmd (if pycaw unavailable)."""
    try:
        subprocess.run(["nircmd", "mutesysvolume", "2"], check=True,
                       capture_output=True, timeout=5)
        return {"success": True, "action": "toggled (nircmd fallback)"}
    except FileNotFoundError:
        return {"success": False, "error": "Neither pycaw nor nircmd available"}
    except Exception as e:
        return {"success": False, "error": f"nircmd fallback failed: {e}"}


# ─── Screen Capture ─────────────────────────────────────────

def capture_screen(params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Capture the PC desktop screen."""
    try:
        import mss

        output_dir = params.get("output_dir", os.path.expanduser("~/Desktop")) if params else os.path.expanduser("~/Desktop")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"neurosync_capture_{timestamp}.png"
        filepath = os.path.join(output_dir, filename)

        with mss.mss() as sct:
            monitor = params.get("monitor", 1) if params else 1
            screenshot = sct.grab(sct.monitors[monitor])

            # Save to file
            mss.tools.to_png(screenshot.rgb, screenshot.size, output=filepath)

            # Also return base64 thumbnail for sending back to Android
            from PIL import Image
            img = Image.frombytes("RGB", screenshot.size, screenshot.rgb)
            img.thumbnail((320, 180))
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=60)
            thumb_b64 = base64.b64encode(buffer.getvalue()).decode()

        return {
            "success": True,
            "filepath": filepath,
            "thumbnail_b64": thumb_b64,
            "resolution": f"{screenshot.size[0]}x{screenshot.size[1]}",
        }

    except ImportError as e:
        missing = "mss" if "mss" in str(e) else "PIL"
        return {"success": False, "error": f"Missing dependency: {missing}. pip install mss Pillow"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Launch Application ─────────────────────────────────────

# Whitelist of safe applications
SAFE_APPS = {
    "notepad": "notepad.exe",
    "calculator": "calc.exe",
    "explorer": "explorer.exe",
    "terminal": "wt.exe",
    "powershell": "powershell.exe",
    "cmd": "cmd.exe",
    "browser": "start",
    "chrome": "chrome.exe",
    "firefox": "firefox.exe",
    "edge": "msedge.exe",
    "vscode": "code",
    "task_manager": "taskmgr.exe",
    "settings": "ms-settings:",
    "paint": "mspaint.exe",
    "snip": "SnippingTool.exe",
}


def launch_app(params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Launch a Windows application from the safe whitelist."""
    if not params or "app" not in params:
        return {
            "success": False,
            "error": "Missing 'app' parameter",
            "available_apps": list(SAFE_APPS.keys()),
        }

    app_name = params["app"].lower().strip()

    if app_name not in SAFE_APPS:
        return {
            "success": False,
            "error": f"App '{app_name}' not in whitelist",
            "available_apps": list(SAFE_APPS.keys()),
        }

    exe = SAFE_APPS[app_name]

    try:
        if exe.startswith("ms-settings:") or exe == "start":
            # URI-based launch
            args = params.get("args", "")
            target = exe if exe != "start" else args
            os.startfile(target)
        else:
            args = params.get("args", "")
            cmd = [exe] + (args.split() if args else [])
            subprocess.Popen(cmd, shell=False,
                             stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)

        return {"success": True, "launched": app_name, "exe": exe}

    except FileNotFoundError:
        return {"success": False, "error": f"Executable not found: {exe}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Action Dispatcher ───────────────────────────────────────

ACTION_MAP = {
    "mute_audio": mute_audio,
    "capture_screen": capture_screen,
    "launch_app": launch_app,
}


def execute(action: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Execute a Windows action.
    Returns a result dict with at minimum {"success": bool}.
    """
    handler = ACTION_MAP.get(action)
    if not handler:
        return {
            "success": False,
            "error": f"Unknown Windows action: {action}",
            "available_actions": list(ACTION_MAP.keys()),
        }

    print(f"[PC_EXEC] {datetime.now().strftime('%H:%M:%S')} → {action}({json.dumps(params or {})})")
    result = handler(params)
    print(f"[PC_EXEC] Result: {json.dumps(result, default=str)[:200]}")
    return result


# ─── Self-Test ───────────────────────────────────────────────

if __name__ == "__main__":
    print("=== NeuroSync PC Executor Self-Test ===\n")

    # Test audio (safe — just reports state)
    print("1. Mute Audio (toggle):")
    print(f"   {execute('mute_audio')}\n")

    # Test screen capture
    print("2. Capture Screen:")
    print(f"   {execute('capture_screen')}\n")

    # Test app launch (notepad)
    print("3. Launch Notepad:")
    print(f"   {execute('launch_app', {'app': 'notepad'})}\n")

    # Test unknown action
    print("4. Unknown Action:")
    print(f"   {execute('delete_everything')}\n")
