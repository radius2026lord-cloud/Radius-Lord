import express from "express";

export const app = express();

app.use(express.json({limit:'8mb'}));

app.get("/", (req, res) => {
  res.send("Hello from Backend!");
});
