import { useRouter } from 'next/navigation';

export default function Hero() {
  const router = useRouter();
  return <img src="/hero.png" alt="Hero banner" width={1200} height={600} />;
}
