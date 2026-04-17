import { motion } from 'framer-motion'

const inView = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
}

export default function Contact() {
  return (
    <section id="contact" aria-label="Contact" className="py-28 px-6 mx-auto max-w-5xl">
      <div className="border-t border-border pt-16">
        <motion.p
          {...inView}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-text-muted text-[11px] tracking-[0.28em] uppercase font-sans mb-14"
        >
          Contact
        </motion.p>

        <motion.div
          {...inView}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.08 }}
          className="max-w-lg"
        >
          <p className="text-text text-lg leading-relaxed mb-12">
            I'm generally responsive by email.
          </p>

          <ul className="space-y-0" aria-label="Contact links">
            <ContactLink
              label="Email"
              href="mailto:smirkinbunny@gmail.com"
              text="smirkinbunny@gmail.com"
            />
            <ContactLink
              label="GitHub"
              href="https://github.com/tharrisonny54"
              text="tharrisonny54"
              external
            />
            <ContactLink
              label="LinkedIn"
              href="https://www.linkedin.com/in/trey-harrison/"
              text="trey-harrison"
              external
            />
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

function ContactLink({
  label,
  href,
  text,
  external = false,
}: {
  label: string
  href: string
  text: string
  external?: boolean
}) {
  const externalProps = external
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
    : {}

  return (
    <li className="border-t border-border py-4 flex justify-between items-baseline gap-6">
      <span className="text-text-muted text-[10px] tracking-[0.22em] uppercase font-sans shrink-0">
        {label}
      </span>
      <a
        href={href}
        {...externalProps}
        className="text-text text-sm hover:text-accent transition-colors duration-200 text-right"
      >
        {text}
      </a>
    </li>
  )
}
