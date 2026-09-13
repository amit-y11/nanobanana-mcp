export default {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    "@semantic-release/npm",
    ["@semantic-release/git", {
      assets: ["package.json", "package-lock.json"],
      message: "chore(release): ${nextRelease.version} [skip ci]",
    }],
    ["@semantic-release/github", { successComment: false, failComment: false, failTitle: false, releasedLabels: false }],
  ],
};