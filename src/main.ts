import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const configService = app.get(ConfigService);

  configureApp(app);

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

bootstrap();
