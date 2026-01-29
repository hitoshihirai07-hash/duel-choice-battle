import type { BattleFormat } from "../../engine/types";

export type Screen =
  | { name: "title" }
  | { name: "mode" }
  | { name: "story" }
  | { name: "party"; format: BattleFormat; fromStory: boolean; battleId?: string }
  | { name: "battle"; battleId: string; format: BattleFormat; fromStory: boolean; nextStoryNodeId?: string }
  | { name: "result" }
  | { name: "training" };

export interface GlobalState {
  screen: Screen;
}

export const initialGlobalState: GlobalState = {
  screen: { name: "title" },
};
