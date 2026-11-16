import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter } from "./middlewares/errors";

export const configureApp = (app: INestApplication) => {
  // Behind Render's edge proxy, `req.ip` is the proxy address unless Express
  // is told to honor X-Forwarded-For. Without this, every client would share
  // a single rate-limit bucket. "1" trusts one hop (the Render proxy); locally
  // (no proxy) it is a no-op and req.ip stays the real client address.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  app.setGlobalPrefix("api/v1", {
    exclude: ["api", "api/docs", "api/docs/(.*)", "hello", "ping", "health"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
};
