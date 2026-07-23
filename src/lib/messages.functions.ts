import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ThreadSummary = {
  otherUserId: string;
  otherUser: { id: string; display_name: string | null; email: string; photo_url: string | null } | null;
  lastMessage: { body: string; created_at: string; sender_id: string } | null;
  unreadCount: number;
};

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary[]> => {
    const { supabase, userId } = context;
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, read_at, created_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(500);

    const byOther = new Map<string, { last: any; unread: number }>();
    for (const m of msgs ?? []) {
      const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
      const entry = byOther.get(other) ?? { last: null, unread: 0 };
      if (!entry.last) entry.last = m;
      if (m.recipient_id === userId && !m.read_at) entry.unread += 1;
      byOther.set(other, entry);
    }

    const ids = Array.from(byOther.keys());
    const { data: users } = ids.length
      ? await supabase.from("users").select("id, display_name, email, photo_url").in("id", ids)
      : { data: [] as any[] };
    const { signPhotoField } = await import("./photo-signing");
    const signedUsers = await signPhotoField(supabase, (users ?? []) as any[], "photo_url");
    const uMap = new Map(signedUsers.map((u: any) => [u.id, u]));

    return ids.map((id) => {
      const entry = byOther.get(id)!;
      return {
        otherUserId: id,
        otherUser: uMap.get(id) ?? null,
        lastMessage: entry.last
          ? { body: entry.last.body, created_at: entry.last.created_at, sender_id: entry.last.sender_id }
          : null,
        unreadCount: entry.unread,
      };
    });
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { otherUserId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, read_at, created_at")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${data.otherUserId}),and(sender_id.eq.${data.otherUserId},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);

    const { data: other } = await supabase
      .from("users")
      .select("id, display_name, email, photo_url")
      .eq("id", data.otherUserId)
      .maybeSingle();

    return { messages: msgs ?? [], other };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recipientId: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const body = data.body.trim();
    if (!body) throw new Error("Empty message");
    const { data: u } = await supabase.from("users").select("gym_id").eq("id", userId).maybeSingle();
    if (!u?.gym_id) throw new Error("No gym");
    // Enforce that recipient belongs to the sender's gym.
    const { data: recip } = await supabase
      .from("users")
      .select("id, gym_id")
      .eq("id", data.recipientId)
      .maybeSingle();
    if (!recip || recip.gym_id !== u.gym_id) {
      throw new Error("Recipient not found in your gym");
    }
    const { data: ins, error } = await supabase
      .from("messages")
      .insert({ gym_id: u.gym_id, sender_id: userId, recipient_id: data.recipientId, body })
      .select("id, sender_id, recipient_id, body, read_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return ins;
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { senderId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .eq("sender_id", data.senderId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null);
    return { count: count ?? 0 };
  });
