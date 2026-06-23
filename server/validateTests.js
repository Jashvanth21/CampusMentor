const fs = require('fs');

// Read and evaluate the data
let CODING_TESTS_DATA_PART_1;
try {
  const code = fs.readFileSync('./scripts/seedCodingTests.js', 'utf8');
  // Extract just the data array
  const dataMatch = code.match(/const CODING_TESTS_DATA_PART_1 = ([\s\S]*?\]\);/);
  if (dataMatch) {
    eval('CODING_TESTS_DATA_PART_1 = ' + dataMatch[1].slice(0, -2)); // Remove the );
  }
} catch (e) {
  console.error('Error loading file:', e.message);
  process.exit(1);
}

// Validate each test
CODING_TESTS_DATA_PART_1.forEach((test, testIdx) => {
  console.log(`\nTest ${testIdx + 1}: ${test.title}`);
  test.questions.forEach((q, qIdx) => {
    console.log(`  Q${qIdx}: ${q.questionText}`);
    if (!q.testCases || q.testCases.length === 0) {
      console.log(`    ERROR: No testCases!`);
    }
    q.testCases.forEach((tc, tcIdx) => {
      const hasInput = 'input' in tc && tc.input !== null && tc.input !== undefined;
      const hasOutput = 'expectedOutput' in tc && tc.expectedOutput !== null && tc.expectedOutput !== undefined;
      if (!hasInput || !hasOutput) {
        console.log(`    ERROR in TC${tcIdx}: input=${hasInput}, output=${hasOutput}`);
        console.log(`      Object: ${JSON.stringify(tc)}`);
      }
    });
  });
});
