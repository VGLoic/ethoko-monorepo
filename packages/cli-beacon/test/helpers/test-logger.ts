import { DebugLogger } from "@/utils/debug-logger";

export class TestLogger implements DebugLogger {
  debug(message: string): void {
    console.debug(message);
  }
}
