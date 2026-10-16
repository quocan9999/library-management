package sparkminds.librarymanagement.book.service;

import java.util.Locale;

public final class BookRules {

    private BookRules() {
    }

    public static String normalizeRequiredText(String value) {
        return value == null ? null : value.trim().replaceAll("\\s+", " ");
    }

    public static String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return normalizeRequiredText(value);
    }

    /**
     * Kiểm tra ISBN nhập từ form và lưu mọi giá trị hợp lệ theo dạng ISBN-13.
     *
     * <p>Hàm bỏ dấu gạch nối/khoảng trắng trình bày, giữ ISBN-13 hợp lệ gồm cả đầu số 979,
     * và chuyển ISBN-10 sang đầu số 978; ISBN sai định dạng hoặc checksum bị từ chối để
     * không lưu một mã định danh không thể dùng nhất quán khi tìm kiếm và kiểm tra trùng.
     *
     * @param value ISBN do Admin nhập, có thể để trống
     * @return ISBN-13 đã chuẩn hóa, hoặc {@code null} nếu không cung cấp
     * @throws IllegalArgumentException nếu ISBN không hợp lệ
     */
    public static String normalizeIsbn(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String compact = value.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        if (isValidIsbn13(compact)) {
            return compact;
        }
        if (isValidIsbn10(compact)) {
            String firstTwelveDigits = "978" + compact.substring(0, 9);
            return firstTwelveDigits + isbn13CheckDigit(firstTwelveDigits);
        }
        throw new IllegalArgumentException("ISBN phải là ISBN-10 hoặc ISBN-13 hợp lệ");
    }

    private static boolean isValidIsbn10(String isbn) {
        if (!isbn.matches("\\d{9}[\\dX]")) {
            return false;
        }
        int sum = 0;
        for (int index = 0; index < 10; index++) {
            int digit = index == 9 && isbn.charAt(index) == 'X'
                    ? 10
                    : Character.digit(isbn.charAt(index), 10);
            sum += (10 - index) * digit;
        }
        return sum % 11 == 0;
    }

    private static boolean isValidIsbn13(String isbn) {
        if (!isbn.matches("\\d{13}") || !(isbn.startsWith("978") || isbn.startsWith("979"))) {
            return false;
        }
        return isbn.charAt(12) == isbn13CheckDigit(isbn.substring(0, 12));
    }

    private static char isbn13CheckDigit(String firstTwelveDigits) {
        int sum = 0;
        for (int index = 0; index < 12; index++) {
            int digit = Character.digit(firstTwelveDigits.charAt(index), 10);
            sum += digit * (index % 2 == 0 ? 1 : 3);
        }
        return Character.forDigit((10 - sum % 10) % 10, 10);
    }
}
