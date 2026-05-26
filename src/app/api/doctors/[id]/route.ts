import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isStale, staleDays } from "@/lib/verification";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      verifications: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          reportedStatus: true,
          howConfirmed: true,
          createdAt: true,
        },
      },
    },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...doctor,
    verification: {
      last_verified: doctor.lastVerified,
      verification_count: doctor.verificationCount,
      is_stale: isStale(doctor.lastVerified),
      stale_days: staleDays(doctor.lastVerified),
    },
    recent_verifications: doctor.verifications.map((v: { reportedStatus: string; howConfirmed: string; createdAt: Date }) => ({
      reported_status: v.reportedStatus,
      how_confirmed: v.howConfirmed,
      created_at: v.createdAt.toISOString(),
    })),
  });
}
