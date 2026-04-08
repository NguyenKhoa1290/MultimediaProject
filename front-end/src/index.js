import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createStore } from 'redux'; //get createStore method so we can make a redux store
import { Provider } from 'react-redux'; //get the Provider component to wrap around our whole app
import rootReducer from './redux-elements/reducers/rootReducer';
import axios from 'axios';

axios.defaults.withCredentials = true;

const theStore = createStore(rootReducer);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={theStore}>
    <App />
  </Provider>
);
