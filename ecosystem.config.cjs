module.exports = {
  apps: [
    {
      name: "film-company",
      cwd: "/home/honeycake/project/film-company",
      script: "server/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
