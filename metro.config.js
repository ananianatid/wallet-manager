const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's SDK 57 web worker imports its SQLite WASM binary.
config.resolver.assetExts.push("wasm");

module.exports = config;
