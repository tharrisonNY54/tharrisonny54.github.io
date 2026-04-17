export default function Footer() {
  return (
    <footer className="py-12 px-6 mx-auto max-w-5xl">
      <div className="border-t border-border pt-8 flex justify-between items-center">
        <span className="text-text-muted/40 text-xs font-sans tracking-wide">
          Trey Harrison
        </span>
        <span className="text-text-muted/40 text-xs font-sans tracking-wide">
          {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  )
}
