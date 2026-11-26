import type { HostPortMaps, HostPorts } from "../ports/host-ports.js";
import { reachableActivator } from "./reachable-activator.js";

/** The host ports answered from the maps composition wires. */
export function hostPortsOver(maps: HostPortMaps): HostPorts {
  return {
    activator: (binary) => maps.activators.get(binary),
    reachableActivator: (binary) => reachableActivator(maps.activators, binary),
    pluginRegistry: (tool) => maps.pluginRegistries.get(tool),
    marketplaceRegistry: (tool) => maps.marketplaceRegistries.get(tool),
    sources: (tool) => maps.sources.get(tool),
  };
}
