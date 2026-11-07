import { defineRailway, github, project, service } from "railway/iac";

// This repo manages only its own service in the Railway environment.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "xrouter";

export default defineRailway(() => {
  const xrouter = service("xrouter", {
    source: github("bagasdevs/xrouter", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
    },
    deploy: {
      healthcheckPath: "/api/health",
      healthcheckTimeout: 120,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
      numReplicas: 1,
    },
  });

  return project("hearty-luck", {
    resources: [xrouter],
  });
});
