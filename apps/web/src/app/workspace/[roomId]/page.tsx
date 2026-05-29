"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  user: {
    name: string | null;
  };
}

export default function WorkspacePage() {
  const { roomId } = useParams() as { roomId: string };
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      // 1. Fetch historical messages
      fetch(`/api/rooms/${roomId}/messages`)
        .then((res) => res.json())
        .then((data) => setMessages(data));

      // 2. Initialize socket connection
      // For Codespaces development, replace with your active forwarded port 4000 address if localhost fails in your browser
      const socket = io("https://super-carnival-v9xvj44jv753x7q-4000.app.github.dev/");
      socketRef.current = socket;

      socket.emit("join-room", roomId);

      socket.on("receive-message", (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [status, roomId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !session?.user) return;

    // Persist to Database via Next.js REST API
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMessage }),
    });

    if (res.ok) {
      const savedMessage = await res.json();
      
      // Update UI locally
      setMessages((prev) => [...prev, savedMessage]);

      // Emit event to active socket peers
      socketRef.current?.emit("send-message", {
        id: savedMessage.id,
        roomId,
        content: savedMessage.content,
        userId: session.user.id,
        createdAt: savedMessage.createdAt,
        user: { name: session.user.name }
      });

      setNewMessage("");
    }
  };

  if (status === "loading") return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <button onClick={() => router.push("/dashboard")} className="text-sm font-medium text-blue-600 hover:underline">
          &larr; Back to Lobby
        </button>
        <span className="font-semibold text-gray-900 text-sm">Workspace ID: {roomId}</span>
        <div />
      </div>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Sidebar Area (Takes up 1/3 of the screen width for workspace structure) */}
        <div className="flex w-96 flex-col border-r border-gray-200 bg-white">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 text-sm">Room Chat</h3>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isMe = msg.userId === session?.user?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-xs text-gray-500 mb-1">{msg.user?.name || "Anonymous"}</span>
                  <div className={`max-w-[85%] rounded px-3 py-2 text-sm ${isMe ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-950"}`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Form */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none"
              />
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Send
              </button>
            </div>
          </form>
        </div>

        {/* Placeholder for Collaborative Whiteboard in Sprint 4 */}
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <p className="text-gray-500 text-sm font-medium">Collaborative Whiteboard placeholder (Sprint 4)</p>
        </div>
      </div>
    </div>
  );
}