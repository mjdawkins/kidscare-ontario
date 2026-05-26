import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const clinic = await prisma.clinic.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      hours: true,
      openSaturday: true,
      openSunday: true,
      openAfter6pm: true,
      seesChildren: true,
      sameDayBookingRequired: true,
      isPediatricOnly: true,
      virtualCareAvailable: true,
      communityFlagged: true,
      lastFlaggedAt: true,
      createdAt: true,
    },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  return NextResponse.json(clinic);
}
