import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encrypt";
import * as bcrypt from "bcryptjs";

const ENCRYPTED_KEYS = ["anthropic_api_key", "openai_api_key"];

export async function GET() {
  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};

    for (const s of settings) {
      if (ENCRYPTED_KEYS.includes(s.key)) {
        // Return masked version
        try {
          const val = decrypt(s.value);
          result[s.key] = val.slice(0, 8) + "..." + val.slice(-4);
        } catch {
          result[s.key] = "***configured***";
        }
      } else {
        result[s.key] = s.value;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle password change separately
    if (body.newPassword) {
      const hash = await bcrypt.hash(body.newPassword, 12);
      await prisma.user.update({
        where: { id: 1 },
        data: { password: hash },
      });
      await prisma.activityLog.create({
        data: { event: "Password changed", type: "system" },
      });
      return NextResponse.json({ success: true, message: "Password updated" });
    }

    // Handle settings updates
    for (const [key, value] of Object.entries(body)) {
      if (key === "newPassword") continue;
      const storedValue = ENCRYPTED_KEYS.includes(key)
        ? encrypt(value as string)
        : (value as string);

      await prisma.setting.upsert({
        where: { key },
        update: { value: storedValue },
        create: { key, value: storedValue },
      });
    }

    await prisma.activityLog.create({
      data: {
        event: `Settings updated: ${Object.keys(body).join(", ")}`,
        type: "system",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
