import { Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sprout className="size-4" />
              </span>
              <span className="font-display font-semibold tracking-tight">Volunteer Connect</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              A public platform for civic cooperation — connecting NGOs and volunteers who create real impact.
            </p>
          </div>
          <FooterCol title="Platform" links={[
            { to: "/opportunities", label: "Browse opportunities" },
            { to: "/auth", label: "For volunteers" },
            { to: "/auth", label: "For NGOs" },
          ]} />
          <FooterCol title="Company" links={[
            { to: "/about", label: "About" },
            { to: "/contact", label: "Contact" },
            { to: "/faq", label: "FAQ" },
          ]} />
          <FooterCol title="Legal" links={[
            { to: "/privacy", label: "Privacy policy" },
            { to: "/terms", label: "Terms of service" },
          ]} />
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Volunteer Connect. Made for changemakers.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h5 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h5>
      <ul className="space-y-3 text-sm">
        {links.map((l) => (
          <li key={l.label}><Link to={l.to} className="text-foreground hover:text-primary transition-colors">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
