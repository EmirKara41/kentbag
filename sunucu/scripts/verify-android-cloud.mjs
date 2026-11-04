// Live release verification: uses a labelled demo account/receipt and a synthetic one-pixel image.
// Never uses a citizen's personal photo or prints session credentials.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { apiUrl } = JSON.parse(
  readFileSync("../mobil/production-service.json", "utf8"),
);
const account = JSON.parse(
  readFileSync(".local/cloud-verification.json", "utf8"),
);
const origin = "https://localhost";
async function call(path, { method = "GET", token, owner, body, image } = {}) {
  const response = await fetch(apiUrl + path, {
    method,
    credentials: "omit",
    signal: AbortSignal.timeout(30000),
    headers: {
      Origin: origin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(owner ? { "X-Citizen-Id": owner } : {}),
      ...(image
        ? { "Content-Type": "image/png" }
        : body
          ? { "Content-Type": "application/json" }
          : {}),
    },
    ...(image ? { body: image } : body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    origin,
    "Android WebView origin must be allowed",
  );
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return { response, data: await response.json() };
}
const login = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: { email: account.email, password: account.password },
});
const token = login.response.headers.get("set-auth-token");
assert.ok(token);
assert.ok(
  login.response.headers
    .get("access-control-expose-headers")
    ?.includes("set-auth-token"),
);
const owner = login.data.user.id;
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
  "base64",
);
const photo = await call("/api/photos/android-cloud-140-test-photo", {
  method: "PUT",
  token,
  owner,
  image,
});
const body = {
  requestId: "android-cloud-140-photo-test",
  kind: "issue",
  category: "waste",
  description:
    "DEMO TEST KAYDI: Android internet bağlantısı ve örnek fotoğraf aktarımı testi. Gerçek bir temizlik bildirimi değildir.",
  location: {
    source: "manual",
    address: "DEMO ADRES: Oltu uygulama test alanı",
  },
  photos: [photo.data.id],
  sharePublicly: false,
};
const first = await call("/api/reports", {
  method: "POST",
  token,
  owner,
  body,
});
const retry = await call("/api/reports", {
  method: "POST",
  token,
  owner,
  body,
});
assert.equal(retry.data.id, first.data.id, "Retry must reuse the receipt");
const workspace = await call("/api/workspace", { token, owner });
const report = workspace.data.reports.find((r) => r.id === first.data.id);
assert.equal(report.photos.length, 1);
assert.ok(report.photos[0].uri.startsWith(apiUrl + "/api/photos/"));
const signedPhoto = await fetch(report.photos[0].uri);
assert.equal(signedPhoto.status, 200);
assert.deepEqual(Buffer.from(await signedPhoto.arrayBuffer()), image);
assert.equal(
  (await fetch(apiUrl + "/api/photos/" + photo.data.id)).status,
  403,
);
const staff = JSON.parse(readFileSync(".local/cloud-staff.json", "utf8")).find(
  (a) => a.role === "center",
);
const center = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: { email: staff.email, password: staff.password },
});
const panel = await call("/api/municipality/workspace", {
  token: center.response.headers.get("set-auth-token"),
});
assert.ok(panel.data.data.reports.some((r) => r.id === first.data.id));
console.log(
  JSON.stringify({
    ok: true,
    report: first.data.reference,
    androidOrigin: "verified",
    signedBearer: "verified",
    photoUploadRead: "verified",
    idempotentRetry: "verified",
    centerQueue: "verified",
  }),
);
