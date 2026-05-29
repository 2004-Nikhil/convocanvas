import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function GET(
  req: Request, 
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Unwrap params using await
  const { roomId } = await params;

  const messages = await prisma.message.findMany({
    where: { roomId: roomId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: Request, 
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Unwrap params using await
  const { roomId } = await params;

  const { content } = await req.json();
  if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const message = await prisma.message.create({
    data: {
      content,
      roomId: roomId,
      userId: session.user.id
    },
    include: { user: { select: { name: true } } }
  });

  return NextResponse.json(message);
}