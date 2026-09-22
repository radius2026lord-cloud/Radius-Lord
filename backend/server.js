require("dotenv").config();

const express = require("express");
const authRoutes = require("./routes/auth");

const app = express();
const port = Number(process.env.BACKEND_PORT || 4001);

app.use(express.json({ limit: "100kb" }));
app.use("/api/auth", authRoutes);

app.get("/api/health", (_req, res) => res.json({ success: true }));

app.listen(port, () => {
  console.log(`Lord Radius backend listening on http://localhost:${port}`);
});
