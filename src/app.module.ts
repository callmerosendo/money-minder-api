import { CacheModule } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AccountsModule } from "@/accounts/accounts.module";
import { AuthGuard } from "@/auth/auth.guard";
import { AuthModule } from "@/auth/auth.module";
import { BigIntInterceptor } from "@/big-int-interceptor";
import { CategoriesModule } from "@/categories/categories.module";
import configure from "@/common/configs/config";
import { CreditCardsModule } from "@/credit-cards/credit-cards.module";
import { DebitCardsModule } from "@/debit-cards/debit-cards.module";
import { LoansModule } from "@/loans/loans.module";
import { PhrasesModule } from "@/phrases/phrases.module";
import { PrismaModule } from "@/prisma.module";
import { RemindersModule } from "@/reminders/reminders.module";
import { ReportsModule } from "@/reports/reports.module";
import { SavingsModule } from "@/savings/savings.module";
import { SpecialsModule } from "@/specials/specials.module";
import { TransactionsModule } from "@/transactions/transactions.module";
import { TransfersModule } from "@/transfers/transfers.module";
import { UsersModule } from "@/users/users.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configure],
    }),
    CacheModule.register({
      ttl: 60 * 1000,
      max: 200,
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      // Prefer the Cloudflare-set client IP headers (Render proxies through
      // Cloudflare, which overwrites them — clients can't spoof them).
      // X-Forwarded-For is spoofable on Render (it appends without stripping),
      // so fall back to req.ip only when the trusted headers are absent
      // (i.e. local development, where trust proxy resolves it).
      getTracker: (req: Record<string, any>) => {
        const forwarded = req.headers?.["cf-connecting-ip"] ?? req.headers?.["true-client-ip"];
        if (typeof forwarded === "string" && forwarded.length > 0) return forwarded;
        return (req.ip ?? req.socket?.remoteAddress ?? "unknown") as string;
      },
      throttlers: [
        {
          name: "default",
          ttl: 60 * 1000, // 60 seconds
          limit: 100, // max requests per ttl (per IP) — sized for parallel SPA loads
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    AccountsModule,
    DebitCardsModule,
    CreditCardsModule,
    TransactionsModule,
    TransfersModule,
    ReportsModule,
    LoansModule,
    RemindersModule,
    SavingsModule,
    SpecialsModule,
    PhrasesModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntInterceptor,
    },
    // Global guards run in registration order. ThrottlerGuard must come first
    // so rate limiting also applies to requests that fail authentication
    // (otherwise unauthenticated 401s bypass the limiter entirely).
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
