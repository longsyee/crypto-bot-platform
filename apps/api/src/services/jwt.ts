import jwt from "jsonwebtoken";
import { config } from "../config";

const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "7d";

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role, type: "access" }, config.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRY,
  });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, config.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  });
}

export function verifyAccessToken(token: string): { userId: string; role: string } {
  return jwt.verify(token, config.JWT_SECRET, { clockTolerance: 60 }) as any;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, config.JWT_REFRESH_SECRET, { clockTolerance: 60 }) as any;
}

export function generateTempToken(userId: string): string {
  return jwt.sign({ userId, type: "2fa_required" }, config.JWT_SECRET, {
    expiresIn: "5m",
  });
}

export function verifyTempToken(token: string): { userId: string } {
  return jwt.verify(token, config.JWT_SECRET, { clockTolerance: 60 }) as any;
}
