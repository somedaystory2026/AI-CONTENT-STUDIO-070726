import { Worker } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.log("REDIS_URL이 없어 queue worker를 시작하지 않습니다.");
  process.exit(0);
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const imageWorker = new Worker(
  "aics:image",
  async (job) => {
    console.log(`[image] ${job.name}`, job.data);
    await job.updateProgress(100);
    return { message: "Image job placeholder completed", input: job.data };
  },
  { connection: connection as never }
);

const videoWorker = new Worker(
  "aics:video",
  async (job) => {
    console.log(`[video] ${job.name}`, job.data);
    await job.updateProgress(100);
    return { message: "Video job placeholder completed", input: job.data };
  },
  { connection: connection as never }
);

imageWorker.on("completed", (job) => console.log(`[image] completed ${job.id}`));
videoWorker.on("completed", (job) => console.log(`[video] completed ${job.id}`));
imageWorker.on("failed", (job, error) => console.error(`[image] failed ${job?.id}`, error));
videoWorker.on("failed", (job, error) => console.error(`[video] failed ${job?.id}`, error));

console.log("AI Content Studio queue worker started.");
