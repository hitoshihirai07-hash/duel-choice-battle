import React from "react";
import type { SkillDef } from "../../engine/types";

export default function SkillSlot(props: {
  slotIndex: number;
  skill: SkillDef | null;
  options: SkillDef[];
  onChange: (skillId: string) => void;
}) {
  return (
    <div className="card">
      <div className="kv">
        <span className="badge">枠 {props.slotIndex + 1}</span>
        <span className="pill">{props.skill?.name ?? "未設定"}</span>
      </div>
      <div className="hr" />
      <select
        className="btn"
        style={{ width: "100%" }}
        value={props.skill?.id ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="" disabled>
          えらぶ…
        </option>
        {props.options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}（{s.type}）
          </option>
        ))}
      </select>
    </div>
  );
}
