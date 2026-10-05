import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getEnv } from "@/config/env";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function getAuth() {
  const mongooseInstance = await connectToDatabase();
  const db = mongooseInstance.connection.db;

  if (!db) {
    throw new Error("MongoDB database is not available for Better Auth adapter");
  }

  const { BETTER_AUTH_SECRET, BETTER_AUTH_URL } = getEnv();

  return betterAuth({
    database: mongodbAdapter(db),
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "INDEPENDENT_DOCTOR",
        },
        organizationId: {
          type: "string",
          required: false,
        },
        doctorProfileId: {
          type: "string",
          required: false,
        },
      },
    },
  });
}
