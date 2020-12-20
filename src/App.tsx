import React from "react";
import { HomePage } from "./components/HomePage/HomePage";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import RoomPage from "components/RoomPage/RoomPage";

const App = () => (
    <Router>
        <Switch>
            <Route exact path="/" component={HomePage} />
            <Route path="/room" component={RoomPage} />
        </Switch>
    </Router>
);

export default App;
