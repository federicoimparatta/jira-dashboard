"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface StreamProgress {
  stage: string;
  message: string;
  percent: number;
  detail?: string;
}

interface UseStreamingDataOptions<T> {
  /** SWR-fetched data (may be cached) */
  swrData: T | undefined;
  /** Whether SWR is still loading */
  swrLoading: boolean;
  /** SWR error */
  swrError: unknown;
  /** URL of the SSE streaming endpoint */
  streamUrl: string;
  /** Delay before starting the stream (ms). Gives SWR time to return cached data. */
  streamDelay?: number;
}

interface UseStreamingDataResult<T> {
  data: T | undefined;
  error: string | null;
  isLoading: boolean;
  progress: StreamProgress | null;
}

/**
 * Generic hook that combines SWR (for cached data) with SSE streaming (for progress).
 * If SWR returns data quickly, the stream is never opened.
 * If SWR is slow (cache miss), the stream provides real-time progress.
 */
export function useStreamingData<T>({
  swrData,
  swrLoading,
  swrError,
  streamUrl,
  streamDelay = 800,
}: UseStreamingDataOptions<T>): UseStreamingDataResult<T> {
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [streamData, setStreamData] = useState<T | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamStartedRef = useRef(false);

  const startStream = useCallback(() => {
    if (eventSourceRef.current) return;
    setIsStreaming(true);
    setStreamError(null);

    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.addEventListener("progress", (e) => {
      try {
        setProgress(JSON.parse(e.data));
      } catch { /* ignore */ }
    });

    es.addEventListener("complete", (e) => {
      try {
        setStreamData(JSON.parse(e.data));
      } catch { /* ignore */ }
      es.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent && e.data) {
        try {
          const err = JSON.parse(e.data);
          setStreamError(err.message || "Stream error");
        } catch {
          setStreamError("Connection error");
        }
      }
      es.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    };
  }, [streamUrl]);

  // Start stream if SWR doesn't have cached data after delay
  useEffect(() => {
    if (swrLoading && !swrData && !streamStartedRef.current) {
      const timer = setTimeout(() => {
        streamStartedRef.current = true;
        startStream();
      }, streamDelay);
      return () => clearTimeout(timer);
    }
  }, [swrLoading, swrData, streamDelay, startStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const data = swrData || (streamData as T | undefined);
  const error = swrError
    ? typeof swrError === "string" ? swrError : "Failed to load data"
    : streamError;
  const isLoading = !data && (swrLoading || isStreaming);

  return { data, error, isLoading, progress };
}
