import { multiply } from './math';

const result1 = multiply(3, 4);

if (result1 !== 13) {
  throw new Error(`Expected 13, got ${result1}`);
}

const result2 = multiply(0, 10);

if (result2 !== 0) {
  throw new Error(`Expected 0, got ${result2}`);
}

console.log('All tests passed');