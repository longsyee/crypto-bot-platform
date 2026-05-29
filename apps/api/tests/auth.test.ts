import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/index";

// Integration test: requires testcontainers postgres + redis running
// Or use a test-specific .env with test db URL

describe("Auth Routes", () => {
  it("POST /auth/register creates a user", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "TestPass123!",
      }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe("test@example.com");
    expect(json.data.accessToken).toBeDefined();
  });

  it("POST /auth/login returns tokens", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "TestPass123!",
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.accessToken).toBeDefined();
  });
});
