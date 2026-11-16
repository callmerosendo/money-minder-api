import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { getBetterAuthInstance } from "./auth/auth";

// Safety net for errors outside the request pipeline (see error-use-exception-filters
// and error-handle-async-errors): log them instead of dying with an opaque stack.
process.on("unhandledRejection", (reason) => {
  Logger.error("Unhandled promise rejection", reason instanceof Error ? reason.stack : reason);
});
process.on("uncaughtException", (error) => {
  Logger.error("Uncaught exception", error.stack);
  process.exit(1);
});

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const configService = app.get(ConfigService);

  configureApp(app);

  // Run OnModuleDestroy hooks (PrismaService, etc.) on SIGTERM/SIGINT so
  // database pools are closed on deploys instead of leaking connections.
  app.enableShutdownHooks();

  // Initialize Better Auth eagerly so a missing/misconfigured BETTER_AUTH_SECRET
  // fails the boot with a clear error rather than 401-ing every request.
  getBetterAuthInstance();

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Money Minder API")
    .setDescription("The Money Minder Financial REST API v1")
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("money-minder")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  // CORS configuration
  const defaultCorsOrigins = [
    "http://localhost:4321",
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://localhost:3000",
    "https://money-minder-xi.vercel.app",
    "https://rosendo-garcia.vercel.app",
  ];
  const corsOrigins = [
    ...(configService.get<string[]>("cors.origins") || defaultCorsOrigins),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];

  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["set-auth-token"],
    optionsSuccessStatus: 204,
    credentials: true,
  });

  const port = configService.get<number>("nest.port") || 7373;
  await app.listen(port);
};

bootstrap().catch((error) => {
  Logger.error("Failed to start application", error instanceof Error ? error.stack : error);
  process.exit(1);
});
