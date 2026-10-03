import { z } from "zod";

export const urlSchema = z.url();
export const httpUrlSchema = z.url({ protocol: /^https?$/i });
export const httpsUrlSchema = z.url({ protocol: /^https$/i });

export function parseHttpUrl(value: string): URL {
  return new URL(httpUrlSchema.parse(value));
}

export function parseHttpsUrl(value: string): URL {
  return new URL(httpsUrlSchema.parse(value));
}

