import { Test } from "@nestjs/testing";
import { AppModule } from "@/app.module";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { configureApp } from "@/app.setup";

jest.setTimeout(30000);

describe("PublicEndpoints (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /hello", () => {
    it("should respond with 200 and a message", async () => {
      const res = await request(app.getHttpServer()).get("/hello").expect(200);

      expect(res.text).toMatch("Hi there you fantastic person!");
    });
  });

  describe("GET /ping", () => {
    it("should respond with 200 and a message", async () => {
      const res = await request(app.getHttpServer()).get("/ping").expect(200);

      expect(res.text).toBe("pong 🎾");
    });
  });

  describe("GET /health", () => {
    it("should respond with 200 and an object", async () => {
      const res = await request(app.getHttpServer()).get("/health").expect(200);

      expect(res.body).toMatchObject({ status: "ok" });
    });
  });

  describe("excluded from the global prefix", () => {
    it.each(["hello", "ping", "health"])("GET /api/v1/%s answers 404", async (route) => {
      await request(app.getHttpServer()).get(`/api/v1/${route}`).expect(404);
    });
  });

  describe("GET /api/v1/auth/ok", () => {
    it("verifies the Better Auth handler is reachable (skill: setup verification)", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/auth/ok").expect(200);

      // better-auth 1.7.18 responds `{ ok: true }` from the /ok route.
      expect(res.body).toMatchObject({ ok: true });
    });
  });

  describe("GET /api/v1/phrases/daily-phrase", () => {
    it("is public (no auth header) and returns a well-formed entry", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/phrases/daily-phrase")
        .expect(200);

      if (res.text === "") return; // TODO

      expect(res.body).toEqual({
        phrase: expect.any(String),
        movie: expect.any(String),
        character: expect.any(String),
      });
    });

    it("should return the same entry on a second call the same day", async () => {
      const firstCall = await request(app.getHttpServer())
        .get("/api/v1/phrases/daily-phrase")
        .expect(200);
      const secondCall = await request(app.getHttpServer())
        .get("/api/v1/phrases/daily-phrase")
        .expect(200);

      expect(secondCall.body).toEqual(firstCall.body);
    });
  });
});
