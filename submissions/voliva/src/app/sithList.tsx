import * as React from "react";
import SithItem from "./sithItem";
import { ApplicationState, getJediWindowArray } from "../redux";
import { connect } from "react-redux";

const SithList = ({idxs}: {idxs: number[]}) => <ul className="css-slots">
    { idxs.map(idx => <SithItem key={idx} idx={idx} />) }
</ul>

export default connect((state: ApplicationState) => ({
    idxs: getJediWindowArray(state)
}))(SithList);
