export interface ProgressEvent {
  stage: string;
  message: string;
  percent: number;
  detail?: string;
}

/**
 * Create an SSE (Server-Sent Events) streaming Response.
 * The fetcher function receives a progress callback and returns the final data.
 */
export function createSSEStream<T>(
  fetcher: (onProgress: (event: ProgressEvent) => void) => Promise<T>
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        const data = await fetcher((progress) => {
          send("progress", progress);
        });
        send("complete", data);
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
