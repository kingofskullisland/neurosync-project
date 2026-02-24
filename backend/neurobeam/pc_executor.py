import subprocess
import os

try:
    import mss
except ImportError:
    mss = None

try:
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
except ImportError:
    AudioUtilities = None


def execute(action: str, params: dict = None) -> dict:
    """Executes a Windows specific action locally."""
    
    if action == "mute_audio":
        if not AudioUtilities:
           return {"status": "error", "message": "pycaw/comtypes not installed. Cannot control audio."}
        try:
            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            # Use cast carefully to match the expected pointer type
            import ctypes
            volume = ctypes.cast(interface, ctypes.POINTER(IAudioEndpointVolume))
            
            # Toggle mute: if muted, unmute. If unmuted, mute.
            current_mute = volume.GetMute()
            new_mute = 0 if current_mute else 1
            volume.SetMute(new_mute, None)
            
            state_str = "muted" if new_mute else "unmuted"
            return {"status": "success", "message": f"System audio {state_str}."}
        except Exception as e:
             return {"status": "error", "message": f"Failed to control audio: {e}"}

    elif action == "capture_screen":
        if not mss:
             return {"status": "error", "message": "mss not installed. Cannot capture screen."}
        try:
            with mss.mss() as sct:
                filename = "noosphere_capture.png"
                sct.shot(output=filename)
            return {"status": "success", "message": f"Screen captured to {filename}."}
        except Exception as e:
            return {"status": "error", "message": f"Failed to capture screen: {e}"}

    elif action == "launch_app":
        # SECURITY: Strict allowlist for AI-driven application launches
        allowed_apps = {
            "notepad": "notepad.exe",
            "calc": "calc.exe",
            "terminal": "wt.exe",
            "explorer": "explorer.exe",
            "edge": "msedge.exe"
        }
        
        target = params.get("app") if params else None
        target = target.lower() if target else None

        if target in allowed_apps:
            try:
                subprocess.Popen(allowed_apps[target])
                return {"status": "success", "message": f"{target} launched successfully."}
            except Exception as e:
                return {"status": "error", "message": f"Failed to launch {target}: {e}"}
        else:
             return {"status": "error", "message": f"Unauthorized or unknown app target: {target}. Allowed apps: {list(allowed_apps.keys())}"}

    return {"status": "error", "message": f"Unknown Windows action: {action}"}
