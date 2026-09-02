import { redirect } from 'next/navigation';

// Canonical forgot-password UI lives at /auth/forgot-password (see app/login/page.tsx for the
// identical rationale on the sibling /login stub).
export default function ForgotPasswordRedirectPage() {
  redirect('/auth/forgot-password');
}
