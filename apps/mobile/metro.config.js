const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro sees shared packages and workspace changes
config.watchFolders = [monorepoRoot];

// Resolve modules from the app's own node_modules first, then fall back to the
// monorepo root node_modules (where yarn hoists shared dependencies)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = withNativeWind(config, {
  input: './global.css',
  configPath: './tailwind.config.js',
  inlineNativeRem: 16,
});
