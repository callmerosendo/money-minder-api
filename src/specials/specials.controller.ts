import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { users } from "@prisma/client";
import {
  CashFlowDto,
  CategoriesDto,
  FinancialSummaryMonthlyDto,
  FinancialSummaryYearlyDto,
  RecentTransactionsDto,
} from "./specials.dto";
import { SpecialsService } from "./specials.service";

@Controller("specials")
export class SpecialsController {
  constructor(private readonly specialsService: SpecialsService) {}

  @Get("financial-summary-yearly")
  async getFinancialSummaryYearly(
    @CurrentUser() user: users,
    @Query() dto: FinancialSummaryYearlyDto,
  ) {
    return this.specialsService.getFinancialSummaryYearly(user.id, dto.year);
  }

  @Get("financial-summary-monthly")
  async getFinancialSummaryMonthly(
    @CurrentUser() user: users,
    @Query() dto: FinancialSummaryMonthlyDto,
  ) {
    return this.specialsService.getFinancialSummaryMonthly(user.id, dto.month, dto.year);
  }

  @Get("cash-flow")
  async getCashFlow(@CurrentUser() user: users, @Query() dto: CashFlowDto) {
    return this.specialsService.getCashFlow(user.id, dto.year);
  }

  @Get("yearly-categories")
  async getCategories(@CurrentUser() user: users, @Query() dto: CategoriesDto) {
    return this.specialsService.getCategories(user.id, dto.year);
  }

  @Get("recent-transactions")
  async getRecentTransactions(@CurrentUser() user: users, @Query() dto: RecentTransactionsDto) {
    return this.specialsService.getRecentTransactions(user.id, dto.year);
  }
}
