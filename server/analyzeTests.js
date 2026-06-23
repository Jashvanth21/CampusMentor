const fs = require('fs');
const content = fs.readFileSync('./scripts/seedCodingTests.js', 'utf8');

const tests = [];
let match;
const testRegex = /title: "Coding Test (\d+) - Easy Level"/g;
while ((match = testRegex.exec(content)) !== null) {
  tests.push({
    num: match[1],
    pos: match.index
  });
}

// Also find medium tests
const mediumTests = [];
const mediumRegex = /title: "Coding Test (\d+) - Medium Level"/g;
while ((match = mediumRegex.exec(content)) !== null) {
  mediumTests.push({
    num: match[1],
    pos: match.index
  });
}

console.log('Found Easy Tests:', tests.map(t => `Test ${t.num}`).join(', '));
console.log('Found Medium Tests:', mediumTests.map(t => `Test ${t.num}`).join(', '));

// Now check each test for question count
[...tests, ...mediumTests].forEach((test, idx) => {
  let testContent;
  const nextTest = [...tests, ...mediumTests][idx + 1];
  const endPos = nextTest ? nextTest.pos : content.length;
  testContent = content.substring(test.pos, endPos);
  
  const qMatches = testContent.match(/questionText:/g);
  const tcMatches = testContent.match(/testCases:/g);
  
  console.log(`Test ${test.num}: ${qMatches ? qMatches.length : 0} questions, ${tcMatches ? tcMatches.length : 0} testCase arrays`);
});
