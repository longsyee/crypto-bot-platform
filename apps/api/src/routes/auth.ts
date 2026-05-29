import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { RegisterSchema, LoginSchema } from "@crypto-bot-platform/shared";
import { prisma } from "@crypto-bot-platform/prisma";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../services/jwt";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { config } from "../config";

const auth = new Hono();

function generateReferralCode(): string {
  return "REF-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

auth.post(
  "/register",
  rateLimitMiddleware(5, 900, "register"),
  zValidator("json", RegisterSchema),
  async (c) => {
    const body = c.req.valid("json");
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return c.json({ success: false, error: "Email already registered", code: "EMAIL_EXISTS" }, 409);
    }

    let referredBy: string | null = null;
    if (body.referral_code) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: body.referral_code } });
      if (referrer) referredBy = referrer.id;
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        referralCode: generateReferralCode(),
        referredBy,
      },
    });

    // Create empty wallet
    await prisma.wallet.create({
      data: { userId: user.id, bscAddressIndex: 0, bscAddress: "", usdtBalance: 0, tokenBalance: 0 },
    });

    // Create referral record if applicable
    if (referredBy) {
      await prisma.referral.create({
        data: {
          referrerId: referredBy,
          referredUserId: user.id,
          tier: "bronze",
          commissionRate: 0.05,
        },
      });
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    return c.json({
      success: true,
      data: { user: { id: user.id, email: user.email, role: user.role }, accessToken, refreshToken },
    }, 201);
  }
);

auth.post(
  "/login",
  rateLimitMiddleware(5, 900, "login"),
  zValidator("json", LoginSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return c.json({ success: false, error: "Invalid credentials", code: "BAD_CREDENTIALS" }, 401);
    }
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    return c.json({
      success: true,
      data: { user: { id: user.id, email: user.email, role: user.role }, accessToken, refreshToken },
    });
  }
);

auth.post("/refresh", async (c) => {
  const body = await c.req.json();
  try {
    const payload = verifyRefreshToken(body.refresh_token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return c.json({ success: false, error: "User not found", code: "USER_GONE" }, 401);
    }
    const accessToken = generateAccessToken(user.id, user.role);
    return c.json({ success: true, data: { accessToken } });
  } catch {
    return c.json({ success: false, error: "Invalid refresh token", code: "INVALID_REFRESH" }, 401);
  }
});

export default auth;
