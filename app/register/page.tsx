import { redirect } from 'next/navigation';

// Canonical registration UI lives at /auth/register (see app/login/page.tsx for the identical
// rationale on the sibling /login stub). This route exists only so a bookmarked/typed /register
// URL lands somewhere real instead of a 404, and so /login + /register + /forgot-password form a
// consistent top-level trio.
export default function RegisterRedirectPage() {
  redirect('/auth/register');
}
