import { defineConfig } from "react-doctor/api";

export default defineConfig({
  ignore: {
    // Exclude everything under public/ except ecad-viewer.js, which is
    // maintained code vendored from our ecad-viewer fork.
    files: ["public/!(ecad-viewer.js)", "public/*/**"],
  },
});
