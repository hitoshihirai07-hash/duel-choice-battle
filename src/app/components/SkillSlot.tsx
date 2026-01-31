import React from "react";
import type { SkillDef } from "../../engine/data";
import { ensureAudio, playSfx } from "../sound/sound";

export default function SkillSlot(props: {
  label: string;
  options: SkillDef[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="kv">
      <span className="muted" style={{ width: 96 }}>
        {props.label}
      </span>
      <select
        className="input"
        value={props.value}
        onChange={(e) => {
          void ensureAudio();
          playSfx("select");
          props.onChange(e.target.value);
        }}
      >
        {props.options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
