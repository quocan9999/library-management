package sparkminds.librarymanagement.config.exception;

/**
 * Ngoại lệ ném ra khi hệ thống đang trong chế độ bảo trì và yêu cầu không được miễn trừ.
 */
public class MaintenanceModeException extends RuntimeException {

    public MaintenanceModeException(String message) {
        super(message);
    }
}
