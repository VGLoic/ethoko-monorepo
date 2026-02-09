import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

import "./type-extension.js";

const plugin = {
  id: "hardhat-soko",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
  },
  tasks: [
    task("pull", "Pull one or many artifacts of a project.")
      .setDescription(
        `Pull one or many artifacts of a project.

By default, the project is the one configured in the Hardhat configuration.

One artifact can be pulled by tag
  npx hardhat soko pull --tag v1.2.3
or by ID
  npx hardhat soko pull --id dcauXtavGLxC

All artifacts for a project can be downloaded
  npx hardhat soko pull

A different project can be specified
  npx hardhat soko pull --project another-project

Already downloaded artifacts are not downloaded again by default, enable the force flag to force the download.


`,
      )
      .addOption({
        name: "id",
        description:
          "The ID of the artifact to pull, can not be used with the `tag` parameter",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "tag",
        description:
          "The tag of the artifact to pull, can not be used with the `id` parameter",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "project",
        description:
          "The project to pull the artifacts from, defaults to the configured project",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addFlag({
        name: "force",
        description:
          "Force the pull of the artifacts, replacing previously downloaded ones",
      })
      .addFlag({
        name: "debug",
        description: "Enable debug mode",
      })
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Type is not correctly inferred for unknown reasons
      .setAction(() => import("./tasks/pull.js"))
      .build(),
  ],
};

export default plugin;
