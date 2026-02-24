import sys
import qrcode
import io

def generate_qr_ascii(data):
    qr = qrcode.QRCode(border=1)
    qr.add_data(data)
    qr.make(fit=True)
    
    # Use StringIO to capture output
    f = io.StringIO()
    qr.print_ascii(out=f, invert=True)
    return f.getvalue()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 gen_qr.py <url>")
        sys.exit(1)
        
    url = sys.argv[1]
    
    # Print Header
    print("\n\033[1;36m╔══════════════════════════════════════════════════════╗")
    print("║            NEUROBEAM CONNECTION MATRIX               ║")
    print("╚══════════════════════════════════════════════════════╝\033[0m")
    
    print(f"\nScanning Target: \033[1;33m{url}\033[0m\n")
    
    try:
        print(generate_qr_ascii(url))
        print("\033[1;32m[SCAN TO INITIALIZE LINK]\033[0m\n")
    except Exception as e:
        print(f"QR Generation Error: {e}")
