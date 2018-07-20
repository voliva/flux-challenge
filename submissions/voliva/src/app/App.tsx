import * as React from 'react';
import PlanetMonitor from './planetMonitor';
import ScrollableList from './scrollableList';

class App extends React.Component {
  public render() {
    return (
      <div className="app-container">
        <div className="css-root">
          <PlanetMonitor />
          <ScrollableList />
        </div>
      </div>
    );
  }
}

export default App;
