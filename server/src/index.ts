import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import "./db/connection"; // ensures schema is created before routes load

import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import profileRoutes from "./routes/profile";
import collaboratorsRoutes from "./routes/collaborators";
import managersRoutes from "./routes/managers";
import assetsRoutes from "./routes/assets";
import assetsAggRoutes from "./routes/assetsAgg";
import serecPatientsRoutes from "./routes/serecPatients";
import serecEntriesRoutes from "./routes/serecEntries";
import serecServiceTimesRoutes from "./routes/serecServiceTimes";
import serecErrorsRoutes from "./routes/serecErrors";
import feedbacksRoutes from "./routes/feedbacks";
import auditRoutes from "./routes/audit";
import dashboardRoutes from "./routes/dashboard";
import demoRoutes from "./routes/demo";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "acolhimento-server" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/collaborators", collaboratorsRoutes);
app.use("/api/managers", managersRoutes);
app.use("/api/assets", assetsRoutes);
app.use("/api/assets", assetsAggRoutes);
app.use("/api/serec/patients", serecPatientsRoutes);
app.use("/api/serec/entries", serecEntriesRoutes);
app.use("/api/serec/service-times", serecServiceTimesRoutes);
app.use("/api/serec/errors", serecErrorsRoutes);
app.use("/api/suac/feedbacks", feedbacksRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/demo", demoRoutes);

// Em produção (Railway/Render/VPS), o front-end já compilado (client/dist)
// é servido pelo próprio servidor Express, como um único serviço/deploy.
const clientDist = path.resolve(process.cwd(), "..", "client", "dist");
if (require("fs").existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor.", details: err?.message });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Servidor Acolhimento rodando na porta ${PORT}`);
});
