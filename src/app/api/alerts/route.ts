import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { alertCreateSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const MAX_ALERTS = 5;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where: { userId: user.id },
      include: {
        doctor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.alert.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    results: alerts.map((a) => ({
      id: a.id,
      alert_type: a.alertType,
      target_id: a.targetId,
      doctor_name: a.doctor?.name ?? null,
      postal_code: a.postalCode,
      radius_km: a.radiusKm,
      doctor_type_filter: a.doctorTypeFilter,
      language_filter: a.languageFilter,
      last_notified_at: a.lastNotifiedAt?.toISOString() ?? null,
      created_at: a.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
    max_alerts: MAX_ALERTS,
    remaining: Math.max(0, MAX_ALERTS - total),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rl = rateLimit(`alerts:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Check alert limit
  const currentCount = await prisma.alert.count({ where: { userId: user.id } });
  if (currentCount >= MAX_ALERTS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ALERTS} alerts allowed on the free tier` },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = alertCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const alert = await prisma.alert.create({
    data: {
      userId: user.id,
      alertType: parsed.data.alert_type,
      targetId: parsed.data.target_id,
      postalCode: parsed.data.postal_code,
      radiusKm: parsed.data.radius_km,
      doctorTypeFilter: parsed.data.doctor_type_filter,
      languageFilter: parsed.data.language_filter,
    },
  });

  return NextResponse.json(alert, { status: 201 });
}
