export const BRANCH_OPTIONS = ["CSE", "IT", "ECE", "CSD"];
export const BRANCH_FILTER_OPTIONS = ["All", ...BRANCH_OPTIONS];

export const isSupportedBranch = (value) => BRANCH_OPTIONS.includes(String(value || "").trim().toUpperCase());

export const normalizeBranch = (value) => {
  const branch = String(value || "").trim().toUpperCase();
  return isSupportedBranch(branch) ? branch : "";
};

export const normalizeBranchList = (values) => {
  const list = Array.isArray(values)
    ? values
    : String(values || "")
        .split(",")
        .map((item) => item.trim());

  return Array.from(new Set(list.map(normalizeBranch).filter(Boolean)));
};
