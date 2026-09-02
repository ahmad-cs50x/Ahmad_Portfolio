"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BlogForm from "@/components/blog/BlogForm";
import { Loader2 } from "lucide-react";

export default function EditBlogPostPage() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postId) return;
    fetch(`/api/blog/detail?id=${postId}`)
      .then((r) => r.json())
      .then((json) => (json.success ? setPost(json.post) : setError(json.message || "Failed to load")));
  }, [postId]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!post) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-2xl font-bold text-white">
        Edit post<span className="text-gradient">.</span>
      </h2>
      <BlogForm existing={post} />
    </div>
  );
}
