import * as React from "react";

const SithItem = ({name, homeWorld}: {name: string, homeWorld: string}) => <li className="css-slot">
    <h3>{name}</h3>
    <h6>Homeworld: {homeWorld}</h6>
</li>

export default SithItem;