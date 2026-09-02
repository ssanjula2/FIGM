// Defect: FIGM-NEXT-08
'use client';
import { useSearchParams } from 'next/navigation';
export default function Filters() {
  const params = useSearchParams();
  return <div>{params.get('q')}</div>;
}
