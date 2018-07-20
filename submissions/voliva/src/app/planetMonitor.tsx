import * as React from "react";
import { connect } from "react-redux";
import { planetName, ApplicationState } from "../redux";

/// Component
const PlanetMonitor = ({planetName}: {planetName: string}) => <h1 className="css-planet-monitor">Obi-Wan currently on {planetName}</h1>;

/// Container
export default connect((state: ApplicationState) => ({
    planetName: planetName(state)
}))(PlanetMonitor);
