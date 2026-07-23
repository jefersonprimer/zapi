"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Community,
  CommunityChannel,
  CommunityMessage,
  CommunityPost,
  CommunityComment,
  CommunityEvent,
  CommunityMember,
  CreateCommunityPayload,
  CreateChannelPayload,
  CreatePostPayload,
  CreateEventPayload,
  EventRsvpStatus,
  MemberRole,
} from "@/lib/community-types";
import { communityApi } from "@/lib/community-api";

// Component imports
import { CommunityServerList } from "@/components/communities/CommunityServerList";
import { CommunitySidebar } from "@/components/communities/CommunitySidebar";
import { CommunityHeader } from "@/components/communities/CommunityHeader";
import { CommunityChatView } from "@/components/communities/CommunityChatView";
import { CommunityPostsView } from "@/components/communities/CommunityPostsView";
import { CommunityEventsView } from "@/components/communities/CommunityEventsView";
import { CommunityMemberList } from "@/components/communities/CommunityMemberList";
import { CommunityExploreView } from "@/components/communities/CommunityExploreView";

// Modal imports
import { CreateCommunityModal } from "@/components/communities/modals/CreateCommunityModal";
import { CreateChannelModal } from "@/components/communities/modals/CreateChannelModal";
import { CreatePostModal } from "@/components/communities/modals/CreatePostModal";
import { CreateEventModal } from "@/components/communities/modals/CreateEventModal";
import { CommunitySettingsModal } from "@/components/communities/modals/CommunitySettingsModal";
import { JoinCommunityModal } from "@/components/communities/modals/JoinCommunityModal";
import { CommunityPostDetailModal } from "@/components/communities/modals/CommunityPostDetailModal";

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);

  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<CommunityChannel | null>(null);

  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);

  const [activeView, setActiveView] = useState<"chat" | "posts" | "events">("chat");
  const [showMemberList, setShowMemberList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showCreateCommunityModal, setShowCreateCommunityModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Post detail modal state
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [postComments, setPostComments] = useState<CommunityComment[]>([]);

  // Load Communities on mount
  useEffect(() => {
    communityApi.listCommunities().then((data) => {
      setCommunities(data);
      if (data.length > 0) {
        setSelectedCommunityId((prev) => prev ?? data[0].id);
      }
    });
  }, []);

  // Load channels, posts, events, members when community selection changes
  useEffect(() => {
    if (!selectedCommunityId) return;

    let isMounted = true;
    const loadCommunityData = async () => {
      const [chans, evts, psts, mems] = await Promise.all([
        communityApi.listChannels(selectedCommunityId),
        communityApi.listEvents(selectedCommunityId),
        communityApi.listPosts(selectedCommunityId),
        communityApi.listMembers(selectedCommunityId),
      ]);

      if (!isMounted) return;

      setChannels(chans);
      setEvents(evts);
      setPosts(psts);
      setMembers(mems);

      if (chans.length > 0) {
        setSelectedChannel(chans[0]);
        if (chans[0].type === "forum") setActiveView("posts");
        else if (chans[0].type === "event") setActiveView("events");
        else setActiveView("chat");

        if (chans[0].type === "text") {
          const msgs = await communityApi.listMessages(selectedCommunityId, chans[0].id);
          if (isMounted) setMessages(msgs);
        }
      } else {
        setSelectedChannel(null);
      }
    };

    loadCommunityData();
    return () => {
      isMounted = false;
    };
  }, [selectedCommunityId]);

  // Handle Channel Selection
  const handleSelectChannel = async (channel: CommunityChannel) => {
    setSelectedChannel(channel);
    if (channel.type === "forum") {
      setActiveView("posts");
    } else if (channel.type === "event") {
      setActiveView("events");
    } else {
      setActiveView("chat");
      if (selectedCommunityId) {
        const msgs = await communityApi.listMessages(selectedCommunityId, channel.id);
        setMessages(msgs);
      }
    }
  };

  // Handlers for Communities
  const handleCreateCommunity = async (payload: CreateCommunityPayload) => {
    const newComm = await communityApi.createCommunity(payload);
    setCommunities([newComm, ...communities]);
    setSelectedCommunityId(newComm.id);
  };

  const handleUpdateCommunity = async (id: string, payload: Partial<CreateCommunityPayload>) => {
    const updated = await communityApi.updateCommunity(id, payload);
    setCommunities(communities.map((c) => (c.id === id ? updated : c)));
  };

  const handleDeleteCommunity = async (id: string) => {
    await communityApi.deleteCommunity(id);
    const updated = communities.filter((c) => c.id !== id);
    setCommunities(updated);
    setSelectedCommunityId(updated.length > 0 ? updated[0].id : null);
  };

  const handleJoinCommunity = async (id: string) => {
    await communityApi.joinCommunity(id);
    setSelectedCommunityId(id);
  };

  const handleJoinByCode = async (code: string) => {
    const comm = await communityApi.joinByCode(code);
    if (comm) {
      if (!communities.some((c) => c.id === comm.id)) {
        setCommunities([comm, ...communities]);
      }
      setSelectedCommunityId(comm.id);
    }
  };

  // Handlers for Channels
  const handleCreateChannel = async (payload: CreateChannelPayload) => {
    if (!selectedCommunityId) return;
    const newChan = await communityApi.createChannel(selectedCommunityId, payload);
    setChannels([...channels, newChan]);
    handleSelectChannel(newChan);
  };

  // Handlers for Messages
  const handleSendMessage = async (content: string, imageUrl?: string) => {
    if (!selectedCommunityId || !selectedChannel) return;
    const newMsg = await communityApi.sendMessage(
      selectedCommunityId,
      selectedChannel.id,
      content,
      imageUrl
    );
    setMessages([...messages, newMsg]);
  };

  // Handlers for Posts
  const handleCreatePost = async (payload: CreatePostPayload) => {
    if (!selectedCommunityId) return;
    const newPost = await communityApi.createPost(selectedCommunityId, payload);
    setPosts([newPost, ...posts]);
  };

  const handleSelectPost = async (post: CommunityPost) => {
    setSelectedPost(post);
    if (selectedCommunityId) {
      const comments = await communityApi.listComments(selectedCommunityId, post.id);
      setPostComments(comments);
    } else {
      setPostComments([]);
    }
  };

  const handleSendComment = async (postId: string, content: string) => {
    if (!selectedCommunityId) return;
    const newComment = await communityApi.createComment(selectedCommunityId, postId, content);
    setPostComments((prev) => [...prev, newComment]);
    setPosts(
      posts.map((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p))
    );
  };

  // Handlers for Events
  const handleCreateEvent = async (payload: CreateEventPayload) => {
    if (!selectedCommunityId) return;
    const newEvent = await communityApi.createEvent(selectedCommunityId, payload);
    setEvents([...events, newEvent]);
  };

  const handleRsvpEvent = async (eventId: string, status: EventRsvpStatus) => {
    if (!selectedCommunityId) return;
    await communityApi.rsvpEvent(selectedCommunityId, eventId, status);
    setEvents(
      events.map((ev) =>
        ev.id === eventId ? { ...ev, user_rsvp: status } : ev
      )
    );
  };

  // Handlers for Members
  const handleUpdateMemberRole = (userId: string, role: MemberRole) => {
    setMembers(members.map((m) => (m.user_id === userId ? { ...m, role } : m)));
  };

  const handleToggleMuteMember = (userId: string) => {
    setMembers(members.map((m) => (m.user_id === userId ? { ...m, muted: !m.muted } : m)));
  };

  const handleRemoveMember = (userId: string) => {
    setMembers(members.filter((m) => m.user_id !== userId));
  };

  const selectedCommunity = communities.find((c) => c.id === selectedCommunityId) || null;

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
      {/* Server Rail Bar (Discord left bar) */}
      <CommunityServerList
        communities={communities}
        selectedCommunityId={selectedCommunityId}
        onSelectCommunity={(id) => setSelectedCommunityId(id)}
        onOpenCreateModal={() => setShowCreateCommunityModal(true)}
        onOpenJoinModal={() => setShowJoinModal(true)}
      />

      {/* Main Container */}
      {selectedCommunityId && selectedCommunity ? (
        <div className="flex-1 flex h-full overflow-hidden">
          {/* Channels Sidebar */}
          <CommunitySidebar
            community={selectedCommunity}
            channels={channels}
            selectedChannelId={selectedChannel?.id || null}
            activeView={activeView}
            onSelectChannel={handleSelectChannel}
            onOpenCreateChannelModal={() => setShowCreateChannelModal(true)}
            onOpenSettingsModal={() => setShowSettingsModal(true)}
            onOpenInviteModal={() => setShowSettingsModal(true)}
            onLeaveCommunity={() => setSelectedCommunityId(null)}
          />

          {/* Main Area (Header + Content) */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <CommunityHeader
              currentChannel={selectedChannel}
              activeView={activeView}
              showMemberList={showMemberList}
              onToggleMemberList={() => setShowMemberList(!showMemberList)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenCreateActionModal={() => {
                if (activeView === "posts") setShowCreatePostModal(true);
                else if (activeView === "events") setShowCreateEventModal(true);
              }}
            />

            <main className="flex-1 flex overflow-hidden">
              {/* Dynamic View rendering */}
              {activeView === "chat" && selectedChannel && (
                <CommunityChatView
                  channel={selectedChannel}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                />
              )}

              {activeView === "posts" && (
                <CommunityPostsView
                  posts={posts}
                  onSelectPost={handleSelectPost}
                  onOpenCreatePostModal={() => setShowCreatePostModal(true)}
                />
              )}

              {activeView === "events" && (
                <CommunityEventsView
                  events={events}
                  onRsvp={handleRsvpEvent}
                  onOpenCreateEventModal={() => setShowCreateEventModal(true)}
                />
              )}

              {/* Members Sidebar */}
              {showMemberList && (
                <CommunityMemberList
                  members={members}
                  currentUserId="user-me"
                  onUpdateRole={handleUpdateMemberRole}
                  onToggleMute={handleToggleMuteMember}
                  onRemoveMember={handleRemoveMember}
                />
              )}
            </main>
          </div>
        </div>
      ) : (
        /* Explore / Discovery View when no community selected */
        <CommunityExploreView
          communities={communities}
          onSelectCommunity={(id) => setSelectedCommunityId(id)}
          onJoinCommunity={handleJoinCommunity}
          onOpenCreateModal={() => setShowCreateCommunityModal(true)}
        />
      )}

      {/* Modals */}
      <CreateCommunityModal
        isOpen={showCreateCommunityModal}
        onClose={() => setShowCreateCommunityModal(false)}
        onCreate={handleCreateCommunity}
      />

      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
        onCreate={handleCreateChannel}
      />

      <CreatePostModal
        isOpen={showCreatePostModal}
        onClose={() => setShowCreatePostModal(false)}
        onCreate={handleCreatePost}
        channelId={selectedChannel?.id}
      />

      <CreateEventModal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onCreate={handleCreateEvent}
      />

      {selectedCommunity && (
        <CommunitySettingsModal
          isOpen={showSettingsModal}
          community={selectedCommunity}
          onClose={() => setShowSettingsModal(false)}
          onUpdate={handleUpdateCommunity}
          onDelete={handleDeleteCommunity}
        />
      )}

      <JoinCommunityModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoinByCode={handleJoinByCode}
      />

      <CommunityPostDetailModal
        post={selectedPost}
        comments={postComments}
        onClose={() => setSelectedPost(null)}
        onSendComment={handleSendComment}
      />
    </div>
  );
}
