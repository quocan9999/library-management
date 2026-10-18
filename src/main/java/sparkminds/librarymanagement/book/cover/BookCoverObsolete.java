package sparkminds.librarymanagement.book.cover;

/** Ảnh chỉ được dọn khi transaction thay/xóa sách đã commit. */
public record BookCoverObsolete(String publicId) {
}
