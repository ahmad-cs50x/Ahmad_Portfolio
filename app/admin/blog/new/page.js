import BlogForm from "@/components/blog/BlogForm";

export const metadata = { title: "New Post — Admin" };

export default function NewBlogPostPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-2xl font-bold text-white">
        New blog post<span className="text-gradient">.</span>
      </h2>
      <BlogForm />
    </div>
  );
}
