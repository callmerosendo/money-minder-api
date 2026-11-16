export interface NestConfig {
  port: number;
}

export interface CorsConfig {
  origins: string[];
}

export interface Config {
  nest: NestConfig;
  cors: CorsConfig;
}
