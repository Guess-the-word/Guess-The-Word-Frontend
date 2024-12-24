/**
 * File: /src/App.tsx
 */
import React from "react";
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./components/HomePage/HomePage";
import { GamePage } from "./components/GamePage/GamePage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:roomName" element={<GamePage />} />
    </Routes>
  );
};

export default App;
