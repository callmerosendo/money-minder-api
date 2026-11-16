import { Public } from "@/common";
import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  @SkipThrottle()
  check() {
    return { status: "ok" };
  }
}
