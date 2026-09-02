"use client";

import { useEffect, useRef } from "react";
import { getSupabasePublic } from "@/lib/db";

/** Subscribes to a server-published Broadcast channel. */
export function useRealtimeChannel(channelName, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!channelName) return undefined;
    const sb = getSupabasePublic();
    if (!sb) return undefined;

    let channel;
    try {
      channel = sb.channel(`pf:${channelName}`, {
        config: { broadcast: { self: false } },
      });
      channel.on("broadcast", { event: "*" }, ({ event, payload }) => {
        handlerRef.current(event, payload);
      });
      channel.subscribe();
    } catch {
      return undefined;
    }

    return () => {
      if (channel) sb.removeChannel(channel).catch(() => {});
    };
  }, [channelName]);
}
