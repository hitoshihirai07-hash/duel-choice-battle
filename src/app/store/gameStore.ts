import type { BattleFormat } from "../../engine/types";

export type Screen =
  | { name: "title" }
  | { name: "mode" }
  | { name: "daily" }
  | { name: "story" }
  | { name: "party"; format: BattleFormat; fromStory: boolean; battleId?: string; nextStoryNodeId?: string }
  | { name: "battle"; battleId: string; format: BattleFormat; fromStory: boolean; nextStoryNodeId?: string }
  | { name: "result" }
  | { name: "training"; returnTo: "mode" | "story" | "daily" };

export interface GlobalState {
  screen: Screen;
}

export const initialGlobalState: GlobalState = {
  screen: { name: "title" },
};
