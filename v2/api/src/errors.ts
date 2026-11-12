import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { TransitionError } from "@kentbag/shared";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) return void res.status(error.status).json({ error: error.message });
  if (error instanceof TransitionError) {
    const status = error.code === "forbidden" ? 403 : error.code === "invalid_input" ? 400 : 409;
    return void res.status(status).json({ error: error.message });
  }
  if (error instanceof ZodError) return void res.status(400).json({ error: "Gönderilen bilgiler eksik veya hatalı." });
  if (error?.type === "entity.too.large") return void res.status(413).json({ error: "Dosya çok büyük." });
  console.error(error);
  res.status(500).json({ error: "Beklenmeyen bir hata oluştu. Tekrar dene." });
};
