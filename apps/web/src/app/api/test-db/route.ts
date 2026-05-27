import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Attempt to write a test user, or fetch them if they exist
    const testUser = await prisma.user.upsert({
      where: { email: 'test@convocanvas.com' },
      update: { name: 'Verified User' },
      create: {
        email: 'test@convocanvas.com',
        name: 'Initial User',
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Database connection verified successfully.", 
      user: testUser 
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}