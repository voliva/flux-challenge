import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './app/App';
import './index.css';
import registerServiceWorker from './registerServiceWorker';
import './styles.css';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import { rootReducer, rootEpic } from './redux';
import { createEpicMiddleware } from 'redux-observable';

const epicMiddleWare = createEpicMiddleware();
const store = createStore(
  rootReducer,
  applyMiddleware(epicMiddleWare)
);
epicMiddleWare.run(rootEpic);

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root') as HTMLElement
);
registerServiceWorker();
