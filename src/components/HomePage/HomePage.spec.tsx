import { render } from "@testing-library/react";
import React from "react";
import { HomePage } from "./HomePage";

const renderHomePage = () => {
  return render(<HomePage />);
};

describe("The HomePage Suite", () => {
  it("should match the snapshot", () => {
    const { container } = renderHomePage();
    expect(container).toMatchSnapshot();
  });
});
