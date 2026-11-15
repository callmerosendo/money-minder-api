import { Test } from "@nestjs/testing";
import { PhrasesService } from "./phrases.service";
import { PhrasesController } from "./phrases.controller";
import { CACHE_MANAGER } from "@nestjs/cache-manager";

describe("PhrasesController", () => {
  let phrasesController: PhrasesController;
  const store = new Map<string, unknown>();

  const cacheMock = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };

  beforeEach(async () => {
    store.clear();

    const moduleRef = await Test.createTestingModule({
      controllers: [PhrasesController],
      providers: [PhrasesService, { provide: CACHE_MANAGER, useValue: cacheMock }],
    }).compile();

    phrasesController = moduleRef.get(PhrasesController);
  });

  it("should match a well-formed entry", async () => {
    const phrases = await phrasesController.getPhrases();

    expect(phrases).toEqual({
      phrase: expect.any(String),
      movie: expect.any(String),
      character: expect.any(String),
    });
  });

  it("should return same entry twice", async () => {
    const firstCall = await phrasesController.getPhrases();
    const secondCall = await phrasesController.getPhrases();

    expect(secondCall).toEqual(firstCall);
  });
});
