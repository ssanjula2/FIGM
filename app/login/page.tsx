import { redirect } from 'next/navigation';

// /login was a duplicate of the real, canonical /auth/login page (different implementation --
// this route stored its auth token in plain localStorage instead of the httpOnly cookie the rest
// of the app relies on, and its own in-page "Log out" nav entries elsewhere never actually called
// this page's logic at all). Kept as a permanent redirect rather than deleted outright, so any
// bookmarked/indexed link to the old URL still lands somewhere real instead of a 404.
export default function LoginRedirectPage() {
  redirect('/auth/login');
}
