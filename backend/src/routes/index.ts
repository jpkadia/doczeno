import { Router } from "express";
import { healthRouter } from "./health.routes";
import { authRouter } from "./auth.routes";
import { organizationRouter } from "./organization.routes";
import { doctorRouter } from "./doctor.routes";
import { websiteRouter } from "./website.routes";
import { appointmentRouter } from "./appointment.routes";
import { auditRouter } from "./audit.routes";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/organizations", organizationRouter);
apiV1Router.use("/doctors", doctorRouter);
apiV1Router.use("/websites", websiteRouter);
apiV1Router.use("/appointments", appointmentRouter);
apiV1Router.use("/audit-logs", auditRouter);
