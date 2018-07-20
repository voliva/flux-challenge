import * as React from "react";
import SithList from "./sithList";

const ScrollableList = () => <section className="css-scrollable-list">
    <SithList />

    <div className="css-scroll-buttons">
        <button className="css-button-up" />
        <button className="css-button-down" />
    </div>
</section>

export default ScrollableList;
