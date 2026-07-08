import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export type StudioQueueName = "image" | "video" | "publisher" | "rss";

type QueuePayload = Record<string, unknown>;

let redisConnection: IORedis | null = null;

export const connection = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null }) : null;

export function getRedisConnection() {
  if (!process.env.REDIS_URL) return null;
  if (!redisConnection) redisConnection = connection || new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  return redisConnection;
}

export function isQueueEnabled() {
  return Boolean(process.env.REDIS_URL);
}

export function getStudioQueue(name: StudioQueueName) {
  const connection = getRedisConnection();
  if (!connection) return null;
  return new Queue(`aics:${name}`, { connection: connection as never });
}

export function getQueueEvents(name: StudioQueueName) {
  const connection = getRedisConnection();
  if (!connection) return null;
  return new QueueEvents(`aics:${name}`, { connection: connection as never });
}

export async function enqueueStudioJob(name: StudioQueueName, jobName: string, payload: QueuePayload) {
  const queue = getStudioQueue(name);

  if (!queue) {
    return {
      queued: false,
      id: `local-${Date.now()}`,
      message: "REDIS_URL이 없어 로컬 즉시 처리 모드로 응답합니다.",
    };
  }

  const job = await queue.add(jobName, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });

  return { queued: true, id: job.id, message: "큐에 등록되었습니다." };
}
