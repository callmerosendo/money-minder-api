/**
 * Canonical e2e template — copy this file when adding coverage for a new controller.
 *
 * Repo-specific notes that apply to EVERY e2e file:
 * - The global prefix, ValidationPipe and AllExceptionsFilter live in src/main.ts,
 *   NOT in AppModule, so the bootstrap call configureApp.
 * - BigIntInterceptor comes for free with AppModule (registered via APP_INTERCEPTOR).
 * - Auth: a real user + session row is seeded; AuthGuard accepts the bearer token
 *   through its SHA-256 fallback against the `sessions` table.
 * - closeBetterAuthInstance() must run in afterAll, otherwise Jest keeps an open
 *   pg handle and refuses to exit.
 */
import { createHash, randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "@/app.module";
import { closeBetterAuthInstance } from "@/auth/auth";
import { PrismaService } from "@/prisma.service";
import { configureApp } from "@/app.setup";

jest.setTimeout(30000);

describe("AccountsController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Seeded every run with random ids so re-runs never collide on unique columns.
  const userId = randomUUID();
  const bearerToken = `e2e-${randomUUID()}`;
  const tokenHash = createHash("sha256").update(bearerToken).digest("hex");
  const authHeader = { Authorization: `Bearer ${bearerToken}` };

  // Second user owning an account directly, to prove cross-user reads answer 404 (never 403).
  const otherUserId = randomUUID();
  let otherAccountId: string;

  let createdAccountId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.users.create({
      data: {
        id: userId,
        name: "E2E Account Owner",
        email: `e2e-accounts-${userId}@test.local`,
      },
    });
    await prisma.sessions.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const otherUser = await prisma.users.create({
      data: {
        id: otherUserId,
        name: "E2E Other User",
        email: `e2e-accounts-other-${otherUserId}@test.local`,
      },
    });
    const otherAccount = await prisma.accounts.create({
      data: { user_id: otherUser.id, name: "Other user's account", type: "bank" },
    });
    otherAccountId = otherAccount.id;
  });

  afterAll(async () => {
    await prisma.sessions.deleteMany({ where: { user_id: userId } });
    await prisma.users.deleteMany({ where: { id: userId } });
    await prisma.users.deleteMany({ where: { id: otherUserId } });
    await closeBetterAuthInstance();
    await app.close();
  });

  describe("authentication", () => {
    it("answers 401 with the standard error envelope when no Authorization header is sent", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/accounts").expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        message: "Unauthorized: Valid session or Bearer token required",
        path: "/api/v1/accounts",
      });
      expect(typeof res.body.timestamp).toBe("string");
    });

    it("answers 401 for an unknown bearer token", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/accounts")
        .set("Authorization", `Bearer ${randomUUID()}`)
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toBe("Unauthorized: Valid session or Bearer token required");
    });
  });

  describe("validation (ValidationPipe)", () => {
    it("answers 400 with message[] listing every violation, including unknown properties", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/accounts")
        .set(authHeader)
        .send({ name: "", openingBalance: "12.345", unexpectedField: true })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          "name should not be empty",
          "openingBalance must be a decimal string",
          "property unexpectedField should not exist",
        ]),
      );
    });

    it("answers 400 with message as a plain string when the service rejects the request", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/accounts")
        .set(authHeader)
        .send({ name: "Wrong endpoint", type: "credit_card" })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(typeof res.body.message).toBe("string");
      expect(res.body.message).toContain("POST /credit-cards");
    });
  });

  describe("create and read", () => {
    it("creates an account and serializes every money field as a 2-decimal string", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/accounts")
        .set(authHeader)
        .send({ name: "E2E Checking", type: "bank", openingBalance: "1234.5" })
        .expect(201);

      createdAccountId = res.body.id;
      expect(res.body).toMatchObject({
        name: "E2E Checking",
        type: "bank",
        openingBalance: "1234.50",
        movementsTotal: "0.00",
        balance: "1234.50",
        isActive: true,
        outstandingDebt: null,
      });
      expect(typeof res.body.openingBalanceDate).toBe("string");
    });

    it("lists the account with a 2-decimal balance", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/accounts")
        .set(authHeader)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((account: { id: string }) => account.id === createdAccountId);
      expect(found).toMatchObject({
        balance: "1234.50",
        movementsTotal: "0.00",
        isActive: true,
      });
    });

    it("fetches a single account by id", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${createdAccountId}`)
        .set(authHeader)
        .expect(200);

      expect(res.body.balance).toBe("1234.50");
    });
  });

  describe("ownership and ids (404, never 403)", () => {
    it("answers 404 when reading another user's account", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${otherAccountId}`)
        .set(authHeader)
        .expect(404);

      expect(res.body).toMatchObject({ statusCode: 404, message: "Account not found" });
    });

    it("answers 404 for an account that does not exist", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${randomUUID()}`)
        .set(authHeader)
        .expect(404);

      expect(res.body.statusCode).toBe(404);
    });

    it("answers 400 for a malformed uuid instead of crashing", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/accounts/not-a-uuid")
        .set(authHeader)
        .expect(400);

      // Rejected by ParseUUIDPipe before the request ever reaches Prisma.
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toContain("uuid");
    });
  });

  describe("update", () => {
    it("renames the account and persists the change", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/accounts/${createdAccountId}`)
        .set(authHeader)
        .send({ name: "E2E Checking Renamed" })
        .expect(200);

      expect(res.body.name).toBe("E2E Checking Renamed");

      const read = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${createdAccountId}`)
        .set(authHeader)
        .expect(200);
      expect(read.body.name).toBe("E2E Checking Renamed");
    });
  });

  describe("delete", () => {
    it("archives by default instead of deleting the row", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/accounts/${createdAccountId}`)
        .set(authHeader)
        .expect(200);

      expect(res.body).toMatchObject({ archived: true, id: createdAccountId });

      const read = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${createdAccountId}`)
        .set(authHeader)
        .expect(200);
      expect(read.body.isActive).toBe(false);
    });

    it("hard-deletes with ?hard=true and the account stops resolving", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/accounts/${createdAccountId}?hard=true`)
        .set(authHeader)
        .expect(200);

      expect(res.body).toMatchObject({ deleted: true, id: createdAccountId });

      await request(app.getHttpServer())
        .get(`/api/v1/accounts/${createdAccountId}`)
        .set(authHeader)
        .expect(404);
    });
  });
});
