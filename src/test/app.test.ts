import request from "supertest";
import app from "../app.js";
import { describe, expect, it, afterAll } from "@jest/globals";
import { prisma } from "../lib/prisma.js";

describe("GET /api/profiles", () => {
  it("should return code 200 for valid profiles", async () => {
    const response = await request(app)
      .get("/api/profiles?search=victor")
      .expect(200);

    expect(response.body.status).toBe("success");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});