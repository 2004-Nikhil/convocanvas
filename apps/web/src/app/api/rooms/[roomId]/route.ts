import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const room = await prisma.room.findUnique({
    where: { id: roomId }
  });
  return NextResponse.json(room);
}

export async function PUT(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const { canvasState } = await req.json();

  const room = await prisma.room.update({
    where: { id: roomId },
    data: { canvasState }
  });

  return NextResponse.json(room);
}