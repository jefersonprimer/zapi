use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    #[serde(rename = "call:start")]
    CallStart {
        #[serde(default)]
        call_id: Option<Uuid>,
        target_user_id: Uuid,
        #[serde(default)]
        caller_username: Option<String>,
        #[serde(default)]
        caller_avatar_url: Option<String>,
        #[serde(default)]
        is_video: Option<bool>,
    },
    #[serde(rename = "call:ringing")]
    CallRinging {
        call_id: Uuid,
        caller_id: Uuid,
    },
    #[serde(rename = "call:accepted")]
    CallAccepted {
        call_id: Uuid,
    },
    #[serde(rename = "call:rejected")]
    CallRejected {
        call_id: Uuid,
    },
    #[serde(rename = "call:busy")]
    CallBusy {
        call_id: Uuid,
    },
    #[serde(rename = "call:ended")]
    CallEnded {
        call_id: Uuid,
    },
    #[serde(rename = "call:failed")]
    CallFailed {
        call_id: Uuid,
        reason: String,
    },
    #[serde(rename = "offer")]
    Offer {
        call_id: Uuid,
        sdp: String,
    },
    #[serde(rename = "answer")]
    Answer {
        call_id: Uuid,
        sdp: String,
    },
    #[serde(rename = "iceCandidate")]
    IceCandidate {
        call_id: Uuid,
        candidate: serde_json::Value,
    },
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
    #[serde(rename = "presence")]
    Presence {
        user_id: Uuid,
        status: String, // "online" or "offline"
    },
}
