import { FOCAL_STATES, type LocationGroup } from "@/config/programme";

/** Always derived server-side from the state. Never trusted from the client. */
export function locationGroupFor(state: string): LocationGroup {
  return (FOCAL_STATES as readonly string[]).includes(state) ? "FOCAL_STATES" : "OTHER_STATES";
}
