import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import * as phrases from "../phrases.json";
import { Quote } from "./phrases.dto";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PhrasesService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getPhrases() {
    const cacheKey = "all_phrases";
    const cachedPhrases = await this.cacheManager.get<Quote[] | null>(cacheKey);
    if (cachedPhrases) return cachedPhrases;

    // 24 hours in milliseconds (24 * 60 * 60 * 1000)
    await this.cacheManager.set(cacheKey, phrases, DAY_IN_MS);
    return phrases;
  }

  /**
   * Picks the phrase of the day (day-of-month index) and caches it until the
   * cache key rolls over. Kept here rather than in the controller so all cache
   * handling for this feature lives in one place.
   */
  async getDailyPhrase(): Promise<Quote | null> {
    const today = new Date();
    const cacheKey = `daily_phrase_${today.getDate()}`;

    const cachedPhrase = await this.cacheManager.get<Quote>(cacheKey);
    if (cachedPhrase) return cachedPhrase;

    const phrases = await this.getPhrases();
    if (!phrases?.length) return null;

    const dailyPhrase = phrases[today.getDate() % phrases.length];

    await this.cacheManager.set(cacheKey, dailyPhrase, DAY_IN_MS);
    return dailyPhrase;
  }
}
