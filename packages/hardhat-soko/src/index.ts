import { emptyTask, task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import type { HardhatPlugin } from "hardhat/types/plugins";

import "./type-extension.js";

const hardhatSoko: HardhatPlugin = {
  id: "hardhat-soko",
  hookHandlers: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: () => import("./hooks/config.js") as any,
  },
  tasks: [
    emptyTask("soko", "Soko plugin tasks").build(),
    task(["soko", "pull"], "Pull one or many artifacts of a project.")
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
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined,
      })
      .addOption({
        name: "project",
        description:
          "The project to pull the artifacts from, defaults to the configured project",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined,
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
      // @ts-ignore - Dynamic import type inference limitation with tsup
      .setAction(() => import("./tasks/pull.js"))
      .build(),
    task(["soko", "push"], "Push one or many artifacts of a project.")
      .addOption({
        name: "artifactPath",
        description: "The path of the compilation artifact to push",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined,
      })
      .addOption({
        name: "tag",
        description: "Tag to associate to the pushed artifact",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined,
      })
      .addFlag({
        name: "force",
        description:
          "Force the push of the artifact even if it already exists in the storage",
      })
      .addFlag({
        name: "debug",
        description: "Enable debug mode",
      })
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import type inference limitation with tsup
      .setAction(() => import("./tasks/push.js"))
      .build(),
    task(["soko", "typings"], "Generate typings based on the pulled artifacts.")
      .addFlag({
        name: "debug",
        description: "Enable debug mode",
      })
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import type inference limitation with tsup
      .setAction(() => import("./tasks/typings.js"))
      .build(),
    task(
      ["soko", "list"],
      "List the artifacts that have been pulled with their associated projects.",
    )
      .addFlag({
        name: "debug",
        description: "Enable debug mode",
      })
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import type inference limitation with tsup
      .setAction(() => import("./tasks/list.js"))
      .build(),
    task(
      ["soko", "diff"],
      "Compare a local compilation artifacts with an existing release.",
    )
      .addOption({
        name: "artifactPath",
        description: "The path of the compilation artifact to compare",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined,
      })
      .addOption({
        name: "id",
        description:
          "The ID of the artifact to compare with, can not be used with the `tag` parameter",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined,
      })
      .addOption({
        name: "tag",
        description:
          "The tag of the artifact to compare with, can not be used with the `id` parameter",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined,
      })
      .addFlag({
        name: "debug",
        description: "Enable debug mode",
      })
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import type inference limitation with tsup
      .setAction(() => import("./tasks/diff.js"))
      .build(),
  ],
};

export { hardhatSoko as default };
