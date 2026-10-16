// Entry point of the Prism design-bundle contracts: one import per contract
// file, in alphabetical order. build.mjs fails when a file in this directory
// is not reachable from here.
import "@typespec/json-schema";
import "./common.tsp";
import "./board-objects-a0.tsp";
import "./bundle-manifest-a2.tsp";
import "./cli-a0.tsp";
import "./compare-a0.tsp";
import "./occurrences-a0.tsp";
import "./placements-a0.tsp";
import "./project-a0.tsp";
import "./revision-key-a1.tsp";
import "./route-metrics-a0.tsp";
import "./semantic-index-a1.tsp";
import "./stackup-a0.tsp";
import "./system-interface-v1.tsp";
