// lighthouserc.cjs
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview",
      startServerReadyPattern: "Local:", // vite preview prints "  ➜  Local: http://localhost:4173"
      startServerReadyTimeout: 120000,
      numberOfRuns: 5,
      url: [
        "http://localhost:4173/", // Home
        "http://localhost:4173/publishride",
        "http://localhost:4173/results",
        "http://localhost:4173/profile",
        "http://localhost:4173/complete-profile",
        "http://localhost:4173/login",
        "http://localhost:4173/register",
        "http://localhost:4173/ourmission",
        "http://localhost:4173/all-rides",
        "http://localhost:4173/Termsofuse",
        "http://localhost:4173/privacy",
      ],
    },
    assert: { preset: "lighthouse:recommended" },
    upload: { target: "temporary-public-storage" },
  },
};
// module.exports = {
//   ci: {
//     collect: {
//       startServerCommand: "npm run preview",
//       startServerReadyPattern: "Local:", // vite preview prints "  ➜  Local: http://localhost:4173"
//       startServerReadyTimeout: 120000,
//       numberOfRuns: 5,
//       url: [
//         "http://localhost:4173/", // Home
//         "http://localhost:4173/publishride",
//         "http://localhost:4173/results",
//         "http://localhost:4173/profile",
//         "http://localhost:4173/complete-profile",
//         "http://localhost:4173/login",
//         "http://localhost:4173/register",
//         "http://localhost:4173/ourmission",
//         "http://localhost:4173/all-rides",
//         "http://localhost:4173/Termsofuse",
//         "http://localhost:4173/privacy",
//       ],
//     },
//     assert: {
//       preset: "lighthouse:recommended",
//       assertions: {
//         // So local preview cache headers don't fail the run
//         "uses-long-cache-ttl": "warn",
//         "cache-insight": "warn",

//         // Be a bit forgiving while iterating
//         "first-contentful-paint": ["warn", { "minScore": 0.8 }],
//         "render-blocking-resources": ["warn", { "maxLength": 1 }],
//         "render-blocking-insight": "warn",
//       }
//     },
//     upload: { target: "temporary-public-storage" }
//   }
// };
