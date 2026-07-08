use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

type Sender = mpsc::UnboundedSender<String>;

#[derive(Clone, Default)]
pub struct WsState {
    rooms: Arc<RwLock<HashMap<Uuid, Vec<Sender>>>>,
}

impl WsState {
    pub async fn subscribe(&self, chat_id: Uuid, sender: Sender) {
        let mut rooms = self.rooms.write().await;
        rooms.entry(chat_id).or_default().push(sender);
    }

    pub async fn unsubscribe(&self, chat_id: Uuid, sender: &Sender) {
        let mut rooms = self.rooms.write().await;
        if let Some(senders) = rooms.get_mut(&chat_id) {
            senders.retain(|s| !s.same_channel(sender));
            if senders.is_empty() {
                rooms.remove(&chat_id);
            }
        }
    }

    pub async fn broadcast(&self, chat_id: Uuid, message: &str) {
        let rooms = self.rooms.read().await;
        if let Some(senders) = rooms.get(&chat_id) {
            for sender in senders {
                let _ = sender.send(message.to_string());
            }
        }
    }
}
