import * as React from "react";
import SithList from "./sithList";
import { connect } from "react-redux";
import { scrollUp, scrollDown } from "../redux";

interface Props {
    onScrollUp: () => void;
    onScrollDown: () => void;
}
const ScrollableList = ({onScrollUp, onScrollDown}: Props) => <section className="css-scrollable-list">
    <SithList />

    <div className="css-scroll-buttons">
        <button className="css-button-up" onClick={onScrollUp} />
        <button className="css-button-down" onClick={onScrollDown} />
    </div>
</section>

export default connect(undefined, {
    onScrollUp: scrollUp,
    onScrollDown: scrollDown
})(ScrollableList);
