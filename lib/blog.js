import { getSupabaseAdmin } from "@/lib/db";

/**
 * Columns every post card needs. `category:blog_categories(name)` is a Supabase
 * embedded read that relies on the blog_posts.category_id -> blog_categories.id
 * foreign key from 001_initial_schema.sql. If that FK is ever dropped, this
 * select fails wholesale — which is why the helpers below return the error
 * instead of swallowing it.
 */
const CARD_FIELDS =
  "id,title,slug,excerpt,cover_image,published_at,category:blog_categories(name)";

/**
 * A post is publicly visible only when BOTH conditions hold:
 *   status = 'published'   AND   published_at <= now
 *
 * Note the second condition also excludes rows where published_at IS NULL,
 * because in SQL `null <= now()` evaluates to NULL, not true. That combination
 * is the single most common reason a post "disappears" after being saved.
 */
export async function getPublishedPosts({ limit = 50 } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return {
      posts: [],
      error: "Database is not configured — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing.",
    };
  }

  const { data, error } = await sb
    .from("blog_posts")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Previously this was `const { data } = await ...` — a failed query looked
    // identical to "no posts yet", which is exactly how a real bug hid here.
    console.error("[blog] published post query failed:", error.message);
    return { posts: [], error: error.message };
  }

  return { posts: data ?? [], error: null };
}

/**
 * Explains an empty blog page. Only ever rendered to a signed-in super admin —
 * draft counts are not public information.
 */
export async function diagnoseEmptyBlog() {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb.from("blog_posts").select("status,published_at");
  if (error || !data) return null;

  const counts = { total: data.length, draft: 0, scheduled: 0, archived: 0, publishedButHidden: 0 };
  const now = Date.now();

  for (const row of data) {
    if (row.status === "draft") counts.draft += 1;
    else if (row.status === "scheduled") counts.scheduled += 1;
    else if (row.status === "archived") counts.archived += 1;
    else if (row.status === "published") {
      const stamp = row.published_at ? new Date(row.published_at).getTime() : null;
      if (stamp === null || Number.isNaN(stamp) || stamp > now) counts.publishedButHidden += 1;
    }
  }

  return counts;
}

export function formatPostDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
