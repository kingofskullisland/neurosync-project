import asyncio
import subprocess

try:
    import asyncssh
except ImportError:
    asyncssh = None

# SECURITY: Hardcoded sanctified nodes. Do not let the AI define arbitrary IP addresses.
AUTHORIZED_NODES = [
    "192.168.1.50", 
    "10.0.0.5",
    "127.0.0.1",
    "localhost"
]

async def ssh_command(host: str, command: str) -> dict:
    """Executes a command over SSH on an authorized host."""
    if not asyncssh:
        return {"status": "error", "message": "asyncssh not installed. Cannot use SSH."}
        
    if host not in AUTHORIZED_NODES:
        return {"status": "error", "message": f"Host {host} not sanctified for Noosphere SSH link."}
    
    try:
        # Assumes key-based authentication is pre-configured
        # 'neurosync' is the assumed username logic provided by the snippet
        async with asyncssh.connect(host, username='neurosync', client_keys=['id_rsa']):
            result = await asyncssh.run(command)
            return {"status": "success", "output": result.stdout}
    except Exception as e:
        return {"status": "error", "message": f"SSH connection failed: {str(e)}"}

def rdp_launch(host: str) -> dict:
    """Launches an RDP session to an authorized host."""
    if host not in AUTHORIZED_NODES:
        return {"status": "error", "message": f"Host {host} not sanctified for Noosphere RDP link."}
    
    try:
        subprocess.Popen(["mstsc.exe", f"/v:{host}"])
        return {"status": "success", "message": f"RDP session initiated to {host}."}
    except Exception as e:
         return {"status": "error", "message": f"Failed to launch RDP: {e}"}
