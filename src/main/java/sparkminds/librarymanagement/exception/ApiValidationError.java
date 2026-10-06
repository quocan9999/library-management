package sparkminds.librarymanagement.exception;

public record ApiValidationError(String field, String message) {
}
