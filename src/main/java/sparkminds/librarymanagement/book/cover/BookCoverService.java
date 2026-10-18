package sparkminds.librarymanagement.book.cover;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookCoverService {
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final long MAX_PIXELS = 20_000_000;
    private final BookCoverStorage storage;

    /**
     * Kiểm tra dung lượng và giải mã ảnh thật trước khi gửi tới Cloudinary.
     * Không tin filename/MIME từ client; giới hạn số pixel trước khi giải mã để tránh ảnh nén gây quá tải RAM.
     *
     * @param file ảnh tùy chọn, null giữ nguyên luồng lưu sách không ảnh
     * @return ảnh đã upload hoặc null nếu không chọn ảnh
     */
    public UploadedBookCover uploadOptional(MultipartFile file) {
        if (file == null) return null;
        if (file.getSize() > MAX_BYTES) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "BOOK_COVER_TOO_LARGE", "Ảnh bìa không được vượt quá 5 MiB");
        }
        if (file.isEmpty()) throw invalidCover();
        byte[] content;
        try {
            content = file.getBytes();
            validateImage(content);
        } catch (IOException | IllegalArgumentException exception) {
            throw invalidCover();
        }
        return storage.upload(content);
    }

    private void validateImage(byte[] content) throws IOException {
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            if (stream == null) throw invalidCover();
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw invalidCover();
            ImageReader reader = readers.next();
            try {
                if (!Set.of("JPEG", "PNG").contains(reader.getFormatName().toUpperCase(java.util.Locale.ROOT))) throw invalidCover();
                reader.setInput(stream, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_PIXELS) throw invalidCover();
                if (reader.read(0) == null) throw invalidCover();
            } finally {
                reader.dispose();
            }
        }
    }

    /** Dọn ảnh theo best effort; lỗi nhà cung cấp không được che lỗi gốc hoặc làm sai trạng thái DB đã commit. */
    public void discard(String publicId) {
        if (publicId == null || publicId.isBlank()) return;
        try {
            storage.delete(publicId);
        } catch (RuntimeException exception) {
            log.warn("book-cover cleanup-failed exceptionType={}", exception.getClass().getSimpleName());
        }
    }

    private static FieldValidationException invalidCover() {
        return new FieldValidationException(HttpStatus.UNPROCESSABLE_ENTITY, "BOOK_COVER_INVALID", "Ảnh bìa không hợp lệ",
                Map.of("cover", "Chọn ảnh JPEG/PNG hợp lệ, tối đa 20 triệu pixel và không quá 5 MiB"));
    }
}
