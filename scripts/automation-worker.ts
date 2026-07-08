import { Worker } from "bullmq";
import { getRedisConnection } from "@/lib/queue";
import { runAutomation } from "@/lib/automation-engine";

const connection = getRedisConnection();

if (!connection) {
  console.log("REDIS_URL이 없어 AI 자동화 워커를 시작하지 않습니다.");
  process.exit(0);
}

new Worker(
  "content-automation",
  async (job) => {
    return runAutomation(job.data);
  },
  { connection: connection as never }
);

console.log("AI Content Studio automation worker started");
