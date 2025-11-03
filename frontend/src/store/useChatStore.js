import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  // 🆕 Store unread message counts per user
  unreadCounts: {},

  // 🆕 Helper: move a user to the top of the list
  bumpUserToTop: (userId) => {
    const users = get().users.slice();
    const idx = users.findIndex((u) => u._id === userId);
    if (idx === -1) return;
    const [hit] = users.splice(idx, 1);
    users.unshift(hit);
    set({ users });
  },

  // 🆕 Helper: increment unread count
  incUnread: (userId) => {
    const unread = { ...get().unreadCounts };
    unread[userId] = (unread[userId] || 0) + 1;
    set({ unreadCounts: unread });
  },

  // 🆕 Helper: reset unread count when a chat is opened
  resetUnread: (userId) => {
    const unread = { ...get().unreadCounts };
    if (unread[userId]) {
      unread[userId] = 0;
      set({ unreadCounts: unread });
    }
  },

  // ✅ Fetch all chat users
  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // ✅ Fetch messages for a specific user
  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to fetch messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // ✅ Send a message and bump user to the top
  sendMessage: async (messageData) => {
    const { selectedUser, messages, bumpUserToTop } = get();
    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      set({ messages: [...messages, res.data] });
      bumpUserToTop(selectedUser._id); // keep ordering fresh
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send message");
    }
  },

  // 🆕 Subscribe to realtime messages
  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // 🔁 Avoid duplicate listeners (HMR/dev)
    socket.off("message:new");

    socket.on("message:new", (newMessage) => {
      const { selectedUser, messages, bumpUserToTop, incUnread } = get();
      const me = useAuthStore.getState().authUser?._id;

      const senderId = newMessage.senderId;
      const receiverId = newMessage.receiverId;
      const otherId = senderId === me ? receiverId : senderId; // identify the other participant

      const isCurrentThread = !!selectedUser && otherId === selectedUser._id;

      if (isCurrentThread) {
        // If we’re already viewing this chat, append immediately
        set({ messages: [...messages, newMessage] });
      } else {
        // Otherwise increment unread count
        incUnread(otherId);
      }

      // Always move that conversation to the top (WhatsApp-like)
      bumpUserToTop(otherId);
    });
  },

  // 🆕 Unsubscribe (cleanup)
  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("message:new");
  },

  // 🆕 Selecting a user resets unread + loads messages
  setSelectedUser: (selectedUser) => {
    set({ selectedUser, messages: [] });
    if (selectedUser?._id) {
      get().resetUnread(selectedUser._id);
      get().getMessages(selectedUser._id);
    }
  },
}));
