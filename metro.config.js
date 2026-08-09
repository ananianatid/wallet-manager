const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// expo-sqlite's SDK 57 web worker imports its SQLite WASM binary.
config.resolver.assetExts.push("wasm");

module.exports = config;
