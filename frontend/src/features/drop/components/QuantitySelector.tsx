import { clampQuantity } from "../lib/dropPageLogic.js";

type QuantitySelectorProps = {
  quantity: number;
  maxAvailable: number;
  disabled: boolean;
  onChange: (quantity: number) => void;
};

export function QuantitySelector({
  quantity,
  maxAvailable,
  disabled,
  onChange,
}: QuantitySelectorProps) {
  const max = Math.max(0, maxAvailable);
  const canPick = max > 0 && !disabled;

  function updateQuantity(next: number): void {
    onChange(clampQuantity(next, max));
  }

  return (
    <label className="quantity-field">
      Quantity
      <div className="quantity-controls">
        <button
          type="button"
          className="secondary quantity-step"
          aria-label="Decrease quantity"
          disabled={!canPick || quantity <= 1}
          onClick={() => updateQuantity(quantity - 1)}
        >
          −
        </button>
        <input
          type="number"
          className="quantity-input"
          min={1}
          max={max > 0 ? max : 1}
          value={quantity}
          disabled={!canPick}
          onChange={(event) => updateQuantity(Number(event.target.value))}
        />
        <button
          type="button"
          className="secondary quantity-step"
          aria-label="Increase quantity"
          disabled={!canPick || quantity >= max}
          onClick={() => updateQuantity(quantity + 1)}
        >
          +
        </button>
      </div>
      <span className="muted">
        {max > 0 ? `Up to ${max} available` : "None available"}
      </span>
    </label>
  );
}
