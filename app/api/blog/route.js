import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function resolveTags(sb, tags) {
  if (!Array.isArray(tags)) return [];
  const ids = [];
  for (const raw of tags.slice(0, 10)) {
    const name = String(raw).trim().slice(0, 60);
    if (!name) continue;
    const slug = slugify(name);
    const { data: existing } = await sb.from("blog_tags").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const { data: created } = await sb.from("blog_tags").insert({ name, slug }).select("id").single();
    if (created) ids.push(created.id);
  }
  return ids;
}

async function syncTags(sb, postId, tagIds) {
  await sb.from("blog_post_tags").delete().eq("post_id", postId);
  if (tagIds.length) {
    await sb.from("blog_post_tags").insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
  }
}

export async function POST(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ success: false, message: "Title is required." }, { status: 400 });

  const status = ["draft", "published", "scheduled", "archived"].includes(body.status) ? body.status : "draft";

  /*
   * A post is only publicly visible when status='published' AND published_at <= now.
   * Flipping the status dropdown without also filling the (easily missed) date
   * field used to 400 here, and a post saved as 'published' with a null date
   * would silently never appear. So: stamp "now" when the date is absent.
   * 'scheduled' is the one case where a date is genuinely required — the whole
   * point of scheduling is the future timestamp.
   */
  let publishedAt = body.publishedAt ? new Date(body.publishedAt).toISOString() : null;
  if (status === "published" && !publishedAt) publishedAt = new Date().toISOString();
  if (status === "scheduled" && !publishedAt) {
    return NextResponse.json(
      { success: false, message: "A scheduled post needs a publish date in the future." },
      { status: 400 }
    );
  }

  const sb = getSupabaseAdmin();
  let slug = slugify(body.slug || title);

  const { data: clash } = await sb.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  const { data: post, error } = await sb
    .from("blog_posts")
    .insert({
      title,
      slug,
      excerpt: body.excerpt?.slice(0, 500) ?? null,
      content: body.content ?? "",
      cover_image: body.coverImage || null,
      category_id: body.categoryId || null,
      seo_title: body.seoTitle || null,
      seo_description: body.seoDescription || null,
      status,
      published_at: publishedAt,
    })
    .select("id,title,slug,status")
    .single();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  await syncTags(sb, post.id, await resolveTags(sb, body.tags));
  return NextResponse.json({ success: true, post });
}

export async function PATCH(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ success: false, message: "Post id required." }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: current } = await sb
    .from("blog_posts")
    .select("status,published_at")
    .eq("id", body.id)
    .maybeSingle();
  if (!current) return NextResponse.json({ success: false, message: "Post not found." }, { status: 404 });

  const patch = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.slug !== undefined) patch.slug = slugify(body.slug);
  if (body.excerpt !== undefined) patch.excerpt = body.excerpt?.slice(0, 500) ?? null;
  if (body.content !== undefined) patch.content = body.content;
  if (body.coverImage !== undefined) patch.cover_image = body.coverImage || null;
  if (body.categoryId !== undefined) patch.category_id = body.categoryId || null;
  if (body.seoTitle !== undefined) patch.seo_title = body.seoTitle || null;
  if (body.seoDescription !== undefined) patch.seo_description = body.seoDescription || null;
  if (["draft", "published", "scheduled", "archived"].includes(body.status)) patch.status = body.status;
  if (body.publishedAt !== undefined) {
    patch.published_at = body.publishedAt ? new Date(body.publishedAt).toISOString() : null;
  }

  /*
   * Same rule as POST: a post that ends up 'published' must carry a date, or it
   * will never satisfy `published_at <= now` and will silently stay invisible.
   * Check the *resulting* state — the status might be unchanged in this patch
   * while the date is being cleared, or vice versa.
   */
  const nextStatus = patch.status ?? current.status;
  const nextPublishedAt =
    patch.published_at !== undefined ? patch.published_at : current.published_at;

  if (nextStatus === "published" && !nextPublishedAt) {
    patch.published_at = new Date().toISOString();
  }
  if (nextStatus === "scheduled" && !nextPublishedAt) {
    return NextResponse.json(
      { success: false, message: "A scheduled post needs a publish date in the future." },
      { status: 400 }
    );
  }

  const { data: post, error } = await sb
    .from("blog_posts")
    .update(patch)
    .eq("id", body.id)
    .select("id,title,slug,status")
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  if (!post) return NextResponse.json({ success: false, message: "Post not found." }, { status: 404 });

  if (Array.isArray(body.tags)) await syncTags(sb, post.id, await resolveTags(sb, body.tags));
  return NextResponse.json({ success: true, post });
}

export async function DELETE(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, message: "id required." }, { status: 400 });

  const archive = new URL(request.url).searchParams.get("archive") === "true";
  const sb = getSupabaseAdmin();

  if (archive) {
    await sb.from("blog_posts").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ success: true, archived: true });
  }

  await sb.from("blog_posts").delete().eq("id", id);
  return NextResponse.json({ success: true, deleted: true });
}
