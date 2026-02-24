import socket

# Bind to 0.0.0.0 to accept from Tailscale interface
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind(('0.0.0.0', 5000)) 
s.listen(1)

conn, addr = s.accept()
print(f"Connected by Neuralink App at {addr}")
while True:
    data = conn.recv(1024)
    if not data: break
    # Process Neuralink signal data...
