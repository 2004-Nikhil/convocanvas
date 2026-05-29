"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";

interface Room {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      const loadRooms = async () => {
        try {
          const res = await fetch("/api/rooms");

          if (res.ok) {
            const data = await res.json();

            // If your API returns { rooms: [...] }
            // use: setRooms(data.rooms)

            setRooms(data);
          }
        } catch (error) {
          console.error("Failed to fetch rooms:", error);
        }
      };

      loadRooms();
    }
  }, [status, router]);

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();

    if (!newRoomName.trim()) return;

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newRoomName,
        }),
      });

      if (res.ok) {
        setNewRoomName("");

        // Refresh rooms list
        const updatedRes = await fetch("/api/rooms");

        if (updatedRes.ok) {
          const data = await updatedRes.json();

          // If API returns { rooms: [...] }
          // use: setRooms(data.rooms)

          setRooms(data);
        }
      }
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-6">
            ConvoCanvas
          </h1>

          <p className="text-sm text-gray-600 mb-4">
            Hello, {session?.user?.name}
          </p>

          <form onSubmit={handleCreateRoom} className="space-y-2 mb-6">
            <input
              type="text"
              placeholder="New Room Name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none"
            />

            <button
              type="submit"
              className="w-full rounded bg-blue-600 py-1.5 text-xs text-white hover:bg-blue-700"
            >
              Create Room
            </button>
          </form>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-left text-sm font-medium text-red-600 hover:underline"
        >
          Sign Out
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          Your Collaboration Workspaces
        </h2>

        {rooms.length === 0 ? (
          <p className="text-gray-500">
            No rooms available. Create one to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => router.push(`/workspace/${room.id}`)}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-500"
              >
                <h3 className="mb-2 font-semibold text-gray-900">
                  {room.name}
                </h3>

                <span className="text-xs font-medium text-blue-600">
                  Join Workspace &rarr;
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}