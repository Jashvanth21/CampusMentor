const VALID_BRANCHES = ["CSE", "IT", "ECE", "CSD"];

const normalizeBranch = (value) => {
  const branch = String(value || "").trim().toUpperCase();
  return VALID_BRANCHES.includes(branch) ? branch : "";
};

const filterValidBranches = (values) => {
  const list = Array.isArray(values)
    ? values
    : String(values || "")
        .split(",")
        .map((item) => item.trim());

  return Array.from(new Set(list.map(normalizeBranch).filter(Boolean)));
};

module.exports = {
  VALID_BRANCHES,
  normalizeBranch,
  filterValidBranches
};
