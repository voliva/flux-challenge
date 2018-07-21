import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore } from 'redux';
import { composeWithDevTools } from 'redux-devtools-extension';
import { createEpicMiddleware } from 'redux-observable';
import App from './app/App';
import './index.css';
import { createRootReducer, rootEpic } from './redux';
import registerServiceWorker from './registerServiceWorker';
import './styles.css';

const epicMiddleWare = createEpicMiddleware();
const store = createStore(
  createRootReducer(),
  composeWithDevTools(
    applyMiddleware(epicMiddleWare)
  )
);
epicMiddleWare.run(rootEpic);

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root') as HTMLElement
);
registerServiceWorker();
