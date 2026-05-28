import { useCallback, useEffect, useState } from "react";
import { fetchFirstProduct, fetchProduct } from "../api/productsApi.js";
import { createReservation, fetchActiveReservation } from "../api/reservationsApi.js";
import { clientConfig } from "../config.js";
import { parseApiError } from "../lib/parseApiError.js";
import type { Product, Reservation } from "../types/api.types.js";
import { useCountdown } from "./useCountdown.js";
import { useStockPolling } from "./useStockPolling.js";

type DropPageState = {
  product: Product | null;
  productError: string | null;
  availability: ReturnType<typeof useStockPolling>["availability"];
  stockError: string | null;
  isStockLoading: boolean;
  activeReservation: Reservation | null;
  expiresAt: string | null;
  countdown: ReturnType<typeof useCountdown>;
  isReserving: boolean;
  reserveError: string | null;
  reserveMessage: string | null;
  isSoldOut: boolean;
  canReserve: boolean;
  reserve: () => Promise<void>;
  refreshReservation: () => Promise<void>;
};

function resolveProductIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("productId") ?? clientConfig.defaultProductId;
}

export function useDropPage(isAuthenticated: boolean): DropPageState {
  const [productId, setProductId] = useState(resolveProductIdFromUrl);
  const [product, setProduct] = useState<Product | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserveMessage, setReserveMessage] = useState<string | null>(null);

  const { availability, isLoading: isStockLoading, error: stockError, refresh: refreshStock } =
    useStockPolling(productId || null);

  const countdown = useCountdown(expiresAt);
  const isSoldOut = availability?.soldOut ?? false;

  useEffect(() => {
    let cancelled = false;

    async function loadProduct(): Promise<void> {
      try {
        let resolvedId = productId;
        if (!resolvedId) {
          const first = await fetchFirstProduct();
          if (!first) {
            setProductError("No products available for this drop.");
            return;
          }
          resolvedId = first.productId;
          setProductId(resolvedId);
        }

        const loaded = await fetchProduct(resolvedId);
        if (!cancelled) {
          setProduct(loaded);
          setProductError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setProductError(parseApiError(caught).message);
        }
      }
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const refreshReservation = useCallback(async () => {
    if (!isAuthenticated || !productId) {
      setActiveReservation(null);
      setExpiresAt(null);
      return;
    }

    try {
      const pending = await fetchActiveReservation(productId);
      setActiveReservation(pending);
      setExpiresAt(pending?.expiresAt ?? null);
    } catch {
      setActiveReservation(null);
      setExpiresAt(null);
    }
  }, [isAuthenticated, productId]);

  useEffect(() => {
    void refreshReservation();
  }, [refreshReservation]);

  useEffect(() => {
    if (countdown.isExpired && activeReservation) {
      setReserveMessage("Your reservation has expired.");
      setActiveReservation(null);
      setExpiresAt(null);
      void refreshStock();
    }
  }, [countdown.isExpired, activeReservation, refreshStock]);

  const hasActiveReservation = activeReservation !== null && !countdown.isExpired;

  const canReserve =
    isAuthenticated &&
    !isReserving &&
    !hasActiveReservation &&
    !isSoldOut &&
    product !== null;

  const reserve = useCallback(async () => {
    if (!product || !canReserve) {
      return;
    }

    setIsReserving(true);
    setReserveError(null);
    setReserveMessage(null);

    try {
      const response = await createReservation(product.productId, 1);
      setExpiresAt(response.expiresAt);
      setReserveMessage("Reserved! Complete checkout before the timer ends.");
      await refreshReservation();
      await refreshStock();
    } catch (caught) {
      const parsed = parseApiError(caught);
      if (parsed.statusCode === 409) {
        setReserveError("Sold out or race lost — someone else got the last units.");
      } else if (parsed.statusCode === 410) {
        setReserveError("Reservation expired.");
      } else {
        setReserveError(parsed.message);
      }
      await refreshStock();
    } finally {
      setIsReserving(false);
    }
  }, [product, canReserve, refreshReservation, refreshStock]);

  return {
    product,
    productError,
    availability,
    stockError,
    isStockLoading,
    activeReservation,
    expiresAt,
    countdown,
    isReserving,
    reserveError,
    reserveMessage,
    isSoldOut,
    canReserve,
    reserve,
    refreshReservation,
  };
}
