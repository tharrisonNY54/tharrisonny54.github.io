import { motion } from 'framer-motion'

/*
 * To add writing posts:
 *
 * 1. Create src/data/posts.ts with this shape:
 *      export interface Post {
 *        slug: string
 *        title: string
 *        date: string   // ISO 8601, e.g. "2025-03-15"
 *        excerpt: string
 *      }
 *      export const posts: Post[] = [ ... ]
 *
 * 2. Import `posts` here and map them into PostCard components below
 *    (replace the "coming soon" paragraph with your list).
 *
 * 3. For full post pages, add .tsx files in src/posts/ and wire up
 *    routes with react-router-dom in App.tsx.
 */

export default function Writing() {
  return (
    <section id="writing" aria-label="Writing" className="py-28 px-6 mx-auto max-w-5xl">
      <div className="border-t border-border pt-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p className="text-text-muted text-[11px] tracking-[0.28em] uppercase font-sans mb-14">
            Writing
          </p>
          <p className="text-text-muted text-base leading-relaxed max-w-sm">
            Notes and longer pieces &mdash; coming soon.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
