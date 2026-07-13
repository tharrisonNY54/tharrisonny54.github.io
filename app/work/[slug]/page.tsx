export default async function WorkCaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <p className="label">CASE STUDY · {slug}</p>
      {/* TODO(trey): MDX case-study pipeline + template (Phase 3). */}
    </div>
  );
}
