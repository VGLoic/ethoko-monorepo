import { describe, test } from "vitest";
import { asyncExec } from "./async-exec";

const TAG_NAME = "2026-02-02";

describe("[Hardhat v3 - Hardhat-deploy v2] Push artifact, pull artifact, deploy", async () => {
    test("it compiles", () => asyncExec("npx hardhat compile --force --no-tests --config ./hardhat.config.e2e.ts"))

    test("it pushes the tag", () => asyncExec(`npx hardhat --config ./hardhat.config.e2e.ts ethoko push --tag ${TAG_NAME}`))

    test("it pulls the tag", () => asyncExec("npx hardhat --config ./hardhat.config.e2e.ts ethoko pull"));

    test("it generates the typings", () => asyncExec("npx hardhat --config ./hardhat.config.e2e.ts ethoko typings"));

    test("it checks types", () => asyncExec("pnpm check-types"));

    test("it deploys", () => asyncExec("npx hardhat --config ./hardhat.config.e2e.ts deploy"));
    
})
