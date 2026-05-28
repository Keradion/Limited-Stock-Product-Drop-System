import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuantitySelector } from "./QuantitySelector.js";

afterEach(() => {
  cleanup();
});

describe("QuantitySelector", () => {
  it("increments and decrements within available stock", () => {
    const onChange = vi.fn();

    render(
      <QuantitySelector quantity={2} maxAvailable={5} disabled={false} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(onChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
