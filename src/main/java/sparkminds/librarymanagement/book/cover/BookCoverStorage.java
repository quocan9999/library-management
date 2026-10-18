package sparkminds.librarymanagement.book.cover;

/** Ranh giới dịch vụ lưu ảnh bên ngoài để integration test không gọi Cloudinary thật. */
public interface BookCoverStorage {
    UploadedBookCover upload(byte[] content);
    void delete(String publicId);
}
