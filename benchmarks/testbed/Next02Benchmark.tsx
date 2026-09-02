// Defect: FIGM-NEXT-02
// See Next01Benchmark.tsx for why the next/link import is present -- it's the NEXT_JS
// classification signal, unrelated to the actual defect below.
import Link from 'next/link';
import MonacoEditor from 'monaco-editor';

export default function Page() {
  return (
    <div>
      <Link href="/editor">Editor</Link>
      <MonacoEditor />
    </div>
  );
}
