const { generateText } = require("../services/llmService");

const explainAnswer = async (req, res) => {
  const {
    question,
    correctAnswer,
    questionType,
    description,
    constraints,
    language
  } = req.body || {};

  const isCodingQuestion = String(questionType || "").toLowerCase() === "coding";
  const prompt = isCodingQuestion
    ? `
You are an expert programming tutor.

Problem:
${description || question || "Not provided"}

Constraints:
${constraints || "Not provided"}

Sample Input:
${req.body?.sampleInput || "Not provided"}

Sample Output:
${req.body?.sampleOutput || "Not provided"}

Task:
- Generate the MOST OPTIMAL solution.
- Use ${language || "Python"} as the programming language.
- Ensure the code passes all edge cases.
- Follow best time and space complexity.
- Do NOT explain anything.
- Do NOT include comments.
- Output ONLY clean code.
`.trim()
    : `
You are an expert tutor.

Explain the correct answer in ONE short paragraph.

Question: ${question || "Not provided"}
Correct Answer: ${correctAnswer || "Not provided"}

RULES:
- Output ONLY plain text
- No markdown
- No headings
- No symbols (*, #, etc.)
- Maximum 2–3 sentences
- Do NOT mention student answer
- Do NOT compare with wrong options
- Do NOT add labels like "Explanation:"
- Keep it simple and clear

If you break any rule, the answer is incorrect.

Return only the explanation text.
`.trim();

  try {
    const aiResponse = await generateText(prompt, {
      maxTokens: isCodingQuestion ? 400 : 120,
      temperature: 0.2
    });

    let content = String(aiResponse || "").trim();

    if (isCodingQuestion) {
      content = content.replace(/^```[a-zA-Z]*\s*/i, "").replace(/```$/i, "").trim();
    } else {
      content = content
        .replace(/[*#`]/g, "")
        .replace(/Explanation:/gi, "")
        .trim();
    }

    return res.status(200).json({
      type: isCodingQuestion ? "code" : "explanation",
      explanation: content || "Explanation unavailable. Please try again."
    });
  } catch (error) {
    return res.status(200).json({
      type: isCodingQuestion ? "code" : "explanation",
      explanation: "Explanation unavailable. Please try again."
    });
  }
};

module.exports = {
  explainAnswer
};
