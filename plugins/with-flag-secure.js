const { withMainActivity } = require("expo/config-plugins");

const FLAG_SECURE_LINE =
  "window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)";

module.exports = function withFlagSecure(config) {
  return withMainActivity(config, (config) => {
    const { modResults } = config;
    if (!modResults.contents.includes(FLAG_SECURE_LINE)) {
      modResults.contents = modResults.contents.replace(
        "super.onCreate(null)",
        `super.onCreate(null)\n    ${FLAG_SECURE_LINE}`,
      );
    }
    return config;
  });
};
