from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal
from enum import Enum

class BeamAction(str, Enum):
    BEAM = "beam"
    AUTH = "auth"
    SYNC = "sync"

class BeamRequest(BaseModel):
    """
    Request model for generating a Noosphere Beam QR code.
    Follows the MTR Vol. III spec.
    """
    action: BeamAction = Field(default=BeamAction.BEAM, description="The action to perform (beam, auth, sync)")
    target_id: Optional[str] = Field(None, description="Target device ID")
    payload: Optional[Dict[str, Any]] = Field(None, description="Arbitrary JSON payload to be Base64 encoded")
    expiration: Optional[int] = Field(None, description="Expiration timestamp (for auth tokens)")
    token: Optional[str] = Field(None, description="Auth token (specific to auth action)")
