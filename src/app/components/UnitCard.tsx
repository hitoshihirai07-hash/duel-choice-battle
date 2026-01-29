import React from "react";
import type { UnitDef } from "../../engine/types";

export default function UnitCard(props: {
  unit: UnitDef;
  selected?: boolean;
  onClick?: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className={"card"} style={{ outline: props.selected ? "2px solid #111" : "none" }}>
      <div className="kv">
        <div className="h2" style={{ margin: 0 }}>
          {props.unit.name}
        </div>
        <span className="pill">HP {props.unit.baseStats.hp}</span>
        <span className="pill">攻 {props.unit.baseStats.atk}</span>
        <span className="pill">防 {props.unit.baseStats.def}</span>
        <span className="pill">早 {props.unit.baseStats.spd}</span>
      </div>
      <div className="hr" />
      <button className="btn" onClick={props.onClick} disabled={!props.onClick}>
        {props.selected ? "選択中" : "選ぶ"}
      </button>
      {props.footer ? (
        <>
          <div className="hr" />
          {props.footer}
        </>
      ) : null}
    </div>
  );
}
