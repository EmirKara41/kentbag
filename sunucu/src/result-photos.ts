import type { Sql } from "./database.js";
import { photoUrl } from "./storage.js";
import type { Config } from "./config.js";
export async function resultPhotos(
  sql: Sql,
  config: Pick<Config, "baseUrl" | "secret">,
  reportId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const rows = (
    await sql.query(
      "SELECT id,width,height FROM citizen_photo WHERE report_id=$1 AND id=ANY($2::text[])",
      [reportId, ids],
    )
  ).rows;
  return ids.flatMap((id) => {
    const photo = rows.find((p) => p.id === id);
    return photo
      ? [
          {
            id,
            width: photo.width,
            height: photo.height,
            uri: photoUrl(config.baseUrl, config.secret, id),
          },
        ]
      : [];
  });
}
