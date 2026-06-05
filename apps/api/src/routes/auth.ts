import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import speakeasy from "speakeasy";
import {
  RegisterSchema,
  LoginSchema,
  VerifyEmailSchema,
  ResendOtpSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  TotpCodeSchema,
  TotpDisableSchema,
} from "@crypto-bot-platform/shared";
import { prisma } from "@crypto-bot-platform/prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateTempToken,
  verifyTempToken,
} from "../services/jwt";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { config } from "../config";
import { sendOtpEmail, sendPasswordResetEmail } from "../services/email";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono();

function generateReferralCode(): string {
  return "REF-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
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

    // Admin privilege check
    const adminEmails = config.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const isAdminEmail = adminEmails.includes(body.email.toLowerCase());
    const isFirstUser = config.FIRST_USER_ADMIN && (await prisma.user.count()) === 0;
    const role = isAdminEmail || isFirstUser ? "admin" : "user";

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        referralCode: generateReferralCode(),
        referredBy,
        role,
        emailOtp: otp,
        emailOtpExpiresAt: otpExpires,
      },
    });

    // Send OTP email (dev fallback prints to console)
    await sendOtpEmail(user.email, otp);

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
          status: "active",
        },
      });
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    return c.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
        accessToken,
        refreshToken,
      },
    }, 201);
  }
);

auth.post(
  "/verify-email",
  rateLimitMiddleware(10, 300, "verify-email"),
  zValidator("json", VerifyEmailSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return c.json({ success: false, error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }
    if (user.emailVerified) {
      return c.json({ success: true, data: { message: "Already verified" } });
    }
    if (!user.emailOtp || !user.emailOtpExpiresAt || user.emailOtp !== body.otp) {
      return c.json({ success: false, error: "Invalid OTP", code: "INVALID_OTP" }, 400);
    }
    if (new Date() > user.emailOtpExpiresAt) {
      return c.json({ success: false, error: "OTP expired", code: "OTP_EXPIRED" }, 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailOtp: null, emailOtpExpiresAt: null },
    });

    return c.json({ success: true, data: { message: "Email verified" } });
  }
);

auth.post(
  "/resend-otp",
  rateLimitMiddleware(3, 300, "resend-otp"),
  zValidator("json", ResendOtpSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return c.json({ success: false, error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }
    if (user.emailVerified) {
      return c.json({ success: false, error: "Already verified", code: "ALREADY_VERIFIED" }, 400);
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailOtp: otp, emailOtpExpiresAt: otpExpires },
    });

    await sendOtpEmail(user.email, otp);

    return c.json({ success: true, data: { message: "OTP resent" } });
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

    // If 2FA is enabled, return a temporary token instead of full session
    if (user.totpEnabled) {
      const tempToken = generateTempToken(user.id);
      return c.json({
        success: true,
        data: {
          mfaRequired: true,
          tempToken,
          user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
        },
      });
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    return c.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
        accessToken,
        refreshToken,
      },
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

// ============================================================
// 2FA TOTP
// ============================================================

auth.post(
  "/2fa/setup",
  rateLimitMiddleware(3, 3600, "2fa-setup"),
  authMiddleware,
  async (c) => {
    const user = c.get("user");
    if (user.totpEnabled) {
      return c.json({ success: false, error: "2FA is already enabled", code: "2FA_ALREADY_ENABLED" }, 400);
    }

    const secret = speakeasy.generateSecret({
      name: "NexusBot",
      length: 32,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: secret.base32,
        totpEnabled: false,
        totpVerified: false,
      },
    });

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: user.email,
      issuer: "NexusBot",
      encoding: "base32",
    });

    return c.json({
      success: true,
      data: {
        secret: secret.base32,
        otpauthUrl,
      },
    });
  }
);

auth.post(
  "/2fa/verify",
  rateLimitMiddleware(5, 300, "2fa-verify"),
  authMiddleware,
  zValidator("json", TotpCodeSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    if (!user.totpSecret) {
      return c.json({ success: false, error: "2FA not set up", code: "2FA_NOT_SETUP" }, 400);
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: "base32",
      token: body.code,
      window: 1,
    });

    if (!verified) {
      return c.json({ success: false, error: "Invalid verification code", code: "INVALID_TOTP" }, 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true, totpVerified: true },
    });

    return c.json({ success: true, data: { message: "2FA enabled successfully" } });
  }
);

auth.post(
  "/2fa/disable",
  rateLimitMiddleware(3, 900, "2fa-disable"),
  authMiddleware,
  zValidator("json", TotpDisableSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");

    if (!user.totpEnabled) {
      return c.json({ success: false, error: "2FA is not enabled", code: "2FA_NOT_ENABLED" }, 400);
    }

    const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordValid) {
      return c.json({ success: false, error: "Invalid password", code: "INVALID_PASSWORD" }, 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpVerified: false,
      },
    });

    return c.json({ success: true, data: { message: "2FA disabled successfully" } });
  }
);

auth.post(
  "/2fa/login-verify",
  rateLimitMiddleware(5, 300, "2fa-login-verify"),
  zValidator("json", z.object({ tempToken: z.string().min(1), code: z.string().length(6).regex(/^\d{6}$/) })),
  async (c) => {
    const body = c.req.valid("json");

    let payload: { userId: string };
    try {
      payload = verifyTempToken(body.tempToken);
    } catch {
      return c.json({ success: false, error: "Invalid or expired temporary token", code: "INVALID_TEMP_TOKEN" }, 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return c.json({ success: false, error: "2FA not enabled or user not found", code: "2FA_NOT_ENABLED" }, 400);
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: "base32",
      token: body.code,
      window: 1,
    });

    if (!verified) {
      return c.json({ success: false, error: "Invalid verification code", code: "INVALID_TOTP" }, 400);
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    return c.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
        accessToken,
        refreshToken,
      },
    });
  }
);

auth.post(
  "/forgot-password",
  rateLimitMiddleware(3, 900, "forgot-password"),
  zValidator("json", ForgotPasswordSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      // Return success even if user not found (security through obscurity)
      return c.json({ success: true, data: { message: "If the email exists, a reset link has been sent." } });
    }

    const token = generateResetToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: expires },
    });

    await sendPasswordResetEmail(user.email, token);

    return c.json({ success: true, data: { message: "If the email exists, a reset link has been sent." } });
  }
);

auth.post(
  "/reset-password",
  rateLimitMiddleware(5, 300, "reset-password"),
  zValidator("json", ResetPasswordSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = await prisma.user.findUnique({ where: { passwordResetToken: body.token } });
    if (!user || !user.passwordResetExpiresAt || new Date() > user.passwordResetExpiresAt) {
      return c.json({ success: false, error: "Invalid or expired token", code: "INVALID_TOKEN" }, 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(body.newPassword, 12),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    return c.json({ success: true, data: { message: "Password updated successfully" } });
  }
);

export default auth;
