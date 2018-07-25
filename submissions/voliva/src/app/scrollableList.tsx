import * as React from "react";
import SithList from "./sithList";
import { connect } from "react-redux";
import { scrollUp, scrollDown, hasMoreMasters, hasMoreApprentices, ApplicationState, darkJediFound } from "../redux";
import * as classnames from 'classnames';

interface Props {
    onScrollUp: () => void;
    onScrollDown: () => void;
    upDisabled: boolean;
    downDisabled: boolean;
}
const ScrollableList = ({onScrollUp, onScrollDown, upDisabled, downDisabled}: Props) => <section className="css-scrollable-list">
    <SithList />

    <div className="css-scroll-buttons">
        <button className={classnames("css-button-up", {
            "css-button-disabled": upDisabled
        })} onClick={onScrollUp} disabled={upDisabled} />
        <button className={classnames("css-button-down", {
            "css-button-disabled": downDisabled
        })} onClick={onScrollDown} disabled={downDisabled} />
    </div>
</section>

export default connect((state: ApplicationState) => ({
    upDisabled: !hasMoreMasters(state) || darkJediFound(state),
    downDisabled: !hasMoreApprentices(state) || darkJediFound(state)
}), {
    onScrollUp: scrollUp,
    onScrollDown: scrollDown
})(ScrollableList);
