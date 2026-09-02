// Defect: FIGM-NEXT-07
'use client';
import Link from 'next/link';
export default async function Panel() {
  const data = await fetchClientData();
  return <div>{data}<Link href="/">home</Link></div>;
}
