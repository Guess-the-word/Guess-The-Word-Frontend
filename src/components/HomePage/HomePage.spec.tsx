import { render } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";

const renderHomePage = () => {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <HomePage />
    </MemoryRouter>
  );
};

describe("The HomePage Suite", () => {
  it("should match the snapshot", () => {
    const { container } = renderHomePage();
    expect(container).toMatchSnapshot();
  });
});
