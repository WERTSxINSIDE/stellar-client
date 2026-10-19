import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasUrl = !!process.env.DATABASE_URL;
  let dbOk = false;
  let err = "";
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch (e: any) {
    err = String(e?.message || e);
  }
  return NextResponse.json({ hasUrl, dbOk, err, len: process.env.DATABASE_URL?.length ?? 0 });
}
