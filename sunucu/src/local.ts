import app from "./index.js";
app.listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
  console.log("KentYanımda API: http://localhost:3000"),
);
