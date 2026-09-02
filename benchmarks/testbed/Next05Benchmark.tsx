// Defect: FIGM-NEXT-05
'use client';
import fs from 'fs';
import { useRouter } from 'next/navigation';

export default function Panel() {
  const router = useRouter();
  return <div>{typeof fs.readFileSync}{router ? '' : ''}</div>;
}
