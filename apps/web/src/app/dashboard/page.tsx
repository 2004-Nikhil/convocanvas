"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="mb-2">Welcome back, <span className="font-semibold">{session?.user?.name || "User"}</span></p>
        <p className="mb-6 text-sm text-gray-600">Logged in as: {session?.user?.email}</p>
        <button 
          onClick={() => signOut({ callbackUrl: "/login" })} 
          className="w-full rounded bg-red-600 py-2 font-medium text-white hover:bg-red-700 transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}