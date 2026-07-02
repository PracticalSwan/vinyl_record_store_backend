import { success } from "@/lib/http";
import { ALGORITHM_VERSION } from "@/lib/recommender/contentBased";

export function GET() {
  return success({
    status: "ok",
    service: "vinyl-record-store-backend",
    catalogMode: "demo-seed",
    algorithmVersion: ALGORITHM_VERSION,
  });
}
