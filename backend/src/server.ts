import { createApp } from "./app";
import { connectToDatabase, disconnectDatabase } from "./db/connection";
import { AuthService } from "./services/auth.service";
import { MediaService } from "./services/media.service";
import { getEnv } from "./config/env";

async function bootstrap() {
  const env = getEnv();
  const app = createApp();

  try {
    console.log("[Doczeno Server]: Initializing database connection...");
    await connectToDatabase();
    console.log("[Doczeno Server]: Connected to MongoDB successfully.");

    // Ensure platform superadmin is seeded
    await AuthService.ensureSuperadminSeed();

    // Schedule automated orphaned media cleanup (runs every 12 hours, purges unattached uploads > 24 hours old)
    const cleanupIntervalHours = 12;
    const orphanCleanupTimer = setInterval(async () => {
      try {
        console.log("[Doczeno Cleanup]: Running scheduled orphaned media purge...");
        const result = await MediaService.cleanupOrphanedMedia(24);
        console.log(`[Doczeno Cleanup]: Purged ${result.deletedCount} orphaned assets.`);
      } catch (err) {
        console.error("[Doczeno Cleanup Error]:", err);
      }
    }, cleanupIntervalHours * 60 * 60 * 1000);

    const server = app.listen(env.PORT, () => {
      console.log(`[Doczeno Server]: Backend API listening on port ${env.PORT} (${env.NODE_ENV})`);
    });

    const shutdown = async (signal: string) => {
      console.log(`[Doczeno Server]: Received ${signal}. Shutting down gracefully...`);
      clearInterval(orphanCleanupTimer);
      server.close(async () => {
        await disconnectDatabase();
        console.log("[Doczeno Server]: Database disconnected. Server terminated.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("[Doczeno Server Startup Error]:", error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  bootstrap();
}
