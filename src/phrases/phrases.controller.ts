import { Controller, Get } from "@nestjs/common";
import { Public } from "@/common/decorators/public.decorator";
import { PhrasesService } from "./phrases.service";
import { SkipThrottle } from "@nestjs/throttler";

@Controller("phrases")
export class PhrasesController {
  constructor(private readonly phrasesService: PhrasesService) {}

  @Public()
  @Get("daily-phrase")
  @SkipThrottle()
  async getPhrases() {
    return this.phrasesService.getDailyPhrase();
  }
}
