"use client";

import { useEffect, useState } from 'react';
import { Github, BookText, Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const links = [
  { label: 'Product', href: '#product' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Rules', href: '#rules' },
  { label: 'Research', href: '#research' },
  { label: 'Developers', href: '#developers' },
];

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="none" stroke="var(--hairline)" />
      <path d="M6 7h9M6 12h6M6 17h3" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="16.5" r="2.2" fill="none" stroke="var(--info)" strokeWidth="1.4" />
    </svg>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        aria-label="Main"
        className={cn(
          'mx-auto flex max-w-6xl items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300',
          scrolled ? 'glass-nav shadow-[0_18px_50px_-30px_black]' : 'border border-transparent',
        )}
      >
        <a href="#top" className="flex items-center gap-2 pr-2">
          <Mark />
          <span className="font-mono text-[15px] font-semibold tracking-[0.18em] text-foreground">
            FIGM
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-md px-3 py-1.5 text-[13px] text-subtle transition-colors hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          <a
            href="#docs"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] text-subtle transition-colors hover:text-foreground"
          >
            <BookText size={14} aria-hidden="true" /> Documentation
          </a>
          <a
            href="#github"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] text-subtle transition-colors hover:text-foreground"
          >
            <Github size={14} aria-hidden="true" /> GitHub
          </a>
          <a
            href="#launch"
            className="ml-1 inline-flex items-center rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground transition-transform duration-200 hover:-translate-y-px hover:bg-primary/90"
          >
            Launch Inspector
          </a>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex size-9 items-center justify-center rounded-md border border-border text-subtle md:hidden"
        >
          {open ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
        </button>
      </nav>

      {open ? (
        <div className="glass-nav mx-auto mt-2 max-w-6xl rounded-xl p-3 md:hidden">
          <ul className="grid gap-1">
            {[...links, { label: 'Documentation', href: '#docs' }, { label: 'GitHub', href: '#github' }].map(
              (l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm text-subtle hover:bg-secondary hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ),
            )}
          </ul>
          <a
            href="#launch"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
          >
            Launch Inspector
          </a>
        </div>
      ) : null}
    </header>
  );
}