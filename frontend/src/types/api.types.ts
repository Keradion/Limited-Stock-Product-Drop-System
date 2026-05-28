export type ApiErrorBody = {
  error: string;
  statusCode: number;
  details?: unknown;
};

export type Product = {
  productId: string;
  productName: string;
  productStock: number;
  createdAt: string;
};

export type ProductAvailability = {
  productId: string;
  available: number;
  productStock: number;
  soldOut: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type Reservation = {
  reservationId: string;
  reservationStatus: string;
  productId: string;
  quantity: number;
  expiresAt: string;
  createdAt: string;
};

export type ReserveResponse = {
  reservationId: string;
  expiresAt: string;
};

export type AuthResponse = {
  token: string;
};

export type CheckoutResponse = {
  orderId: string;
  reservationId: string;
  orderStatus: string;
};
