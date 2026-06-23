const axios = require("axios");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const LANGUAGE_MAP = {
  java: 62,
  python: 71,
  cpp: 54,
  cplusplus: 54,
  javascript: 63
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getJudge0Config = () => {
  const baseUrl = process.env.JUDGE0_API_URL;

  if (!baseUrl) {
    throw createError("JUDGE0_API_URL is not configured.", 500);
  }

  const headers = {
    "Content-Type": "application/json"
  };

  return { baseUrl, headers };
};

const resolveLanguageId = (language) => {
  const asNumber = Number(language);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber;
  }

  const key = String(language || "").trim().toLowerCase();
  const mapped = LANGUAGE_MAP[key];
  if (mapped) {
    return mapped;
  }

  throw createError("A valid Judge0 language id is required for coding evaluation.", 400);
};

const submitCode = async (sourceCode, languageId, stdin) => {
  if (!sourceCode || !languageId) {
    throw createError("sourceCode and languageId are required for coding evaluation.", 400);
  }

  const { baseUrl, headers } = getJudge0Config();
  const resolvedLanguageId = resolveLanguageId(languageId);
  const judge0 = axios.create({
    baseURL: baseUrl,
    headers,
    timeout: 30000
  });

  let createPayload;
  try {
    const createResponse = await judge0.post("/submissions?base64_encoded=false&wait=true", {
      source_code: sourceCode,
      language_id: resolvedLanguageId,
      stdin: stdin || ""
    });
    createPayload = createResponse.data;
  } catch (error) {
    const upstreamMessage = error?.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    throw createError(`Judge0 submission failed: ${upstreamMessage}`, 502);
  }

  const statusId = createPayload?.status?.id;
  if (statusId && statusId <= 2) {
    await sleep(500);
  }

  return {
    stdout: createPayload.stdout || "",
    stderr: createPayload.stderr || "",
    compile_output: createPayload.compile_output || "",
    status: createPayload.status || { id: 0, description: "Unknown" }
  };
};

module.exports = {
  submitCode
};
