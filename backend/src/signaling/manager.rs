use std::sync::Arc;
use dashmap::DashMap;
use tokio::sync::mpsc;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::Utc;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CallState {
    Idle,
    Calling,
    Ringing,
    Connecting,
    Connected,
    Ended,
    Failed,
    Missed,
    Rejected,
    Busy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveCall {
    pub call_id: Uuid,
    pub caller_id: Uuid,
    pub callee_id: Uuid,
    pub state: CallState,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PresenceState {
    Active,
    Background,
}

#[derive(Clone, Default)]
pub struct CallManager {
    // Maps call_id -> ActiveCall details
    pub active_calls: Arc<DashMap<Uuid, ActiveCall>>,
    // Maps user_id -> call_id (tracks if a user is currently in a call)
    pub user_calls: Arc<DashMap<Uuid, Uuid>>,
    // Maps user_id -> WebSocket sender channel (active connections)
    pub peers: Arc<DashMap<Uuid, mpsc::UnboundedSender<String>>>,
    // Maps user_id -> PresenceState
    pub presence: Arc<DashMap<Uuid, PresenceState>>,
}

impl CallManager {
    pub fn new() -> Self {
        Self {
            active_calls: Arc::new(DashMap::new()),
            user_calls: Arc::new(DashMap::new()),
            peers: Arc::new(DashMap::new()),
            presence: Arc::new(DashMap::new()),
        }
    }

    // Peer Management
    pub fn register_peer(&self, user_id: Uuid, tx: mpsc::UnboundedSender<String>) {
        self.peers.insert(user_id, tx);
        self.presence.insert(user_id, PresenceState::Active);
    }

    pub fn unregister_peer(&self, user_id: Uuid) {
        self.peers.remove(&user_id);
        self.presence.remove(&user_id);
        // If the user disconnected, clean up any active calls they were in
        if let Some((_, call_id)) = self.user_calls.remove(&user_id) {
            self.terminate_call(call_id, "peer disconnected").ok();
        }
    }

    pub fn send_to_user(&self, user_id: Uuid, message: &str) -> bool {
        if let Some(tx) = self.peers.get(&user_id) {
            tx.send(message.to_string()).is_ok()
        } else {
            false
        }
    }

    pub fn is_online(&self, user_id: Uuid) -> bool {
        self.peers.contains_key(&user_id)
    }

    pub fn get_presence(&self, user_id: Uuid) -> Option<PresenceState> {
        self.presence.get(&user_id).map(|r| *r)
    }

    pub fn update_presence(&self, user_id: Uuid, state: PresenceState) {
        self.presence.insert(user_id, state);
    }

    // Call Actions
    pub fn start_call(&self, caller_id: Uuid, callee_id: Uuid) -> Result<Uuid, String> {
        // Prevent calls to self
        if caller_id == callee_id {
            return Err("Cannot call yourself".to_string());
        }

        // Check if caller is already busy
        if self.user_calls.contains_key(&caller_id) {
            return Err("You are already in an active call".to_string());
        }

        // Check if callee is busy
        if self.user_calls.contains_key(&callee_id) {
            return Err("Recipient is busy in another call".to_string());
        }

        let call_id = Uuid::new_v4();
        let call = ActiveCall {
            call_id,
            caller_id,
            callee_id,
            state: CallState::Calling,
            created_at: Utc::now(),
        };

        self.active_calls.insert(call_id, call);
        self.user_calls.insert(caller_id, call_id);
        self.user_calls.insert(callee_id, call_id);

        Ok(call_id)
    }

    pub fn set_call_ringing(&self, call_id: Uuid) -> Result<(), String> {
        if let Some(mut call) = self.active_calls.get_mut(&call_id) {
            if call.state == CallState::Calling {
                call.state = CallState::Ringing;
                Ok(())
            } else {
                Err(format!("Cannot ring from state {:?}", call.state))
            }
        } else {
            Err("Call not found".to_string())
        }
    }

    pub fn accept_call(&self, call_id: Uuid, callee_id: Uuid) -> Result<(), String> {
        if let Some(mut call) = self.active_calls.get_mut(&call_id) {
            if call.callee_id != callee_id {
                return Err("Unauthorized call acceptance".to_string());
            }
            call.state = CallState::Connecting;
            Ok(())
        } else {
            Err("Call not found".to_string())
        }
    }

    pub fn update_webrtc_connected(&self, call_id: Uuid) -> Result<(), String> {
        if let Some(mut call) = self.active_calls.get_mut(&call_id) {
            call.state = CallState::Connected;
            Ok(())
        } else {
            Err("Call not found".to_string())
        }
    }

    pub fn end_call(&self, call_id: Uuid, user_id: Uuid) -> Result<ActiveCall, String> {
        if let Some(call) = self.active_calls.get(&call_id) {
            if call.caller_id != user_id && call.callee_id != user_id {
                return Err("Unauthorized".to_string());
            }
        } else {
            return Err("Call not found".to_string());
        }

        self.terminate_call(call_id, "Call ended by user")
    }

    pub fn terminate_call(&self, call_id: Uuid, _reason: &str) -> Result<ActiveCall, String> {
        if let Some((_, call)) = self.active_calls.remove(&call_id) {
            self.user_calls.remove(&call.caller_id);
            self.user_calls.remove(&call.callee_id);
            Ok(call)
        } else {
            Err("Call not found".to_string())
        }
    }
}
