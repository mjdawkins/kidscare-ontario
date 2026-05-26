import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verificationSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  calculateAcceptingStatus,
  calculateVerificationCount,
  isStale,
  staleDays,
} from "@/lib/verification";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`verify:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Validate body
  const body = await request.json();
  const parsed = verificationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check doctor exists
  const doctor = await prisma.doctor.findUnique({ where: { id } });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  // Insert verification
  await prisma.verification.create({
    data: {
      doctorId: id,
      userId: user.id,
      reportedStatus: parsed.data.reported_status,
      howConfirmed: parsed.data.how_confirmed,
      notes: parsed.data.notes,
    },
  });

  // Get relevant verifications for recalculation
  const recentVerifications = await prisma.verification.findMany({
    where: { doctorId: id },
    orderBy: { createdAt: "desc" },
    select: {
      reportedStatus: true,
      createdAt: true,
    },
    take: 20,
  });

  // Recalculate
  const newStatus = calculateAcceptingStatus(
    recentVerifications as { reportedStatus: typeof doctor.acceptingStatus; createdAt: Date }[]
  );

  const statusChanged = newStatus && newStatus !== doctor.acceptingStatus;
  let alertsTriggered = 0;

  if (newStatus) {
    const verificationCount = calculateVerificationCount(
      recentVerifications as { reportedStatus: typeof doctor.acceptingStatus; createdAt: Date }[],
      newStatus
    );

    await prisma.doctor.update({
      where: { id },
      data: {
        acceptingStatus: newStatus,
        lastVerified: new Date(),
        verificationCount,
      },
    });

    // If status flipped to accepting, fire alerts
    if (statusChanged && newStatus === "accepting") {
      const matchingAlerts = await prisma.alert.findMany({
        where: {
          alertType: "doctor",
          OR: [
            { targetId: id },
          ],
        },
        select: { id: true, userId: true },
      });

      alertsTriggered = matchingAlerts.length;

      if (matchingAlerts.length > 0) {
        await prisma.alert.updateMany({
          where: { id: { in: matchingAlerts.map((a: { id: string }) => a.id) } },
          data: { lastNotifiedAt: new Date() },
        });
      }
    }
  }

  // Fetch updated doctor
  const updatedDoctor = await prisma.doctor.findUnique({
    where: { id },
    select: {
      id: true,
      acceptingStatus: true,
      lastVerified: true,
      verificationCount: true,
    },
  });

  return NextResponse.json({
    verified: true,
    doctor: {
      ...updatedDoctor,
      verification: {
        last_verified: updatedDoctor!.lastVerified,
        verification_count: updatedDoctor!.verificationCount,
        is_stale: isStale(updatedDoctor!.lastVerified),
        stale_days: staleDays(updatedDoctor!.lastVerified),
      },
    },
    alerts_triggered: alertsTriggered,
  });
}
