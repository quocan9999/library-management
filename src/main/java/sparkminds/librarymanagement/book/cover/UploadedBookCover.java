package sparkminds.librarymanagement.book.cover;

/** Thông tin ảnh đã upload; publicId chỉ dùng phía server để dọn tài nguyên. */
public record UploadedBookCover(String url, String publicId) {
}
