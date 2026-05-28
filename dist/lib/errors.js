/**
 * Application error with HTTP status code and optional response details.
 * Throw this from services and middleware; the centralized handler formats the response.
 */
export class AppError extends Error {
    statusCode;
    details;
    constructor(message, statusCode, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = "AppError";
    }
}
export function getErrorStatusCode(err) {
    if (err instanceof AppError) {
        return err.statusCode;
    }
    if (typeof err === "object" &&
        err !== null &&
        "statusCode" in err &&
        typeof err.statusCode === "number") {
        return err.statusCode;
    }
    if (typeof err === "object" &&
        err !== null &&
        "status" in err &&
        typeof err.status === "number") {
        return err.status;
    }
    return 500;
}
export function getErrorMessage(err, isProduction) {
    const statusCode = getErrorStatusCode(err);
    if (statusCode >= 500 && isProduction) {
        return "Internal server error";
    }
    if (err instanceof Error) {
        return err.message;
    }
    return "Internal server error";
}
export function getErrorDetails(err) {
    if (err instanceof AppError && err.details) {
        return err.details;
    }
    return undefined;
}
export function buildErrorResponse(err, isProduction) {
    const body = {
        error: getErrorMessage(err, isProduction),
    };
    const details = getErrorDetails(err);
    if (details) {
        body.details = details;
    }
    return body;
}
