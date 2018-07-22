import * as React from "react";
import { connect } from "react-redux";
import { branch, compose } from "recompose";
import { ApplicationState, getSithByIndex } from "../redux";

interface SithItemProps {
    name: string,
    homeWorld: string
}

const SithItem = ({name, homeWorld}: SithItemProps) => <li className="css-slot">
    <h3>{name}</h3>
    <h6>Homeworld: {homeWorld}</h6>
</li>

const renderEmptySithItem = () => () => <li className="css-slot" />

export default compose<SithItemProps, {idx:number}>(
    connect((state: ApplicationState, ownProps: {idx: number}) => {
        const jedi = getSithByIndex(state, ownProps.idx);
        return {
            name: jedi && jedi.name,
            homeWorld: jedi && jedi.homeWorld
        }
    }),
    branch(
        ({name}: SithItemProps) => name == undefined,
        renderEmptySithItem
    ),
)(SithItem);
