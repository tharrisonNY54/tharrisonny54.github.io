export default async function WritingPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <p className="label">POST · {slug}</p>
      {/* TODO(trey): MDX writing post pipeline (Phase 4). */}
    </div>
  );
}
