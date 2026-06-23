const mongoose = require("mongoose");

// Mock the requirement to avoid circular dependency
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === "../models/MockTest") {
    return class MockTest {};
  }
  return originalRequire.apply(this, arguments);
};

// Read file directly
const fs = require("fs");
const content = fs.readFileSync("./scripts/seedCodingTests.js", "utf8");

// Extract just the data part
const match = content.match(/const CODING_TESTS_DATA_PART_1[\s\S]*?];/);
if (!match) {
  console.log("Could not find CODING_TESTS_DATA_PART_1");
  process.exit(1);
}

// Wrap in a variable and eval
const dataCode = "const CODING_TESTS_DATA_PART_1 = " + match[0].replace(/const CODING_TESTS_DATA_PART_1 = /, "") + ";";

try {
  eval(dataCode);
  
  // Check each test
  CODING_TESTS_DATA_PART_1.forEach((test, testIndex) => {
    console.log(`\nTest ${testIndex + 1}: ${test.title}`);
    
    test.questions.forEach((q, qIndex) => {
      console.log(`  Q${qIndex + 1}: ${q.questionText}`);
      console.log(`    TestCases: ${q.testCases.length}`);
      
      q.testCases.forEach((tc, tcIndex) => {
        const hasInput = 'input' in tc;
        const hasOutput = 'expectedOutput' in tc;
        console.log(`      TC${tcIndex}: input=${hasInput}, output=${hasOutput}`);
        
        if (!hasInput || !hasOutput) {
          console.log(`        ^^^ INCOMPLETE: ${JSON.stringify(tc)}`);
        }
      });
    });
  });
  
} catch (e) {
  console.error("Error parsing:", e.message);
  console.error(e);
}
