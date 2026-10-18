package sparkminds.librarymanagement.book.cover;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.config.CloudinaryProperties;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class CloudinaryBookCoverStorage implements BookCoverStorage {
    private final Cloudinary cloudinary;
    private final CloudinaryProperties properties;

    /**
     * Upload bằng mã UUID do server sinh, không dùng filename hoặc URL do client cung cấp.
     * asset_folder quyết định vị trí trong Media Library ở chế độ Dynamic Folders;
     * prefix trong public_id chỉ giữ đường dẫn URL có cấu trúc, không tự chuyển ảnh vào folder.
     * Nếu kết quả không chắc chắn (ví dụ timeout), thử dọn bằng mã đã biết để hạn chế ảnh mồ côi.
     */
    @Override
    public UploadedBookCover upload(byte[] content) {
        if (!StringUtils.hasText(properties.getCloudName()) || !StringUtils.hasText(properties.getApiKey())
                || !StringUtils.hasText(properties.getApiSecret())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "BOOK_COVER_STORAGE_UNAVAILABLE",
                    "Dịch vụ lưu ảnh bìa chưa được cấu hình");
        }
        String folder = properties.getBookCoverFolder().replaceAll("^/+|/+$", "");
        String publicId = (folder.isBlank() ? "" : folder + "/") + UUID.randomUUID();
        try {
            Map<?, ?> result = cloudinary.uploader().upload(content, ObjectUtils.asMap(
                    "public_id", publicId, "asset_folder", folder, "resource_type", "image", "overwrite", false,
                    "allowed_formats", List.of("jpg", "png")));
            Object secureUrl = result.get("secure_url");
            if (!(secureUrl instanceof String url) || !url.startsWith("https://") || url.length() > 2048
                    || !publicId.equals(result.get("public_id"))) {
                throw new IllegalStateException("Invalid image storage response");
            }
            return new UploadedBookCover(url, publicId);
        } catch (IOException | RuntimeException exception) {
            try {
                delete(publicId);
            } catch (RuntimeException cleanupFailure) {
                log.warn("book-cover cleanup-failed exceptionType={}", cleanupFailure.getClass().getSimpleName());
            }
            log.warn("book-cover upload-failed exceptionType={}", exception.getClass().getSimpleName());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "BOOK_COVER_UPLOAD_FAILED",
                    "Không thể tải ảnh bìa lên, vui lòng thử lại");
        }
    }

    @Override
    public void delete(String publicId) {
        try {
            Map<?, ?> result = cloudinary.uploader().destroy(publicId,
                    ObjectUtils.asMap("resource_type", "image", "invalidate", true));
            if (!List.of("ok", "not found").contains(result.get("result"))) {
                throw new IllegalStateException("Image deletion was not confirmed");
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Image deletion failed", exception);
        }
    }
}
