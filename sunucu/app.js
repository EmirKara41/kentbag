// JavaScript entry avoids deployment-time TypeScript compiler differences.
import express from "express";
import handler from "./dist/server.js";
const app = express();
app.use(handler);
export default app;
