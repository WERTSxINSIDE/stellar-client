import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const pa = await queryOne(
    `SELECT platform FROM partner_applications
     WHERE user_id = $1 AND status = 'approved'
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );

  return NextResponse.json({
    user: { ...user, platform: (pa?.platform as string) ?? null },
  });
}
