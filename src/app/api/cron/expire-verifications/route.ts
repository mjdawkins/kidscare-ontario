import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { UNKNOWN_THRESHOLD_DAYS } from "@/lib/verification";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - UNKNOWN_THRESHOLD_DAYS);

  const result = await prisma.doctor.updateMany({
    where: {
      acceptingStatus: { not: "unknown" },
      OR: [
        { lastVerified: null },
        { lastVerified: { lt: cutoff } },
      ],
    },
    data: {
      acceptingStatus: "unknown",
    },
  });

  return NextResponse.json({
    expired: true,
    doctors_reverted: result.count,
    fetched_at: new Date().toISOString(),
  });
}
