// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const packagesRoot = path.resolve(workspaceRoot, 'packages');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits to packages/* trigger a reload.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

/**
 * @zamindara/units and @zamindara/geo are consumed as TypeScript source, and
 * their internal imports carry the `.js` extension that native ESM requires
 * (`./constants.js` resolving to `constants.ts`). Metro does not do that
 * rewrite on its own, so we do it here.
 *
 * Deliberately scoped to files inside packages/ — rewriting extensions
 * globally would break genuine `.js` imports elsewhere in node_modules.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath ?? '';
  const isOurs = origin.startsWith(packagesRoot);

  if (isOurs && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    return context.resolveRequest(context, moduleName.slice(0, -3), platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
