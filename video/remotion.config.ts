/**
 * Remotion CLI config. Node API renders (scripts/) pass options directly.
 * All config options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
// Public dir holds synced clips, audio and screenshots (see scripts/sync-assets.ts).
Config.setPublicDir("./public");
