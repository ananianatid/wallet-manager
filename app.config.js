const appJson = require("./app.json");

module.exports = ({ config }) => {
  const source = config ?? appJson;
  const sentryOrganization = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;
  const sentryPlugin =
    sentryOrganization && sentryProject
      ? [
          "@sentry/react-native/expo",
          {
            url: "https://sentry.io/",
            organization: sentryOrganization,
            project: sentryProject,
          },
        ]
      : null;

  return {
    ...source,
    extra: {
      ...(source.extra ?? {}),
      buildTimestamp: process.env.APP_BUILD_TIMESTAMP ?? "dev",
    },
    plugins: [
      ...(source.plugins ?? []),
      ...(sentryPlugin ? [sentryPlugin] : []),
    ],
  };
};
