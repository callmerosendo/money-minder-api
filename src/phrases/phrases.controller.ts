import { Controller, Get } from "@nestjs/common";
import { Public } from "@/common/decorators/public.decorator";
import { PhrasesService } from "./phrases.service";

@Controller("phrases")
export class PhrasesController {
  constructor(private readonly phrasesService: PhrasesService) {}

  @Public()
  @Get("daily-phrase")
  async getPhrases() {
    return this.phrasesService.getDailyPhrase();
  }
}
