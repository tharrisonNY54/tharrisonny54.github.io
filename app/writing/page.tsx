import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Writing",
};

export default function WritingIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-medium text-text sm:text-4xl">Writing</h1>
      {/* TODO(trey): writing index + posts (Phase 4). */}
    </div>
  );
}
