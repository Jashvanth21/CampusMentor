const LANGUAGE_OPTIONS = [
  { label: "Python 3", judge0Id: 71, monacoLanguage: "python" },
  { label: "C++17", judge0Id: 54, monacoLanguage: "cpp" },
  { label: "Java", judge0Id: 62, monacoLanguage: "java" },
  { label: "JavaScript", judge0Id: 63, monacoLanguage: "javascript" }
];

const LanguageSelector = ({ value, onChange, disabled = false }) => {
  return (
    <label className="editor-field">
      <span>Language</span>
      <select
        id="coding-language-selector"
        className="auth-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.judge0Id} value={option.judge0Id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export const getLanguageMeta = (judge0Id) =>
  LANGUAGE_OPTIONS.find((item) => item.judge0Id === Number(judge0Id)) || LANGUAGE_OPTIONS[0];

export const getStarterCodeByLanguage = (judge0Id) => {
  const id = Number(judge0Id);

  if (id === 54) {
    return `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Write your solution
    return 0;
}`;
  }

  if (id === 62) {
    return `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // Write your solution
    }
}`;
  }

  if (id === 63) {
    return `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();

// Write your solution
console.log(input);`;
  }

  return `# Write your solution
def solve():
    pass

if __name__ == "__main__":
    solve()`;
};

export default LanguageSelector;
