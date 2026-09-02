import { getSupabasePublic } from "@/lib/db";

const CHANNEL_PREFIX = "pf";

/**
 * Server-side Supabase Realtime publisher.
 * Uses Broadcast channels so RLS never has to expose table reads.
 */
export async function publish(channelName, event, payload) {
  const sb = getSupabasePublic();
  if (!sb) return false;
  try {
    const channel = sb.channel(`${CHANNEL_PREFIX}:${channelName}`, {
      config: { broadcast: { self: false } },
    });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.send({ type: "broadcast", event, payload });
        await sb.removeChannel(channel);
      }
    });
    return true;
  } catch (error) {
    console.error("[realtime] publish failed:", error.message);
    return false;
  }
}

export const channels = {
  conversation: (clientId) => `conv:${clientId}`,
  user: (profileId) => `user:${profileId}`,
};
