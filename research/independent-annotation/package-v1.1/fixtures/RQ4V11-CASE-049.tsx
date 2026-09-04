export const dynamic = 'force-dynamic';
export default async function Page() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  return <PostList posts={posts} />;
}
