import express from "express";
import {db} from "./config/db";

export const app = express();

app.use(express.json({limit:'8mb'}));

app.get("/", (req, res) => {
  res.send("Hello from Backend!");
});

app.get("/release-health", async (_req, res) => {
  res.set("Cache-Control","no-store");
  try {
    await db.pool.query({sql:"SELECT 1",timeout:3000});
    return res.json({ok:true,version:process.env.RADIUS_RELEASE_VERSION||null,commit:process.env.RADIUS_RELEASE_COMMIT||null});
  } catch {
    return res.status(503).json({ok:false});
  }
});
