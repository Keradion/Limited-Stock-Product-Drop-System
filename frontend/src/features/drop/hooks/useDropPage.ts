import { useCallback, useEffect, useState } from "react";
import { fetchFirstProduct, fetchProduct } from "../../../api/productsApi.js";
import { checkoutReservation } from "../../../api/checkoutApi.js";
import { createReservation, fetchActiveReservation } from "../../../api/reservationsApi.js";
import { appConfig } from "../../../config/env.js";
import {
  clampQuantity,
  computeCanCheckout,
  computeCanReserve,
  mapCheckoutErrorMessage,
  mapReserveErrorMessage,
} from "../lib/dropPageLogic.js";
import { parseApiError } from "../../../lib/parseApiError.js";
import type { CheckoutResponse, Product, Reservation } from "../../../types/api.types.js";
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
  quantity: number;
  maxReserveQuantity: number;
  setQuantity: (quantity: number) => void;
  canReserve: boolean;
  isCheckingOut: boolean;
  checkoutError: string | null;
  canCheckout: boolean;
  completedOrder: CheckoutResponse | null;
  lastCheckoutReservation: Reservation | null;
  reserve: () => Promise<void>;
  checkout: () => Promise<void>;
  refreshReservation: () => Promise<void>;
};

function resolveProductIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("productId") ?? appConfig.defaultProductId;
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
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<CheckoutResponse | null>(null);
  const [lastCheckoutReservation, setLastCheckoutReservation] = useState<Reservation | null>(
    null,
  );
  const [quantity, setQuantityState] = useState(1);

  const { availability, isLoading: isStockLoading, error: stockError, refresh: refreshStock } =
    useStockPolling(productId || null);

  const countdown = useCountdown(expiresAt);
  const isSoldOut = availability?.soldOut ?? false;
  const maxReserveQuantity = availability?.available ?? 0;

  const setQuantity = useCallback(
    (next: number) => {
      setQuantityState(clampQuantity(next, maxReserveQuantity));
    },
    [maxReserveQuantity],
  );

  useEffect(() => {
    setQuantityState((current) => clampQuantity(current, maxReserveQuantity));
  }, [maxReserveQuantity]);

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

  const hasActiveReservation =
    activeReservation !== null && !countdown.isExpired && completedOrder === null;

  const canReserve = computeCanReserve({
    isAuthenticated,
    isReserving,
    hasActiveReservation,
    isSoldOut,
    hasProduct: product !== null,
    quantity,
    maxAvailable: maxReserveQuantity,
  });

  const canCheckout = computeCanCheckout({
    hasActiveReservation: activeReservation !== null,
    isExpired: countdown.isExpired,
    isCheckingOut,
  });

  const checkout = useCallback(async () => {
    if (!activeReservation || !canCheckout) {
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const order = await checkoutReservation(activeReservation.reservationId);
      setLastCheckoutReservation(activeReservation);
      setCompletedOrder(order);
      setActiveReservation(null);
      setExpiresAt(null);
      setReserveMessage(null);
      await refreshStock();
    } catch (caught) {
      setCheckoutError(mapCheckoutErrorMessage(caught));
      await refreshReservation();
    } finally {
      setIsCheckingOut(false);
    }
  }, [activeReservation, canCheckout, refreshReservation, refreshStock]);

  const reserve = useCallback(async () => {
    if (!product || !canReserve) {
      return;
    }

    setIsReserving(true);
    setReserveError(null);
    setReserveMessage(null);
    setCheckoutError(null);
    setCompletedOrder(null);
    setLastCheckoutReservation(null);

    try {
      const response = await createReservation(product.productId, quantity);
      setExpiresAt(response.expiresAt);
      setReserveMessage(
        `Reserved ${quantity} item${quantity === 1 ? "" : "s"}! Complete checkout before the timer ends.`,
      );
      await refreshReservation();
      await refreshStock();
    } catch (caught) {
      setReserveError(mapReserveErrorMessage(caught));
      await refreshStock();
    } finally {
      setIsReserving(false);
    }
  }, [product, quantity, canReserve, refreshReservation, refreshStock]);

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
    quantity,
    maxReserveQuantity,
    setQuantity,
    canReserve,
    isCheckingOut,
    checkoutError,
    canCheckout,
    completedOrder,
    lastCheckoutReservation,
    reserve,
    checkout,
    refreshReservation,
  };
}
