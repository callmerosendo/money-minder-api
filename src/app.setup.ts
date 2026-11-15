import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter } from "./middlewares/errors";

export const configureApp = (app: INestApplication) => {
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
