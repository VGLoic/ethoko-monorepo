import type { ConfigHooks } from "hardhat/types/hooks";
import type { HookHandlerCategoryFactory } from "hardhat/types/plugins";
import { resolvePluginConfig, validatePluginConfig } from "../config.js";

const configHook: HookHandlerCategoryFactory<"config"> = async () => {
  const handlers: Partial<ConfigHooks> = {
    async validateUserConfig(userConfig) {
      return validatePluginConfig(userConfig);
    },
    async resolveUserConfig(userConfig, resolveConfigurationVariable, next) {
      const partiallyResolvedConfig = await next(
        userConfig,
        resolveConfigurationVariable,
      );

      return resolvePluginConfig(userConfig, partiallyResolvedConfig);
    },
  };

  return handlers;
};

export default configHook;
