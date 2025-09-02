import { Worker } from 'bullmq';
import { redis } from './config/redis';

const worker = new Worker('ocr', async job => {
  // TODO: implement OCR processing
}, { connection: redis });

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});
