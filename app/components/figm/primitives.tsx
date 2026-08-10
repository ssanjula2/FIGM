"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'header';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '-60px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as 'div';
  return (
    <Comp
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn('reveal', shown && 'reveal-in', className)}
    >
      {children}
    </Comp>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'left',
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  align?: 'left' | 'center';
}) {
  return (
    <Reveal
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center',
      )}
    >
      <p className="mono-label">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-[15px] leading-relaxed text-subtle">{subtitle}</p>
      ) : null}
    </Reveal>
  );
}

export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Tag({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const tones: Record<string, string> = {
    muted: 'text-muted-foreground border-border',
    primary: 'text-primary border-primary/35 bg-primary/10',
    success: 'text-success border-success/35 bg-success/10',
    warning: 'text-warning border-warning/35 bg-warning/10',
    danger: 'text-danger border-danger/35 bg-danger/10',
    info: 'text-info border-info/35 bg-info/10',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}