import { z } from "zod";
export const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(500),
  source: z.enum(["gps", "map"]),
  accuracy: z.number().nonnegative().max(100000).optional(),
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  neighborhood: z.string().trim().max(120),
  homeLocation: pointSchema.optional(),
});
export const reportLocationSchema = z.discriminatedUnion("source", [
  pointSchema,
  z
    .object({
      source: z.literal("manual"),
      address: z.string().trim().min(10).max(500),
    })
    .strict(),
]);
export const reportSchema = z
  .object({
    requestId: z.string().min(1).max(180),
    kind: z.enum(["issue", "improvement"]).default("issue"),
    impacts: z
      .array(
        z.enum([
          "Yaya güvenliği",
          "Erişilebilirlik",
          "Ulaşım",
          "Temel hizmete erişim",
        ]),
      )
      .max(4)
      .default([]),
    category: z.enum([
      "electricity",
      "water",
      "waste",
      "road",
      "ice",
      "pavement",
      "lighting",
      "accessibility",
      "park",
    ]),
    description: z.string().trim().min(15).max(2000),
    sharePublicly: z.boolean().optional(),
    publicArea: z
      .enum([
        "Oltu",
        "Aslanpaşa",
        "Cumhuriyet",
        "Halitpaşa",
        "Karabekir",
        "Şehitler",
        "Yasin Haşimoğlu",
        "Yusuf Ziyabey",
        "Ayyıldız",
      ])
      .optional(),
    location: reportLocationSchema,
    photos: z
      .array(z.string().uuid())
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .refine(
    (input) =>
      (input.kind === "improvement") ===
      ["pavement", "lighting", "accessibility", "park"].includes(
        input.category,
      ),
    { message: "Talep türü ve kategori uyuşmuyor." },
  );
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
