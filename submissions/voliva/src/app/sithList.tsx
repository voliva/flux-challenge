import * as React from "react";
import SithItem from "./sithItem";

const SithList = () => <ul className="css-slots">
    <SithItem name={"Jorak Uln"} homeWorld={"Korriban"} />
    <SithItem name={"Skere Kaan"} homeWorld={"Coruscant"} />
    <SithItem name={"Na'daz"} homeWorld={"Ryloth"} />
    <SithItem name={"Kas'im"} homeWorld={"Nal Hutta"} />
    <SithItem name={"Darth Bane"} homeWorld={"Apatros"} />
</ul>

export default SithList;
