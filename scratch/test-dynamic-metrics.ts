import { RuleExecutionEngine } from '../src/engine/rule-execution-engine';

const simpleCode = `export default function Simple() { return <div>Hello</div>; }`;

const complexCode = `
export default function Complex({ items }) {
  if (!items) return null;
  const result = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].active) {
      if (items[i].type === 'A') {
        result.push(items[i].value * 2);
      } else if (items[i].type === 'B') {
        result.push(items[i].value * 3);
      } else {
        switch(items[i].status) {
          case 'PENDING':
            result.push(1);
            break;
          case 'APPROVED':
            result.push(2);
            break;
          default:
            result.push(0);
        }
      }
    }
  }
  return <div>{result.join(',')}</div>;
}
`;

console.log('=== TEST 1: SIMPLE CODE METRICS ===');
const res1 = RuleExecutionEngine.analyzeFile('Simple.tsx', simpleCode);
console.log('Complexity Rating:', res1.complexity.complexityRating);
console.log('Cyclomatic Complexity:', res1.complexity.cyclomaticComplexity);
console.log('Execution Time (ms):', res1.profile.executionTimeMs);
console.log('Memory (MB):', res1.profile.peakMemoryMb);

console.log('\n=== TEST 2: COMPLEX CODE METRICS ===');
const res2 = RuleExecutionEngine.analyzeFile('Complex.tsx', complexCode);
console.log('Complexity Rating:', res2.complexity.complexityRating);
console.log('Cyclomatic Complexity:', res2.complexity.cyclomaticComplexity);
console.log('Execution Time (ms):', res2.profile.executionTimeMs);
console.log('Memory (MB):', res2.profile.peakMemoryMb);
