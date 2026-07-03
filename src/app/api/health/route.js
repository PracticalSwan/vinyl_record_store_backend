import { getCatalogDataSource } from "@/lib/db/dataSource";
import { pingMongoDB } from "@/lib/db/mongodb";
import { persistenceUnavailable } from "@/lib/errors";
import { failure, success } from "@/lib/http";
import { ALGORITHM_VERSION } from "@/lib/recommender/contentBased";

export async function GET() {
  try {
    const catalogMode = getCatalogDataSource();
    const database = catalogMode === "mongodb"
      ? await pingMongoDB().catch(() => { throw persistenceUnavailable(); })
      : { status: "not-required" };
    return success({
      status: "ok",
      service: "vinyl-record-store-backend",
      catalogMode,
      database,
      algorithmVersion: ALGORITHM_VERSION,
    });
  } catch (error) {
    return failure(error);
  }
}
