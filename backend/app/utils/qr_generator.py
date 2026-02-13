import qrcode
import io
import json
import base64
from typing import Optional, Any, Dict

def generate_beam_matrix(
    action: str,
    target_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    token: Optional[str] = None,
    expiration: Optional[int] = None
) -> io.BytesIO:
    """
    Generate a QR code for the Noosphere Beam protocol (MTR Vol. III).
    
    Schema: noosphere://{action}?param=value...
    
    Args:
        action: 'beam', 'auth', or 'sync'
        target_id: Device ID (for beam)
        payload: Dict to be serialized to JSON -> Base64URL
        token: Auth token (for auth)
        expiration: Timestamp (for auth)
        
    Returns:
        io.BytesIO: PNG image stream
    """
    # Base URI
    uri = f"noosphere://{action}"
    params = []
    
    # Add parameters
    if target_id:
        params.append(f"target={target_id}")
    
    if token:
        params.append(f"token={token}")
        
    if expiration:
        params.append(f"expiry={expiration}")
        
    if payload:
        # JSON Serialize -> Bytes -> Base64URL -> String
        json_str = json.dumps(payload)
        b64_bytes = base64.urlsafe_b64encode(json_str.encode('utf-8'))
        b64_str = b64_bytes.decode('utf-8').rstrip('=') # Remove padding for URL safety
        params.append(f"payload={b64_str}")
    
    # Construct full URI with query string
    if params:
        uri += "?" + "&".join(params)
        
    # Create QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H, # 30% damage recovery
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)
    
    # Generate image with Noosphere branding
    img = qr.make_image(fill_color="#4B0082", back_color="white")
    
    byte_stream = io.BytesIO()
    img.save(byte_stream, format="PNG")
    byte_stream.seek(0)
    
    return byte_stream
