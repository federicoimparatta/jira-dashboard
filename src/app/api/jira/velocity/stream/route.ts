import { createSSEStream } from "@/lib/streaming/create-stream";
import { getVelocityData } from "@/lib/jira/velocity";

export const maxDuration = 300;

export async function GET() {
  return createSSEStream(async (onProgress) => {
    return await getVelocityData((velocityProgress) => {
      onProgress({
        stage: velocityProgress.stage,
        message: velocityProgress.message,
        percent: velocityProgress.percent,
        detail: velocityProgress.boardName
          ? `Board: ${velocityProgress.boardName}`
          : undefined,
      });
    });
  });
}
