import { useCallback, useEffect, useState } from "react";
import { fetchProductAvailability } from "../../../api/productsApi.js";
import { appConfig } from "../../../config/env.js";
import { parseApiError } from "../../../lib/parseApiError.js";
import type { ProductAvailability } from "../../../types/api.types.js";

type StockPollingState = {
  availability: ProductAvailability | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useStockPolling(productId: string | null): StockPollingState {
  const [availability, setAvailability] = useState<ProductAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!productId) {
      return;
    }

    try {
      const next = await fetchProductAvailability(productId);
      setAvailability(next);
      setError(null);
    } catch (caught) {
      setError(parseApiError(caught).message);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      return;
    }

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, appConfig.stockPollMs);

    return () => window.clearInterval(intervalId);
  }, [productId, refresh]);

  return { availability, isLoading, error, refresh };
}
